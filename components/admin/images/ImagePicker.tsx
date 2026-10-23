"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Images, UploadCloud } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { AdminButton } from "../ui/Button";
import { TextArea } from "../ui/Field";
import { Tabs } from "../ui/Tabs";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import { ImageCropper } from "./ImageCropper";
import {
  aspectForUsage,
  checkFile,
  decode,
  listImages,
  toSiteImage,
  uploadImage,
  publicUrl,
  type AspectId,
  type CropRect,
  type ImageRow,
} from "@/lib/admin/images";
import { errorMessage } from "@/lib/admin/supabase";
import type { SiteImage } from "@/lib/site/schema.ts";

interface Pending {
  file: File;
  bitmap: ImageBitmap;
  url: string;
}

/** Chooses an image for a place on the site: a new upload (cropped to fit, with alt text) or one already uploaded. */
export function ImagePicker({
  open,
  onClose,
  onSelect,
  usage,
  title = "Välj bild",
  uploadOnly = false,
  initialFile,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (image: SiteImage) => void;
  usage?: string;
  title?: string;
  /** Only uploading (the image library itself), no choosing among earlier uploads. */
  uploadOnly?: boolean;
  /** A file already chosen, e.g. dropped on the page. */
  initialFile?: File | null;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [pending, setPending] = useState<Pending | null>(null);
  const [aspect, setAspect] = useState<AspectId>(aspectForUsage(usage));
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [focus, setFocus] = useState({ x: 50, y: 50 });
  const [alt, setAlt] = useState("");
  const [altError, setAltError] = useState("");
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [library, setLibrary] = useState<ImageRow[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab("upload");
    setPending(null);
    setAlt("");
    setAltError("");
    setProgress(null);
    setAspect(aspectForUsage(usage));
    if (initialFile) void pick(initialFile);
    if (!uploadOnly) listImages().then(setLibrary, () => setLibrary([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, usage, initialFile, uploadOnly]);

  useEffect(() => () => pending?.bitmap.close(), [pending]);

  const onCropChange = useCallback((nextCrop: CropRect, nextFocus: { x: number; y: number }) => {
    setCrop(nextCrop);
    setFocus(nextFocus);
  }, []);

  async function pick(file: File | undefined) {
    if (!file) return;
    const problem = await checkFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      const bitmap = await decode(file);
      setPending({ file, bitmap, url: URL.createObjectURL(file) });
    } catch {
      toast.error("Bilden gick inte att öppna. Prova en annan bild.");
    }
  }

  async function save() {
    if (!pending || !crop) return;
    if (!alt.trim() && usage !== "favicon") {
      setAltError("Beskriv kort vad bilden visar – det behövs för synskadade och för Google.");
      return;
    }
    setProgress([0, 1]);
    try {
      const row = await uploadImage({
        source: pending.bitmap,
        crop,
        fileName: pending.file.name,
        alt: alt.trim(),
        focus,
        usage: usage ?? "free",
        onProgress: (done, total) => setProgress([done, total]),
      });
      onSelect(toSiteImage(row));
      toast.success("Bilden är uppladdad.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Bilden kunde inte laddas upp. Försök igen."));
      setProgress(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        pending ? (
          <>
            <AdminButton variant="ghost" onClick={() => setPending(null)} disabled={progress !== null}>
              Välj en annan bild
            </AdminButton>
            <AdminButton
              variant="primary"
              onClick={() => void save()}
              busy={progress !== null}
              busyLabel={progress ? `Laddar upp ${progress[0]} av ${progress[1]}…` : "Laddar upp…"}
            >
              Använd bilden
            </AdminButton>
          </>
        ) : undefined
      }
    >
      {!pending && !uploadOnly && (
        <div className="mb-4">
          <Tabs
            label="Bildkälla"
            active={tab}
            onChange={(id) => setTab(id as "upload" | "library")}
            items={[
              { id: "upload", label: "Ladda upp ny" },
              { id: "library", label: "Tidigare uppladdade" },
            ]}
          />
        </div>
      )}

      {pending ? (
        <div className="space-y-5">
          <ImageCropper bitmap={pending.bitmap} previewUrl={pending.url} aspect={aspect} onAspect={setAspect} onChange={onCropChange} />
          {usage !== "favicon" && (
          <TextArea
            label="Bildtext för synskadade och Google (alt-text)"
            hint="Beskriv kort vad bilden visar, t.ex. ”Nyrenoverat badrum med grå plattor och glasvägg”."
            rows={2}
            recommended={125}
            value={alt}
            onChange={(value) => {
              setAlt(value);
              if (value.trim()) setAltError("");
            }}
            error={altError || undefined}
          />
          )}
        </div>
      ) : tab === "upload" ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Välj en bild att ladda upp, eller släpp den här"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void pick(event.dataTransfer.files[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin ${
            dragging ? "border-admin bg-admin/5" : "border-stone-300 hover:border-admin/60 hover:bg-stone-50"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-admin/10 text-admin">
            <UploadCloud aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[16px] font-semibold text-admin-ink">Dra hit en bild eller tryck för att välja</p>
          <p className="mt-1 text-[14px] text-admin-muted">JPG, PNG, WebP, GIF eller AVIF, högst 10 MB. Bilden görs om till rätt storlekar automatiskt.</p>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" tabIndex={-1} onChange={(event) => void pick(event.target.files?.[0])} />
        </div>
      ) : library === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : library.length === 0 ? (
        <EmptyState icon={Images} title="Inga uppladdade bilder än" text="Bilder du laddar upp sparas här och kan användas igen var som helst på hemsidan." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {library.map((row) => {
            const small = [...row.variants].sort((a, b) => a.width - b.width)[0];
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(toSiteImage(row));
                    onClose();
                  }}
                  className="group block w-full overflow-hidden rounded-xl bg-stone-100 text-left ring-1 ring-admin-line transition hover:ring-2 hover:ring-admin focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrl(small.path)} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block truncate px-2.5 py-2 text-[12px] text-admin-muted">{row.alt_text || row.file_name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!pending && tab === "upload" && (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-admin-muted">
          <ImagePlus aria-hidden="true" className="h-4 w-4" />
          Du får beskära bilden och välja det viktigaste i den innan den sparas.
        </p>
      )}
    </Dialog>
  );
}
