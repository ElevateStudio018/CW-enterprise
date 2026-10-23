"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, CircleSlash, ImagePlus, List, Sparkles, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { useToast } from "@/components/admin/ui/Toast";
import { LowCredits } from "@/components/admin/LowCredits";
import { PreviewPane } from "@/components/admin/editor/PreviewPane";
import { ImagePicker } from "@/components/admin/images/ImagePicker";
import { TopUpDialog } from "@/components/admin/settings/CreditsTab";
import { ConversationList } from "@/components/admin/ai/ConversationList";
import { MessageView, type Activity } from "@/components/admin/ai/MessageView";
import { RichText } from "@/components/admin/ai/RichText";
import { useAdminData, useDraft } from "@/contexts/admin/AdminDataContext";
import { aiAction, deleteConversation, listConversations, listMessages, renameConversation, streamAi, type AiConversation, type AiEvent, type AiMessage } from "@/lib/admin/ai";
import { errorMessage } from "@/lib/admin/supabase";
import { thumbnail } from "@/lib/admin/images";
import { applyPatches } from "@/lib/site/paths.ts";
import { homePage } from "@/lib/site/pages.ts";
import type { SiteData, SiteImage } from "@/lib/site/schema.ts";
import type { PreviewTarget } from "@/lib/admin/preview";

const suggestions = ["Lägg till en sektion om teamet", "Skriv om texten i hero-sektionen", "Lägg till 3 vanliga frågor", "Gör knapparna mörkare"];

/** Where the preview should look for a change: the first page, section or part it touches. */
function targetFor(site: SiteData, paths: string[][]): PreviewTarget {
  const home: PreviewTarget = { kind: "page", pageId: homePage(site).id };
  const path = paths.find((candidate) => candidate[0] !== "theme") ?? paths[0];
  if (!path) return home;
  if (path[0] === "pages" && path[2] && site.pages.items[path[2]]) {
    return { kind: "page", pageId: path[2], sectionId: path[3] === "sections" && path[5] ? path[5] : undefined };
  }
  if (path[0] === "services" && path[2] && site.services.items[path[2]]) return { kind: "service", serviceId: path[2] };
  if (path[0] === "footer") return { kind: "chrome", part: "footer" };
  if (path[0] === "navigation") return { kind: "chrome", part: "navigation" };
  if (path[0] === "form") return { kind: "chrome", part: "form" };
  if (path[0] === "notFound") return { kind: "notFound" };
  return home;
}

