// Images: checked by their contents (never their name), cropped in the browser, stored as WebP in several widths so
// phones load small copies, and recorded in website_images with their alt text and focus point.
import type { SiteImage } from "@/lib/site/schema.ts";
import { supabase } from "./supabase";
import { supabaseUrl } from "./config";

export const MAX_BYTES = 10 * 1024 * 1024;
const WIDTHS = [480, 800, 1200, 1600, 2400];
const BUCKET = "site-images";

export interface ImageRow {
  id: string;
  storage_path: string;
  usage_key: string;
  file_name: string;
  alt_text: string;
  focal_point: { x: number; y: number };
  width: number;
  height: number;
  variants: { width: number; path: string }[];
  byte_size: number;
  created_at: string;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const aspectOptions = [
  { id: "hero", label: "Bred", ratio: 16 / 9 },
  { id: "photo", label: "Liggande", ratio: 4 / 3 },
  { id: "portrait", label: "Stående", ratio: 4 / 5 },
  { id: "square", label: "Kvadrat", ratio: 1 },
  { id: "free", label: "Original", ratio: 0 },
] as const;
export type AspectId = (typeof aspectOptions)[number]["id"];

/** Which crop suits a place in the layout. */
export function aspectForUsage(usage?: string): AspectId {
  if (usage === "card" || usage === "favicon") return "square";
  if (usage === "hero" || usage === "photo" || usage === "portrait" || usage === "square") return usage;
  return "free";
}

/** The file's real type from its first bytes; null if it is not a picture this site accepts. */
export async function sniffImageType(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(4, 8) === "ftyp" && /avif|avis/.test(ascii(8, 12))) return "image/avif";
  return null;
}

export async function checkFile(file: File): Promise<string | null> {
  if (file.size > MAX_BYTES) return "Bilden är större än 10 MB. Välj en mindre bild.";
  const type = await sniffImageType(file);
  if (!type) return "Filen är ingen bild som går att använda (JPG, PNG, WebP, GIF eller AVIF).";
  return null;
}

export async function decode(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** One cropped copy at a given width; WebP where the browser can make it, otherwise JPEG. */
async function render(source: ImageBitmap, crop: CropRect, width: number): Promise<{ blob: Blob; ext: string; height: number }> {
  const height = Math.round((crop.height / crop.width) * width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", height };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.86);
  if (!jpeg) throw new Error("Bilden kunde inte sparas i webbläsaren.");
  return { blob: jpeg, ext: "jpg", height };
}

export function publicUrl(path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Crops, makes the copies, uploads them and records the image. */
export async function uploadImage(options: {
  source: ImageBitmap;
  crop: CropRect;
  fileName: string;
  alt: string;
  focus: { x: number; y: number };
  usage: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<ImageRow> {
  const { source, crop } = options;
  const widths = WIDTHS.filter((w) => w < crop.width);
  widths.push(Math.min(Math.round(crop.width), 2400));
  const unique = Array.from(new Set(widths)).sort((a, b) => a - b);
  const id = crypto.randomUUID();
  const variants: { width: number; path: string }[] = [];
  let bytes = 0;
  let finalHeight = 0;
  for (const [index, width] of unique.entries()) {
    const { blob, ext, height } = await render(source, crop, width);
    const path = `${id}/${width}.${ext}`;
    const { error } = await supabase().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
    if (error) {
      await supabase().storage.from(BUCKET).remove(variants.map((v) => v.path));
      throw error;
    }
    variants.push({ width, path });
    bytes += blob.size;
    finalHeight = height;
    options.onProgress?.(index + 1, unique.length);
  }
  const { data, error } = await supabase()
    .from("website_images")
    .insert({
      storage_path: id,
      usage_key: options.usage,
      file_name: options.fileName.slice(0, 200),
      alt_text: options.alt,
      focal_point: options.focus,
      width: unique[unique.length - 1],
      height: finalHeight,
      variants,
      byte_size: bytes,
    })
    .select("*")
    .single();
  if (error) {
    await supabase().storage.from(BUCKET).remove(variants.map((v) => v.path));
    throw error;
  }
  return data as ImageRow;
}

export async function listImages(): Promise<ImageRow[]> {
  const { data, error } = await supabase().from("website_images").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as ImageRow[];
}

export async function deleteImage(row: ImageRow): Promise<void> {
  const { error } = await supabase().storage.from(BUCKET).remove(row.variants.map((v) => v.path));
  if (error) throw error;
  const { error: rowError } = await supabase().from("website_images").delete().eq("id", row.id);
  if (rowError) throw rowError;
}

export async function updateImageDetails(id: string, details: { alt_text?: string; focal_point?: { x: number; y: number } }): Promise<void> {
  const { error } = await supabase().from("website_images").update(details).eq("id", id);
  if (error) throw error;
}

/** The image as the content refers to it: every copy for the srcset, the alt text and the focus point. */
export function toSiteImage(row: ImageRow, focus = row.focal_point, alt = row.alt_text): SiteImage {
  const sorted = [...row.variants].sort((a, b) => a.width - b.width);
  return {
    src: publicUrl(sorted[sorted.length - 1].path),
    variants: sorted.map((v) => ({ width: v.width, src: publicUrl(v.path) })),
    alt,
    focus: `${Math.round(focus.x)}% ${Math.round(focus.y)}%`,
    imageId: row.id,
  };
}

/** The smallest copy, for thumbnails in the admin. */
export function thumbnail(image: SiteImage): string {
  const smallest = [...image.variants].sort((a, b) => a.width - b.width)[0];
  const src = smallest?.src ?? image.src;
  return src.startsWith("/") ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${src}` : src;
}

export function parseFocus(focus?: string): { x: number; y: number } {
  const match = focus?.match(/^([\d.]+)% ([\d.]+)%$/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 50, y: 50 };
}
