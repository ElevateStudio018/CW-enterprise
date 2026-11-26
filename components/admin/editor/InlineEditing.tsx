"use client";

// Click-to-edit inside the preview frame. The site's components carry no edit markers; instead a clicked element is
// matched to the draft by its text: the deepest element (from the click up to its section) whose text equals a text in
// the draft. Texts in the clicked section come first, then the site-wide ones (company, menu, footer, buttons). A
// matched text becomes editable in place and every keystroke is sent to the editor, which saves it to the draft like a
// field in the side panel. A click anywhere else in a section opens that section in the side panel.
import { useEffect, useRef } from "react";
import type { SiteData } from "@/lib/site/schema.ts";
import { PREVIEW_EDIT, PREVIEW_SELECT } from "@/lib/admin/preview";

type Candidate = { path: string[]; value: string };

/** Keys whose strings are not text a visitor reads (addresses, ids, colours, icons, layout choices). */
const SKIP = /^(id|type|kind|slug|href|url|src|icon|variant|layout|focus|imageId|tone|color|family|category|order|style|align|ratio)$/i;

function collect(value: unknown, path: string[], out: Candidate[]) {
  if (typeof value === "string") {
    const text = value.trim();
    if (text.length > 0 && !/^(https?:|\/|#|mailto:|tel:)/.test(text)) out.push({ path, value: text });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collect(item, [...path, String(index)], out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) if (!SKIP.test(key)) collect(item, [...path, key], out);
  }
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** The section marker nearest before an element in document order (each section starts with one in the preview). */
function sectionOf(element: Element): string | null {
  const markers = Array.from(document.querySelectorAll<HTMLElement>("[data-preview-section]"));
  let found: string | null = null;
  for (const marker of markers) {
    if (marker.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) found = marker.dataset.previewSection ?? null;
    else break;
  }
  return element.closest("footer, header, nav") ? null : found;
}

function candidates(site: SiteData, pageId: string | undefined, sectionId: string | null): Candidate[][] {
  const local: Candidate[] = [];
  if (pageId && sectionId) {
    const section = site.pages.items[pageId]?.sections.items[sectionId];
    if (section) collect(section, ["pages", "items", pageId, "sections", "items", sectionId], local);
  }
  const global: Candidate[] = [];
  for (const [key, value] of Object.entries(site)) if (key !== "pages" && key !== "theme") collect(value, [key], global);
  return [local, global];
}

/** The draft path an element shows, if its text is one of the draft's texts. */
function match(element: HTMLElement, site: SiteData, pageId: string | undefined): { element: HTMLElement; path: string[]; value: string } | null {
  const sectionId = sectionOf(element);
  const groups = candidates(site, pageId, sectionId);
  for (let node: HTMLElement | null = element; node && node !== document.body; node = node.parentElement) {
    if (node.matches("main, section, footer, header, nav, [data-preview-section]")) break;
    const text = normalize(node.textContent ?? "");
    if (!text || text.length > 2000) continue;
    for (const group of groups) {
      const hits = group.filter((candidate) => normalize(candidate.value) === text);
      if (hits.length === 0) continue;
      // The same text more than once: pair the n-th such element on the page with the n-th such text in the draft.
      const same = Array.from(document.querySelectorAll<HTMLElement>(node.tagName)).filter((other) => normalize(other.textContent ?? "") === text);
      const hit = hits[Math.min(Math.max(0, same.indexOf(node)), hits.length - 1)];
      return { element: node, path: hit.path, value: hit.value };
    }
  }
  return null;
}

export function InlineEditing({
  site,
  pageId,
  onEditingChange,
  onSelectSection,
}: {
  site: SiteData;
  pageId: string | undefined;
  /** Editing starts (true) and ends (false): the preview holds back re-renders while text is typed into it. */
  onEditingChange: (editing: boolean) => void;
  /** A section was clicked: the editor opens it, and it is already in view, so the preview does not scroll to it. */
  onSelectSection: (sectionId: string) => void;
}) {
  const selectRef = useRef(onSelectSection);
  selectRef.current = onSelectSection;
  const siteRef = useRef(site);
  siteRef.current = site;
  const pageRef = useRef(pageId);
  pageRef.current = pageId;
  const editingRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      [data-inline-hover]{outline:2px dashed rgba(37,99,235,.85)!important;outline-offset:3px;cursor:text!important}
      [data-inline-editing]{outline:2px solid rgb(37,99,235)!important;outline-offset:3px;cursor:text!important;background:rgba(37,99,235,.06)}
      [data-inline-editing]:focus{outline:2px solid rgb(37,99,235)!important}
    `;
    document.head.appendChild(style);
    let hovered: HTMLElement | null = null;
    const post = (message: unknown) => window.parent?.postMessage(message, window.location.origin);

    function clearHover() {
      hovered?.removeAttribute("data-inline-hover");
      hovered = null;
    }

    function onOver(event: MouseEvent) {
      if (editingRef.current) return;
      const found = match(event.target as HTMLElement, siteRef.current, pageRef.current);
      if (found?.element === hovered) return;
      clearHover();
      if (found) {
        hovered = found.element;
        hovered.setAttribute("data-inline-hover", "");
      }
    }

    function finish() {
      const element = editingRef.current;
      if (!element) return;
      editingRef.current = null;
      element.removeAttribute("contenteditable");
      element.removeAttribute("data-inline-editing");
      element.blur();
      onEditingChange(false);
    }

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (editingRef.current?.contains(target)) return;
      finish();
      const found = match(target, siteRef.current, pageRef.current);
      const sectionId = sectionOf(target);
      if (sectionId) {
        selectRef.current(sectionId);
        post({ type: PREVIEW_SELECT, sectionId });
      }
      if (!found) return;
      event.preventDefault();
      event.stopPropagation();
      clearHover();
      const { element, path, value } = found;
      const multiline = value.includes("\n");
      editingRef.current = element;
      onEditingChange(true);
      element.setAttribute("data-inline-editing", "");
      element.setAttribute("contenteditable", "plaintext-only");
      if (element.contentEditable !== "plaintext-only") element.setAttribute("contenteditable", "true");
      element.focus();
      const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
      if (range) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      const send = () => {
        const text = multiline ? element.innerText.replace(/\n{3,}/g, "\n\n") : normalize(element.textContent ?? "");
        post({ type: PREVIEW_EDIT, path, value: text });
      };
      const onKey = (key: KeyboardEvent) => {
        if (key.key === "Escape" || (key.key === "Enter" && !multiline && !key.shiftKey)) {
          key.preventDefault();
          finish();
        }
      };
      const onPaste = (paste: ClipboardEvent) => {
        // Plain text only, whatever was copied.
        paste.preventDefault();
        const text = paste.clipboardData?.getData("text/plain") ?? "";
        document.execCommand("insertText", false, multiline ? text : text.replace(/\s+/g, " "));
      };
      element.addEventListener("input", send);
      element.addEventListener("keydown", onKey);
      element.addEventListener("paste", onPaste);
      element.addEventListener(
        "blur",
        () => {
          element.removeEventListener("input", send);
          element.removeEventListener("keydown", onKey);
          element.removeEventListener("paste", onPaste);
          finish();
        },
        { once: true }
      );
    }

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("click", onClick, true);
      style.remove();
      clearHover();
    };
  }, [onEditingChange]);

  return null;
}
