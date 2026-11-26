import type { SiteImage } from "./schema.ts";

/** Files in public/ are served under the base path on the GitHub Pages preview. */
export function withBasePath(src: string): string {
  // In the admin's preview, pictures just uploaded are not on the site until it has been rebuilt; the preview sets
  // where to fetch them from the repository meanwhile (app/admin/forhandsvisning).
  const raw = typeof window !== "undefined" ? (window as { __uploadsFrom?: string }).__uploadsFrom : undefined;
  if (raw && src.startsWith("/photos/uploads/")) return `${raw}${src}`;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return src.startsWith("/") ? `${basePath}${src}` : src;
}

/**
 * The <img> attributes that let the browser load a copy of the image no bigger than it is shown. `sizes` is how wide
 * the image is shown, as in the HTML sizes attribute.
 */
export function imageProps(image: SiteImage, sizes: string): { src: string; srcSet?: string; sizes?: string } {
  const src = withBasePath(image.src);
  if (image.variants.length === 0) return { src };
  return { src, srcSet: image.variants.map((v) => `${withBasePath(v.src)} ${v.width}w`).join(", "), sizes };
}

/** The image's own focus point, overriding the layout's default crop, when one is set. */
export function focusStyle(image: SiteImage): { objectPosition: string } | undefined {
  return image.focus ? { objectPosition: image.focus } : undefined;
}
