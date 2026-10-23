import { withBasePath } from "@/lib/site/images.ts";
import type { Settings } from "@/lib/site/schema.ts";

/** What the logo spots (header, menu, footer) need to draw the logo. */
export interface LogoContent {
  logo: Settings["logo"];
  /** The company's name for screen readers. */
  name: string;
}

// CW Enterprise's logo is its name set in the heading font, as on the earlier site; an uploaded logo replaces it at
// the same height.
export function Wordmark({ content, className = "", onDark = false }: { content: LogoContent; className?: string; onDark?: boolean }) {
  if (content.logo.kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={withBasePath(content.logo.image.src)} alt={content.logo.image.alt || content.name} width={900} height={320} className={`wordmark h-10 w-auto sm:h-12 ${className}`} />;
  }
  return (
    <span className={`wordmark wordmark-text ${onDark ? "wordmark-text--light" : ""} ${className}`} aria-label={content.name}>
      {content.name}
    </span>
  );
}
