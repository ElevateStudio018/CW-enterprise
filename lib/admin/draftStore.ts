// The editor's copy of the draft and everything that keeps it safe:
//
// - Edits show at once (optimistic) and go into an outbox, kept in IndexedDB so they survive a reload or going offline.
// - The outbox is sent field by field after 600 ms of quiet, and at once on blur, on leaving the page and before
//   publishing. Failed sends retry with growing pauses; the text stays on screen meanwhile ("Ej sparat – försöker igen").
// - Saved edits are kept in this browser (the draft) until they are published; publishing commits content/site.json
//   to the site's GitHub repository, which rebuilds the site (lib/admin/github.ts). If someone else published in the
//   meantime, publishing stops and asks for a reload rather than overwriting their changes.
// - The last 20 edits can be undone.
import type { SiteData } from "@/lib/site/schema.ts";
import { applyPatches, getAt, pathKey, setAt, type ContentPath, type Patch } from "@/lib/site/paths.ts";
import { siteDataSchema } from "@/lib/site/schema.ts";
import { CONTENT_PATH, VERSION_PATH, commitFiles, readFile, repository } from "./github";
import { outboxDelete, outboxLoad, outboxPut, type OutboxRecord } from "./outbox";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export type Entry =
  | { kind: "patch"; key: string; patches: Patch[]; queuedAt: number }
  | { kind: "color"; key: string; scope: "site" | "admin"; role: string; value: string; queuedAt: number }
  | { kind: "font"; key: string; role: string; family: string; category: string; queuedAt: number };

export interface Conflict {
  key: string;
  label: string;
  mine: unknown;
  theirs: unknown;
}

export interface PublishIssue {
  path: string[];
  where: string;
  message: string;
}

export interface DraftState {
  status: "loading" | "ready" | "error";
  loadError: string | null;
  draft: SiteData | null;
  /** The published version the draft builds on. */
  version: number;
  publishedAt: string | null;
  marker: string;
  knownAt: string;
  /** Unpublished changes on the server plus those still on their way. */
  pendingChanges: number;
  themeChanged: boolean;
  adminColors: Record<string, string>;
  saveState: SaveState;
  saveError: string | null;
  conflict: Conflict | null;
  canUndo: boolean;
  publishing: boolean;
  publishIssues: PublishIssue[];
}

type UndoStep =
  | { kind: "patch"; patches: Patch[] }
  | {
      kind: "theme";
      colors: { scope: "site" | "admin"; role: string; value: string }[];
      fonts: { role: string; family: string; category: string }[];
    };

const DEBOUNCE_MS = 600;
const MAX_UNDO = 20;

function clientId(): string {
  try {
    let id = localStorage.getItem("cwe-admin-client");
    if (!id) {
      id = `c-${crypto.randomUUID()}`;
      localStorage.setItem("cwe-admin-client", id);
    }
    return id;
  } catch {
    return `c-${Math.random().toString(36).slice(2)}`;
  }
}

const DRAFT_KEY = `site-draft:${repository}`;

interface StoredDraft {
  baseSha: string;
  draft: SiteData;
  adminColors: Record<string, string>;
}

function readStored(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as StoredDraft) : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredDraft | null) {
  try {
    if (value) localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage full or blocked: the edits stay in the tab until published.
  }
}

