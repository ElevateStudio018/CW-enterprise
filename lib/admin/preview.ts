// What the editor tells the preview window: the draft, which page (or service) to show and which section to bring
// into view. Same-origin postMessage; the preview ignores anything else.
import type { SiteData } from "@/lib/site/schema.ts";

export type PreviewTarget =
  | { kind: "page"; pageId: string; sectionId?: string }
  | { kind: "service"; serviceId: string }
  | { kind: "chrome"; part: "navigation" | "footer" | "form" }
  | { kind: "notFound" }
  | { kind: "maintenance" };

export interface PreviewMessage {
  type: "cwe-preview";
  draft: SiteData;
  target: PreviewTarget;
}

export const PREVIEW_READY = "cwe-preview-ready";
