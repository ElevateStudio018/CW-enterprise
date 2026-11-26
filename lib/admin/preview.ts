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
  /** Texts can be clicked and changed in place (the website editor; not the version preview). */
  editable?: boolean;
}

export const PREVIEW_READY = "cwe-preview-ready";

/** From the preview: a text changed in place ({ path, value }), and a section clicked ({ sectionId }). */
export const PREVIEW_EDIT = "cwe-preview-edit";
export const PREVIEW_SELECT = "cwe-preview-select";