/** How many fields differ between the published content and the draft. */
function countChanges(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    let n = 0;
    for (const key of keys) n += countChanges((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
    return n;
  }
  return JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && /[åäöÅÄÖ]/.test(error.message) ? error.message : fallback;
}

export class DraftStore {
  private published: SiteData | null = null;
  private contentSha = "";
  private state: DraftState = {
    status: "loading",
    loadError: null,
    draft: null,
    version: 0,
    publishedAt: null,
    marker: "",
    knownAt: "",
    pendingChanges: 0,
    themeChanged: false,
    adminColors: {},
    saveState: "idle",
    saveError: null,
    conflict: null,
    canUndo: false,
    publishing: false,
    publishIssues: [],
  };
  private listeners = new Set<() => void>();
  private outbox = new Map<string, Entry>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private ready = new Set<string>();
  private sending = false;
  private retryDelay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private undoStack: UndoStep[] = [];
  private serverChanges = 0;
  private readonly client = clientId();
  private channel: BroadcastChannel | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  private savedListeners = new Set<(entry: Entry) => void>();

  /** Called after each edit reaches the server (the onboarding checklist ticks itself off with it). */
  onSaved(listener: (entry: Entry) => void): () => void {
    this.savedListeners.add(listener);
    return () => {
      this.savedListeners.delete(listener);
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(partial: Partial<DraftState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener());
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Loading

  async start() {
    if (typeof window === "undefined") return;
    window.addEventListener("online", () => this.kick());
    window.addEventListener("beforeunload", (event) => {
      if (this.outbox.size > 0) {
        this.flush();
        event.preventDefault();
        event.returnValue = "";
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush();
    });
    window.addEventListener("pagehide", () => this.flush());
    try {
      this.channel = new BroadcastChannel("cwe-admin");
      this.channel.onmessage = (message) => {
        if (message.data?.type === "saved" || message.data?.type === "published") this.scheduleReload();
      };
    } catch {
      this.channel = null;
    }

    const stored = await outboxLoad();
    for (const record of stored) {
      this.outbox.set(record.key, record.entry as Entry);
      this.ready.add(record.key);
    }
    await this.load();
  }

  /** Fetches the published content and lays this browser's saved draft and any unsent edits over it. */
  async load() {
    try {
      const file = await readFile(CONTENT_PATH);
      if (!file) throw new Error("Hemsidans innehåll hittades inte i GitHub.");
      const published = JSON.parse(file.text) as SiteData;
      const versionFile = await readFile(VERSION_PATH);
      const info = versionFile ? (JSON.parse(versionFile.text) as { version?: number; publishedAt?: string }) : {};
      const stored = readStored();
      let draft = stored?.draft ?? published;
      for (const entry of this.sortedOutbox()) draft = this.applyLocally(draft, entry);
      this.published = published;
      this.contentSha = file.sha;
      this.serverChanges = countChanges(published, stored?.draft ?? published);
      this.set({
        status: "ready",
        loadError: null,
        draft,
        version: Number(info.version ?? 0),
        publishedAt: info.publishedAt ?? null,
        marker: file.sha,
        knownAt: "",
        themeChanged: JSON.stringify(draft.theme) !== JSON.stringify(published.theme),
        adminColors: stored?.adminColors ?? {},
        pendingChanges: this.serverChanges + this.outbox.size,
      });
      if (this.outbox.size > 0) this.kick();
    } catch (error) {
      if (this.state.status !== "ready") this.set({ status: "error", loadError: errorText(error, "Hemsidans innehåll kunde inte hämtas.") });
    }
  }

  private countTimer: ReturnType<typeof setTimeout> | null = null;

  /** Refreshes how many unpublished changes the server holds, a moment after saves settle. */
  private scheduleCount() {
    if (this.countTimer) clearTimeout(this.countTimer);
    this.countTimer = setTimeout(() => {
      if (!this.published || !this.state.draft) return;
      this.serverChanges = countChanges(this.published, readStored()?.draft ?? this.published);
      this.set({ pendingChanges: this.serverChanges + this.outbox.size });
    }, 300);
  }

  private scheduleReload() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      if (this.sending || this.outbox.size > 0) return this.scheduleReload();
      void this.load();
    }, 1500);
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Editing

  /** Sets one field. Edits to the same field within 600 ms are saved as one. */
  edit(path: ContentPath, value: unknown) {
    this.change([{ path, op: "set", value }], pathKey(path));
  }

  /** Several changes that belong together (an item and its place in a list), saved all or nothing. */
  editMany(patches: Patch[]) {
    this.change(patches, `group:${crypto.randomUUID()}`);
  }

  remove(path: ContentPath) {
    this.change([{ path, op: "delete" }], pathKey(path));
  }

  private change(patches: Patch[], key: string, recordUndo = true) {
    const draft = this.state.draft;
    if (!draft) return;
    if (recordUndo) {
      const inverse: Patch[] = patches
        .map((patch) => {
          const before = getAt(draft, patch.path);
          return before === undefined ? ({ path: patch.path, op: "delete" } as Patch) : ({ path: patch.path, op: "set", value: before } as Patch);
        })
        .reverse();
      this.pushUndo({ kind: "patch", patches: inverse });
    }
    const existing = this.outbox.get(key);
    const entry: Entry = { kind: "patch", key, patches, queuedAt: existing?.queuedAt ?? Date.now() };
    this.queue(entry);
    this.set({ draft: applyPatches(draft, patches), canUndo: this.undoStack.length > 0 });
  }

  private pushUndo(step: UndoStep) {
    this.undoStack.push(step);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
  }

  private colorNow(scope: "site" | "admin", role: string): string | undefined {
    if (scope === "admin") return this.state.adminColors[role];
    return (this.state.draft?.theme.colors as Record<string, string> | undefined)?.[role];
  }

  /** Sets one colour. While a colour is dragged in the picker, the changes count as one step to undo. */
  setColor(scope: "site" | "admin", role: string, value: string, recordUndo = true) {
    if (recordUndo) this.recordColors(scope, [role]);
    this.applyColor(scope, role, value);
    this.set({ canUndo: this.undoStack.length > 0 });
  }

  /** Sets many colours at once (a palette): one step to undo. */
  setColors(scope: "site" | "admin", values: Record<string, string>) {
    this.recordColors(scope, Object.keys(values), true);
    for (const [role, value] of Object.entries(values)) this.applyColor(scope, role, value);
    this.set({ canUndo: this.undoStack.length > 0 });
  }

  private lastColorStep: { key: string; at: number } | null = null;

  private recordColors(scope: "site" | "admin", roles: string[], separate = false) {
    const key = `${scope}:${roles.join(",")}`;
    const now = Date.now();
    // Dragging through a colour picker sends dozens of values; a pause of a second starts a new step.
    if (!separate && this.lastColorStep?.key === key && now - this.lastColorStep.at < 1000) {
      this.lastColorStep.at = now;
      return;
    }
    this.lastColorStep = separate ? null : { key, at: now };
    const colors = roles.flatMap((role) => {
      const value = this.colorNow(scope, role);
      return value ? [{ scope, role, value }] : [];
    });
    if (colors.length > 0) this.pushUndo({ kind: "theme", colors, fonts: [] });
  }

  private applyColor(scope: "site" | "admin", role: string, value: string) {
    const key = `color:${scope}:${role}`;
    const draft = this.state.draft;
    if (scope === "site" && draft) {
      this.set({ draft: setAt(draft, ["theme", "colors", role], value), themeChanged: true });
    } else {
      this.set({ adminColors: { ...this.state.adminColors, [role]: value } });
    }
    this.queue({ kind: "color", key, scope, role, value, queuedAt: this.outbox.get(key)?.queuedAt ?? Date.now() });
  }

  setFont(role: string, family: string, category: string, recordUndo = true) {
    const key = `font:${role}`;
    const draft = this.state.draft;
    const before = (draft?.theme.fonts as Record<string, { family: string; category: string }> | undefined)?.[role];
    if (recordUndo && before) this.pushUndo({ kind: "theme", colors: [], fonts: [{ role, ...before }] });
    if (draft) this.set({ draft: setAt(draft, ["theme", "fonts", role], { family, category }), themeChanged: true });
    this.queue({ kind: "font", key, role, family, category, queuedAt: this.outbox.get(key)?.queuedAt ?? Date.now() });
    this.set({ canUndo: this.undoStack.length > 0 });
  }

  undo() {
    const step = this.undoStack.pop();
    if (!step) return;
    if (step.kind === "patch") {
      this.change(step.patches, step.patches.length === 1 ? pathKey(step.patches[0].path) : `group:${crypto.randomUUID()}`, false);
    } else {
      this.lastColorStep = null;
      for (const color of step.colors) this.applyColor(color.scope, color.role, color.value);
      for (const font of step.fonts) this.setFont(font.role, font.family, font.category, false);
    }
    this.set({ canUndo: this.undoStack.length > 0 });
  }

  private applyLocally(draft: SiteData, entry: Entry): SiteData {
    if (entry.kind === "patch") return applyPatches(draft, entry.patches);
    if (entry.kind === "color" && entry.scope === "site") return setAt(draft, ["theme", "colors", entry.role], entry.value);
    if (entry.kind === "font") return setAt(draft, ["theme", "fonts", entry.role], { family: entry.family, category: entry.category });
    return draft;
  }

  // -------------------------------------------------------------------------------------------------------------------
  // The outbox

  private queue(entry: Entry) {
    this.outbox.set(entry.key, entry);
    this.ready.delete(entry.key);
    void outboxPut({ key: entry.key, entry } as OutboxRecord);
    const timer = this.timers.get(entry.key);
    if (timer) clearTimeout(timer);
    this.timers.set(
      entry.key,
      setTimeout(() => {
        this.timers.delete(entry.key);
        this.ready.add(entry.key);
        this.kick();
      }, DEBOUNCE_MS)
    );
    this.set({ saveState: this.state.saveState === "error" ? "error" : "dirty", pendingChanges: this.serverChanges + this.outbox.size });
  }

  /** Sends everything waiting, now (on blur, leaving the page, before publishing). */
  flush() {
    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
      this.ready.add(key);
    }
    this.timers.clear();
    this.kick();
  }

  private sortedOutbox(): Entry[] {
    return Array.from(this.outbox.values()).sort((a, b) => a.queuedAt - b.queuedAt);
  }

  private kick() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    void this.pump();
  }

  private async pump() {
    if (this.sending || this.state.conflict || this.state.status !== "ready") return;
    const next = this.sortedOutbox().find((entry) => this.ready.has(entry.key));
    if (!next) {
      if (this.outbox.size === 0 && (this.state.saveState === "saving" || this.state.saveState === "dirty")) this.markSaved();
      return;
    }
    this.sending = true;
    this.set({ saveState: this.state.saveState === "error" ? "error" : "saving" });
    try {
      const outcome = await this.send(next);
      if (outcome.status === "conflict") {
        this.set({
          conflict: { key: next.key, label: this.describe(next), mine: this.mineOf(next), theirs: outcome.serverValue },
          saveState: "dirty",
        });
        return;
      }
      // Saved. Unless the field changed again meanwhile, it is done.
      if (this.outbox.get(next.key) === next) {
        this.outbox.delete(next.key);
        this.ready.delete(next.key);
        await outboxDelete(next.key);
        this.scheduleCount();
      }
      this.retryDelay = 1000;
      this.channel?.postMessage({ type: "saved" });
      this.savedListeners.forEach((listener) => listener(next));
      this.set({ saveError: null, pendingChanges: this.serverChanges + this.outbox.size });
    } catch (error) {
      this.set({ saveState: "error", saveError: errorText(error, "Ändringen kunde inte sparas än.") });
      this.retryTimer = setTimeout(() => this.kick(), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
      return;
    } finally {
      this.sending = false;
    }
    void this.pump();
  }

  private markSaved() {
    this.set({ saveState: "saved", saveError: null });
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      if (this.state.saveState === "saved") this.set({ saveState: "idle" });
    }, 4000);
  }

  /** "Sends" an edit: the draft as it is now (with this edit) is kept in this browser until it is published. */
  private async send(_entry: Entry, _force = false): Promise<{ status: string; serverValue?: unknown }> {
    if (!this.state.draft) throw new Error("Innehållet är inte laddat än.");
    writeStored({ baseSha: this.contentSha, draft: this.state.draft, adminColors: this.state.adminColors });
    return { status: "saved" };
  }

  private mineOf(entry: Entry): unknown {
    if (entry.kind === "patch") return entry.patches.length === 1 ? entry.patches[0].value : entry.patches.map((p) => p.value);
    if (entry.kind === "color") return entry.value;
    return entry.family;
  }

  private describe(entry: Entry): string {
    return entry.kind === "patch" ? entry.patches.map((p) => pathKey(p.path)).join(", ") : entry.key;
  }

  /** After another device changed the same field: keep this one ("mine") or take theirs. */
  async resolveConflict(choice: "mine" | "theirs") {
    const conflict = this.state.conflict;
    if (!conflict) return;
    const entry = this.outbox.get(conflict.key);
    if (choice === "mine" && entry) {
      this.set({ conflict: null, saveState: "saving" });
      try {
        await this.send(entry, true);
        if (this.outbox.get(entry.key) === entry) {
          this.outbox.delete(entry.key);
          this.ready.delete(entry.key);
          await outboxDelete(entry.key);
        }
      } catch (error) {
        this.set({ saveState: "error", saveError: errorText(error, "Ändringen kunde inte sparas än.") });
      }
    } else if (entry) {
      this.outbox.delete(entry.key);
      this.ready.delete(entry.key);
      await outboxDelete(entry.key);
      this.set({ conflict: null });
    }
    await this.load();
    this.kick();
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Publishing

  /** Waits until every edit has reached the server (or fails fast if one cannot). */
  private async drain(): Promise<void> {
    this.flush();
    const started = Date.now();
    while (this.outbox.size > 0 || this.sending) {
      if (this.state.conflict) throw new Error("Lös först konflikten med ändringen från en annan enhet.");
      if (this.state.saveState === "error" && Date.now() - started > 8000) throw new Error("Alla ändringar har inte kunnat sparas än. Kontrollera anslutningen.");
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  async publish(): Promise<{ version: number; summary: string; deploy: { started: boolean; message?: string } }> {
    this.set({ publishing: true, publishIssues: [] });
    try {
      await this.drain();
      const draft = this.state.draft;
      if (!draft) throw new Error("Innehållet är inte laddat än.");
      const checked = siteDataSchema.safeParse(draft);
      if (!checked.success) {
        const issues = checked.error.issues.slice(0, 20).map((issue) => ({ path: issue.path.map(String), where: issue.path.join(" › "), message: issue.message }));
        this.set({ publishIssues: issues });
        throw new Error("Något fält behöver rättas innan du kan publicera.");
      }
      // Someone else published since this draft was loaded: stop rather than overwrite their changes.
      const current = await readFile(CONTENT_PATH);
      if (current && current.sha !== this.contentSha) throw new Error("Någon annan har publicerat under tiden. Ladda om sidan, så kommer dina ändringar med, och publicera igen.");
      const changes = this.state.pendingChanges;
      const version = this.state.version + 1;
      const publishedAt = new Date().toISOString();
      await commitFiles(
        [
          { path: CONTENT_PATH, text: JSON.stringify(checked.data, null, 2) + "\n" },
          { path: VERSION_PATH, text: JSON.stringify({ version, publishedAt }) + "\n" },
        ],
        `Publicera ändringar från adminpanelen (version ${version})`
      );
      writeStored(null);
      this.serverChanges = 0;
      this.undoStack = [];
      this.channel?.postMessage({ type: "published" });
      await this.load();
      this.set({ canUndo: false });
      return { version, summary: `${changes} ${changes === 1 ? "ändring" : "ändringar"}`, deploy: { started: true } };
    } finally {
      this.set({ publishing: false });
    }
  }

  /** Throws away every unpublished change (after the person confirmed). */
  async discard() {
    await this.drain();
    writeStored(null);
    this.serverChanges = 0;
    this.undoStack = [];
    await this.load();
    this.set({ canUndo: false });
  }

}