function Assistant() {
  const toast = useToast();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { credits, refreshCredits } = useAdminData();
  const { draft, store, pendingChanges, themeChanged } = useDraft();
  const [conversations, setConversations] = useState<AiConversation[] | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(params.get("samtal"));
  const [messages, setMessages] = useState<AiMessage[] | null>(conversationId ? null : []);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // A suggestion from the staff (Hemsidan → Förslag) arrives as ?fraga=…, ready to send in a new conversation.
  const [text, setText] = useState(() => params.get("fraga")?.slice(0, 4000) ?? "");
  const [attachments, setAttachments] = useState<SiteImage[]>([]);
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [topUp, setTopUp] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!params.get("fraga")) return;
    router.replace(pathname, { scroll: false });
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The open conversation's messages; the newest proposal with a preview is shown beside them.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let current = true;
    setMessages(null);
    listMessages(conversationId).then(
      (rows) => {
        if (!current) return;
        setMessages(rows);
        const open = [...rows].reverse().find((row) => row.status === "preview");
        setPreviewId(open?.id ?? null);
      },
      () => current && setMessages([])
    );
    return () => {
      current = false;
    };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, activity?.reply, activity?.status]);

  const openConversation = (id: string | null) => {
    setConversationId(id);
    setListOpen(false);
    setPreviewId(null);
    router.replace(id ? `${pathname}?samtal=${id}` : pathname, { scroll: false });
  };

  const upsert = (message: AiMessage) =>
    setMessages((all) => {
      const list = all ?? [];
      return list.some((row) => row.id === message.id) ? list.map((row) => (row.id === message.id ? message : row)) : [...list, message];
    });

  async function run(body: Record<string, unknown>, kind: Activity["kind"], messageId: string | null, onEvent: (event: AiEvent) => void) {
    const controller = new AbortController();
    abortRef.current = controller;
    setActivity({ messageId, kind, reply: "", status: "", chars: 0 });
    try {
      await streamAi(body, onEvent, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) toast.error(errorMessage(error, "AI:n svarade inte. Försök igen."));
    } finally {
      abortRef.current = null;
      setActivity(null);
      if (controller.signal.aborted && conversationId) {
        // The function records the cancellation a moment later.
        setTimeout(() => listMessages(conversationId).then(setMessages, () => undefined), 1500);
      }
    }
  }

  async function send(message: string) {
    const content = message.trim();
    if (!content || activity) return;
    const pending: AiMessage = {
      id: `pending-${Date.now()}`,
      conversation_id: conversationId ?? "",
      role: "user",
      content,
      attachments: attachments.map((image) => ({ imageId: image.imageId ?? "", src: thumbnail(image), alt: image.alt })),
      plan: null,
      change_set: null,
      credit_cost: 0,
      status: "done",
      revision_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((all) => [...(all ?? []), pending]);
    setText("");
    const ids = attachments.map((image) => image.imageId).filter(Boolean);
    setAttachments([]);
    await run({ action: "send", conversationId, text: content, attachments: ids }, "send", null, (event) => {
      if (event.type === "start") {
        setMessages((all) => (all ?? []).map((row) => (row.id === pending.id ? event.message : row)));
        if (!conversationId) {
          setConversationId(event.conversationId);
          router.replace(`${pathname}?samtal=${event.conversationId}`, { scroll: false });
        }
        void refreshConversations();
      } else if (event.type === "reply") {
        setActivity((current) => current && { ...current, reply: current.reply + event.text });
      } else if (event.type === "done") {
        upsert(event.message);
      } else if (event.type === "error") {
        toast.error(event.message);
      }
    });
    inputRef.current?.focus();
  }

  async function approve(message: AiMessage) {
    await run({ action: "approve", messageId: message.id }, "approve", message.id, (event) => {
      if (event.type === "status") setActivity((current) => current && { ...current, status: event.text });
      else if (event.type === "progress") setActivity((current) => current && { ...current, chars: event.chars });
      else if (event.type === "done") {
        upsert(event.message);
        if (event.message.status === "preview") {
          setPreviewId(event.message.id);
          setShowBefore(false);
        }
      } else if (event.type === "error") toast.error(event.message);
    });
  }

  async function act(action: "publish" | "discard" | "rollback", message: AiMessage) {
    setBusy(`${action}:${message.id}`);
    try {
      const result = await aiAction<{ message: AiMessage; balance?: number; deploy?: { started: boolean } }>(action, message.id);
      upsert(result.message);
      if (action === "publish") {
        toast.success(result.deploy?.started ? "Publicerat! Hemsidan uppdateras inom ett par minuter." : "Publicerat.");
        setPreviewId(null);
      } else if (action === "rollback") {
        toast.success(`Ändringen är ångrad och ${message.credit_cost} credits är återbetalda.`);
      } else if (previewId === message.id) {
        setPreviewId(null);
      }
      if (action !== "discard") {
        await Promise.all([refreshCredits(), store.load()]);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const previewMessage = messages?.find((row) => row.id === previewId && row.change_set) ?? null;
  const proposed = useMemo(() => {
    if (!draft || !previewMessage?.change_set) return null;
    try {
      return applyPatches(draft, previewMessage.change_set.patches);
    } catch {
      return null;
    }
  }, [draft, previewMessage]);
  const shown = proposed && !showBefore ? proposed : draft;
  const target = useMemo(
    () => (draft ? targetFor(draft, previewMessage?.change_set?.patches.map((patch) => patch.path) ?? []) : null),
    [draft, previewMessage]
  );
  const empty = messages !== null && messages.length === 0 && !activity;

  const list = (
    <ConversationList
      conversations={conversations}
      activeId={conversationId}
      disabled={Boolean(activity)}
      onOpen={openConversation}
      onNew={() => openConversation(null)}
      onRename={(id, title) => {
        setConversations((all) => all?.map((row) => (row.id === id ? { ...row, title } : row)) ?? null);
        renameConversation(id, title).catch((error) => toast.error(errorMessage(error)));
      }}
      onDelete={(id) => {
        deleteConversation(id).then(
          () => {
            if (id === conversationId) openConversation(null);
            void refreshConversations();
            toast.success("Konversationen är borttagen.");
          },
          (error) => toast.error(errorMessage(error))
        );
      }}
    />
  );

  return (
    <div className="lg:flex lg:h-[calc(100svh-160px)] lg:flex-col">
      <LowCredits />
      <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        <aside aria-label="Konversationer" className="hidden min-h-0 xl:block">
          {list}
        </aside>

        <section aria-label="Chatt med AI-assistenten" className="flex min-h-[70svh] min-w-0 flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-admin-line lg:min-h-0">
          <header className="flex items-center justify-between gap-3 border-b border-admin-line px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-admin text-admin-contrast">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[16px] font-semibold leading-tight text-admin-ink">Elevate AI</h1>
                <p className="truncate text-[13px] text-admin-muted">{conversations?.find((row) => row.id === conversationId)?.title ?? "Ny konversation"}</p>
              </div>
            </div>
            <AdminButton size="sm" variant="ghost" icon={List} onClick={() => setListOpen(true)} className="xl:hidden">
              Konversationer
            </AdminButton>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
            {messages === null ? (
              <div className="space-y-4" role="status" aria-label="Laddar konversationen">
                <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                <Skeleton className="h-20 w-3/4 rounded-2xl" />
              </div>
            ) : empty ? (
              <div className="flex h-full flex-col items-center justify-center px-2 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-admin/10 text-admin">
                  <Sparkles aria-hidden="true" className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-[18px] font-semibold text-admin-ink">Vad vill du ändra på hemsidan?</h2>
                <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-admin-muted">
                  Beskriv det med egna ord. Jag föreslår en ändring och visar vad den kostar innan något görs – och du ser resultatet innan det publiceras.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="min-h-11 rounded-full bg-white px-4 text-[14px] font-semibold text-admin-ink ring-1 ring-admin-line transition hover:bg-stone-50 hover:ring-admin/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageView
                  key={message.id}
                  message={message}
                  activity={activity}
                  credits={credits}
                  hasDraftChanges={pendingChanges > 0 || themeChanged}
                  busy={busy}
                  previewing={previewId === message.id}
                  onApprove={() => void approve(message)}
                  onDiscard={() => void act("discard", message)}
                  onPublish={() => void act("publish", message)}
                  onRollback={() => void act("rollback", message)}
                  onPreview={() => {
                    setPreviewId(message.id);
                    setShowBefore(false);
                    document.getElementById("ai-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  onStop={() => abortRef.current?.abort()}
                  onTopUp={() => setTopUp(true)}
                />
              ))
            )}
            {activity?.kind === "send" && (
              <div className="flex gap-3">
                <span aria-hidden="true" className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-admin/10 text-admin">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  {activity.reply ? (
                    <RichText text={activity.reply} className="text-admin-ink" />
                  ) : (
                    <span className="flex gap-1 pt-3" role="status" aria-label="AI:n tänker">
                      {[0, 1, 2].map((dot) => (
                        <span key={dot} className="h-2 w-2 animate-pulse rounded-full bg-admin/60" style={{ animationDelay: `${dot * 180}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="border-t border-admin-line p-3 sm:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send(text);
            }}
          >
            {attachments.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2" aria-label="Bifogade bilder">
                {attachments.map((image, index) => (
                  <li key={image.imageId ?? index} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnail(image)} alt={image.alt} className="h-16 w-16 rounded-xl object-cover ring-1 ring-admin-line" />
                    <button
                      type="button"
                      aria-label={`Ta bort bilagan ${image.alt}`}
                      onClick={() => setAttachments((all) => all.filter((_, i) => i !== index))}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-admin-ink text-white shadow"
                    >
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2 rounded-2xl bg-stone-50 p-1.5 ring-1 ring-admin-line focus-within:ring-2 focus-within:ring-admin">
              <button
                type="button"
                onClick={() => setPicking(true)}
                disabled={attachments.length >= 4}
                aria-label="Bifoga en bild"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-admin-muted hover:bg-white hover:text-admin-ink disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              >
                <ImagePlus aria-hidden="true" className="h-5 w-5" />
              </button>
              <label htmlFor="ai-input" className="sr-only">
                Meddelande till AI-assistenten
              </label>
              <textarea
                id="ai-input"
                ref={inputRef}
                value={text}
                rows={1}
                maxLength={4000}
                onChange={(event) => {
                  setText(event.target.value);
                  event.target.style.height = "auto";
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send(text);
                  }
                }}
                placeholder="Beskriv vad du vill ändra…"
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[16px] sm:text-[15px] leading-relaxed text-admin-ink placeholder:text-stone-400 focus:outline-none"
              />
              {activity ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Stoppa"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-admin-ink text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin"
                >
                  <CircleSlash aria-hidden="true" className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!text.trim()}
                  aria-label="Skicka"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-admin text-admin-contrast transition disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin"
                >
                  <ArrowUp aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
            </div>
            <p className="mt-2 px-1 text-[12px] text-admin-muted">Frågor är gratis. Ändringar kostar credits först när du publicerar dem, och kan ångras.</p>
          </form>
        </section>

        <section id="ai-preview" aria-label="Förhandsvisning" className="flex min-h-[60svh] min-w-0 flex-col gap-2 lg:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-admin-ink">{proposed ? "Föreslagen ändring" : "Hemsidan just nu"}</p>
            {proposed && (
              <div role="group" aria-label="Visa" className="flex rounded-xl bg-stone-900/5 p-1">
                {(
                  [
                    [false, "Efter"],
                    [true, "Före"],
                  ] as const
                ).map(([before, label]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={showBefore === before}
                    onClick={() => setShowBefore(before)}
                    className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
                      showBefore === before ? "bg-white text-admin-ink shadow-sm" : "text-admin-muted hover:text-admin-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {shown && target ? <PreviewPane draft={shown} target={target} className="min-h-[56svh] flex-1 lg:min-h-0" /> : <Skeleton className="min-h-[56svh] flex-1 rounded-2xl" />}
        </section>
      </div>

      <Dialog open={listOpen} onClose={() => setListOpen(false)} title="Konversationer" size="sm">
        <div className="h-[60svh]">{list}</div>
      </Dialog>
      <ImagePicker
        open={picking}
        onClose={() => setPicking(false)}
        title="Bifoga en bild"
        onSelect={(image) => setAttachments((all) => [...all, image].slice(0, 4))}
      />
      <TopUpDialog open={topUp} onClose={() => setTopUp(false)} />
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <Assistant />
    </Suspense>
  );
}
