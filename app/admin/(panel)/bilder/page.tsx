"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Images, Pencil, Trash2, TriangleAlert, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminButton } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { Dialog } from "@/components/admin/ui/Dialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { Tabs } from "@/components/admin/ui/Tabs";
import { TextArea } from "@/components/admin/ui/Field";
import { useToast } from "@/components/admin/ui/Toast";
import { ImageField } from "@/components/admin/editor/ImageField";
import { ImagePicker } from "@/components/admin/images/ImagePicker";
import { PublishBar } from "@/components/admin/PublishBar";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { deleteImage, listImages, parseFocus, publicUrl, thumbnail, updateImageDetails, type ImageRow } from "@/lib/admin/images";
import { findImages, imageFieldAt, usagesOf, type ImageUsage } from "@/lib/admin/imageUsage";
import { errorMessage, supabase } from "@/lib/admin/supabase";
import { formatDate } from "@/lib/admin/dates";
import type { SiteData, SiteImage } from "@/lib/site/schema.ts";

function bytes(size: number): string {
  return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(size / 1024)} kB`;
}

/** Where an image is used, as a short list ("Startsidan › Toppen › Bild"). */
function UsageList({ usages }: { usages: ImageUsage[] }) {
  return (
    <ul className="space-y-1 text-[14px] text-admin-ink">
      {usages.map((usage) => (
        <li key={usage.path.join(".")} className="flex gap-2">
          <span aria-hidden="true">•</span>
          {usage.where}
        </li>
      ))}
    </ul>
  );
}

/** One place on the site with a picture, opened to change the picture, its alt text and its focus point. */
function OnSiteDialog({ usage, onClose }: { usage: ImageUsage; onClose: () => void }) {
  const { draft, store } = useDraft();
  if (!draft) return null;
  const spec = imageFieldAt(draft, usage.path);
  const current = (usage.path.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], draft) as SiteImage | null) ?? usage.image;
  return (
    <Dialog open onClose={onClose} title={usage.where} size="lg" footer={<AdminButton onClick={onClose}>Klar</AdminButton>}>
      <ImageField label="Bild" value={current} usage={spec?.imageUsage} optional={spec?.kind === "optionalImage"} onChange={(image) => store.edit(usage.path, image)} />
      <p className="mt-3 text-[13px] text-admin-muted">Ändringen sparas direkt och syns på hemsidan när du publicerar.</p>
    </Dialog>
  );
}

function OnSite({ draft }: { draft: SiteData }) {
  const [editing, setEditing] = useState<ImageUsage | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const usages = useMemo(() => findImages(draft), [draft]);
  // The browser-tab icon is never read out, so it is the one image without a description.
  const needsAlt = (usage: ImageUsage) => usage.path.join(".") !== "settings.favicon" && !usage.image.alt.trim();
  const missingAlt = usages.filter(needsAlt).length;
  const shown = onlyMissing && missingAlt > 0 ? usages.filter(needsAlt) : usages;

  return (
    <>
      {missingAlt > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] text-amber-950">
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <span>
              <strong className="font-semibold">{missingAlt === 1 ? "En bild saknar" : `${missingAlt} bilder saknar`} bildtext.</strong> Den läses upp för
              synskadade och hjälper Google att förstå bilden.
            </span>
          </p>
          <button
            type="button"
            aria-pressed={onlyMissing}
            onClick={() => setOnlyMissing(!onlyMissing)}
            className="min-h-10 shrink-0 rounded-lg px-3 text-[13px] font-semibold text-amber-900 underline-offset-2 hover:bg-amber-100 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700"
          >
            {onlyMissing ? "Visa alla bilder" : "Visa bara dessa"}
          </button>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
        {shown.map((usage) => (
          <li key={usage.path.join(".")}>
            <button
              type="button"
              onClick={() => setEditing(usage)}
              className="group block w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-admin-line transition hover:ring-stone-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
            >
              <span className="relative block aspect-[4/3] overflow-hidden bg-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnail(usage.image)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  style={{ objectPosition: usage.image.focus ?? "50% 50%" }}
                />
              </span>
              <span className="block px-3 py-2.5">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-admin-ink">{usage.where}</span>
                {needsAlt(usage) && (
                  <span className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-amber-800">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Saknar bildtext
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing && <OnSiteDialog usage={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Library({ draft }: { draft: SiteData }) {
  const toast = useToast();
  const { store } = useDraft();
  const [rows, setRows] = useState<ImageRow[] | null>(null);
  const [published, setPublished] = useState<SiteData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dropped, setDropped] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<ImageRow | null>(null);
  const [alt, setAlt] = useState("");
  const [removing, setRemoving] = useState<ImageRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await listImages());
    } catch (error) {
      toast.error(errorMessage(error, "Bilderna kunde inte hämtas."));
      setRows([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void supabase()
      .from("site_snapshot")
      .select("data")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setPublished((data?.data as SiteData) ?? null));
  }, [load]);

  const usage = useCallback(
    (row: ImageRow) => {
      const inDraft = usagesOf(draft, row.id);
      const draftPaths = new Set(inDraft.map((u) => u.path.join(".")));
      // Still on the live site until the next publish, even if the draft has moved on.
      const live = published ? usagesOf(published, row.id).filter((u) => !draftPaths.has(u.path.join("."))) : [];
      return { inDraft, live };
    },
    [draft, published]
  );

  async function saveDetails() {
    if (!editing) return;
    setBusy(true);
    try {
      await updateImageDetails(editing.id, { alt_text: alt.trim() });
      const { inDraft } = usage(editing);
      // The new text also replaces the old one wherever the image is used.
      if (inDraft.length > 0) store.editMany(inDraft.map((u) => ({ path: [...u.path, "alt"], op: "set" as const, value: alt.trim() })));
      toast.success(inDraft.length > 0 ? `Alt-texten är uppdaterad, även på ${inDraft.length === 1 ? "stället" : `de ${inDraft.length} ställen`} där bilden används.` : "Alt-texten är sparad.");
      setEditing(null);
      void load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ImageRow) {
    setBusy(true);
    try {
      await deleteImage(row);
      toast.success("Bilden är borttagen.");
      setRemoving(null);
      void load();
    } catch (error) {
      toast.error(errorMessage(error, "Bilden kunde inte tas bort."));
    } finally {
      setBusy(false);
    }
  }

  const removingUsage = removing ? usage(removing) : null;
  const inUse = removingUsage ? removingUsage.inDraft.length + removingUsage.live.length > 0 : false;

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) {
          setDropped(file);
          setUploading(true);
        }
      }}
      className={`relative rounded-3xl transition ${dragging ? "bg-admin/5 ring-2 ring-dashed ring-admin" : ""}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-admin-muted">Dra in en bild hit, eller</p>
        <AdminButton
          variant="primary"
          icon={UploadCloud}
          onClick={() => {
            setDropped(null);
            setUploading(true);
          }}
        >
          Ladda upp bild
        </AdminButton>
      </div>

      {rows === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Laddar bilder">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-admin-line">
          <EmptyState
            icon={Images}
            title="Inga uppladdade bilder än"
            text="Bilder du laddar upp hamnar här och kan användas var som helst på hemsidan. Hemsidans ursprungliga bilder hittar du under ”På hemsidan”."
          />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => {
            const { inDraft, live } = usage(row);
            const count = inDraft.length + live.length;
            const small = [...row.variants].sort((a, b) => a.width - b.width)[0];
            const focus = parseFocus(`${row.focal_point.x}% ${row.focal_point.y}%`);
            return (
              <li key={row.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-admin-line">
                <span className="relative block aspect-[4/3] bg-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrl(small.path)} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: `${focus.x}% ${focus.y}%` }} />
                  <span className="absolute left-2 top-2">{count > 0 ? <Badge tone="success">Används {count === 1 ? "på 1 ställe" : `på ${count} ställen`}</Badge> : <Badge>Används inte</Badge>}</span>
                </span>
                <div className="px-3.5 py-3">
                  <p className="line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-admin-ink">{row.alt_text || <span className="text-amber-800">Alt-text saknas</span>}</p>
                  <p className="mt-1 text-[12px] tabular-nums text-admin-muted">
                    {row.width}×{row.height} · {bytes(row.byte_size)} · {formatDate(row.created_at)}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <AdminButton
                      size="sm"
                      variant="ghost"
                      icon={Pencil}
                      onClick={() => {
                        setEditing(row);
                        setAlt(row.alt_text);
                      }}
                    >
                      Alt-text
                    </AdminButton>
                    <AdminButton size="sm" variant="ghost" icon={Trash2} onClick={() => setRemoving(row)} className="text-red-700 hover:bg-red-50" aria-label={`Ta bort ${row.alt_text || row.file_name}`}>
                      Ta bort
                    </AdminButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ImagePicker
        open={uploading}
        uploadOnly
        initialFile={dropped}
        title="Ladda upp bild"
        onClose={() => {
          setUploading(false);
          setDropped(null);
        }}
        onSelect={() => void load()}
      />

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Alt-text"
        description="En kort beskrivning av vad bilden visar. Den läses upp för synskadade och hjälper Google att förstå bilden."
        size="md"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setEditing(null)}>
              Avbryt
            </AdminButton>
            <AdminButton variant="primary" onClick={() => void saveDetails()} busy={busy} busyLabel="Sparar…" disabled={!alt.trim()}>
              Spara
            </AdminButton>
          </>
        }
      >
        <TextArea label="Alt-text" value={alt} onChange={setAlt} rows={3} recommended={125} data-autofocus />
      </Dialog>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Ta bort bilden?"
        size="md"
        description={inUse ? undefined : "Den används inte någonstans på hemsidan. Det går inte att ångra."}
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setRemoving(null)} data-autofocus>
              Behåll
            </AdminButton>
            <AdminButton variant="danger" onClick={() => removing && void remove(removing)} busy={busy} busyLabel="Tar bort…">
              {inUse ? "Ta bort ändå" : "Ta bort"}
            </AdminButton>
          </>
        }
      >
        {removingUsage && inUse && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-900">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Bilden används på hemsidan. Tar du bort den försvinner den därifrån – byt hellre bild på de här ställena först.
            </p>
            {removingUsage.inDraft.length > 0 && (
              <div>
                <p className="mb-1 text-[13px] font-semibold text-admin-muted">Används här</p>
                <UsageList usages={removingUsage.inDraft} />
              </div>
            )}
            {removingUsage.live.length > 0 && (
              <div>
                <p className="mb-1 text-[13px] font-semibold text-admin-muted">Syns på den publicerade hemsidan tills du publicerar igen</p>
                <UsageList usages={removingUsage.live} />
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default function ImagesPage() {
  const { status, draft } = useDraft();
  const [tab, setTab] = useState<"site" | "library">("site");

  return (
    <>
      <PageHeader
        title="Bilder"
        description="Byt bilderna på hemsidan, skriv alt-texter och håll ordning på de bilder du laddat upp. Bilder görs automatiskt om till lätta WebP-filer i flera storlekar."
      />
      <PublishBar />
      <div className="mb-5">
        <Tabs
          label="Bilder"
          active={tab}
          onChange={(id) => setTab(id as "site" | "library")}
          items={[
            { id: "site", label: "På hemsidan" },
            { id: "library", label: "Uppladdade" },
          ]}
        />
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {status !== "ready" || !draft ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Laddar bilder">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
            ))}
          </div>
        ) : tab === "site" ? (
          <OnSite draft={draft} />
        ) : (
          <Library draft={draft} />
        )}
      </div>
      {tab === "site" && status === "ready" && (
        <p className="mt-6 flex items-center gap-2 text-[13px] text-admin-muted">
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
          Tryck på en bild för att byta den eller välja vad som alltid ska synas när den beskärs.
        </p>
      )}
    </>
  );
}
