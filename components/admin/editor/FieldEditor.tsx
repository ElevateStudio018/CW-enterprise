"use client";

import { FieldGroup } from "../ui/FieldGroup";
import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { TextArea, TextField, controlClasses } from "../ui/Field";
import { Switch } from "../ui/Switch";
import { AdminButton } from "../ui/Button";
import { ImagePicker } from "../images/ImagePicker";
import { IconPicker } from "./IconPicker";
import { ImageField } from "./ImageField";
import { HrefField, LinkField } from "./LinkField";
import { NumberField } from "./NumberField";
import { ParagraphsField } from "./ParagraphsField";
import { SeoField } from "./SeoField";
import { SlugField, toSlug } from "./SlugField";
import { SortableList } from "./SortableList";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { list, newId } from "@/lib/site/collection.ts";
import { RESERVED_SLUGS } from "@/lib/site/pages.ts";
import { emptyItem } from "@/lib/admin/templates";
import type { Collection, ContentIcon, Link, SiteData, SiteImage } from "@/lib/site/schema.ts";
import type { FieldSpec } from "@/lib/site/labels.ts";
import type { ContentPath } from "@/lib/site/paths.ts";

type Obj = Record<string, unknown>;

/** The address a page or service has on the site, for the search preview. */
function pageUrl(draft: SiteData, base: ContentPath, object: Obj): { url: string; isHome: boolean } {
  const root = draft.settings.siteUrl.replace(/\/$/, "");
  const slug = String(object.slug ?? "");
  if (base[0] === "services") return { url: `${root}/tjanster/${slug}`, isHome: false };
  return { url: slug ? `${root}/${slug}` : `${root}/`, isHome: slug === "" };
}

/** Slugs the other items next to this one already use. */
function takenSlugs(draft: SiteData, base: ContentPath): string[] {
  const [root, , id] = base;
  if (root === "services") return list(draft.services).filter((service) => service.id !== id).map((service) => service.slug);
  if (root === "pages") return [...RESERVED_SLUGS, ...list(draft.pages).filter((page) => page.id !== id).map((page) => page.slug)];
  return [];
}

/** One field of the content, edited in place; saves itself (see DraftStore). */
export function FieldEditor({ spec, base, object, draft }: { spec: FieldSpec; base: ContentPath; object: Obj; draft: SiteData }) {
  const { store } = useDraft();
  const path = [...base, spec.key];
  const value = object[spec.key];
  const set = (next: unknown) => store.edit(path, next);

  switch (spec.kind) {
    case "text":
      return (
        <TextField
          label={spec.label}
          value={(value as string) ?? ""}
          onChange={set}
          recommended={spec.recommended}
          hint={spec.hint}
          placeholder={spec.placeholder}
          type={spec.input ?? "text"}
          inputMode={spec.input === "tel" ? "tel" : spec.input === "email" ? "email" : spec.input === "url" ? "url" : undefined}
          autoCapitalize={spec.input ? "none" : undefined}
        />
      );
    case "textarea":
      return (
        <TextArea
          label={spec.label}
          value={(value as string) ?? ""}
          onChange={set}
          recommended={spec.recommended}
          hint={spec.hint}
          placeholder={spec.placeholder}
          rows={Math.min(10, Math.max(3, Math.ceil(String(value ?? "").length / 70) + 1))}
        />
      );
    case "paragraphs":
      return <ParagraphsField label={spec.label} value={(value as string[]) ?? []} onChange={set} hint={spec.hint} />;
    case "link":
      return <LinkField label={spec.label} value={value as Link} draft={draft} onChange={set} allowEmpty />;
    case "href":
      return <HrefField label={spec.label} value={String(value ?? "")} draft={draft} onChange={set} />;
    case "optionalLink":
      return (
        <div className="space-y-3">
          <Switch
            label={spec.label}
            checked={value !== null && value !== undefined}
            onChange={(on) => set(on ? ({ label: "Kontakta oss", href: "#offert" } satisfies Link) : null)}
          />
          {value ? <LinkField label={spec.label} value={value as Link} draft={draft} onChange={set} /> : null}
        </div>
      );
    case "image":
    case "optionalImage":
      return <ImageField label={spec.label} value={(value as SiteImage) ?? null} usage={spec.imageUsage} optional={spec.kind === "optionalImage"} onChange={set} />;
    case "number":
    case "year":
    case "decimal":
      return (
        <NumberField
          label={spec.label}
          value={Number(value ?? 0)}
          onChange={set}
          decimals={spec.kind === "decimal"}
          min={spec.min}
          max={spec.max}
          hint={spec.hint}
        />
      );
    case "icon":
      return <IconPicker label={spec.label} value={value as ContentIcon} onChange={set} hint={spec.hint} />;
    case "select":
      return (
        <div>
          <label className="mb-1.5 block text-[14px] font-semibold text-admin-ink">
            {spec.label}
            <select value={String(value)} onChange={(event) => set(event.target.value)} className={`${controlClasses} mt-1.5 min-h-11 font-normal`}>
              {spec.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    case "toggle":
      return <Switch label={spec.label} checked={Boolean(value)} onChange={set} hint={spec.hint} />;
    case "slug":
      return (
        <SlugField
          label={spec.label}
          value={String(value ?? "")}
          prefix={base[0] === "services" ? "/tjanster/" : "/"}
          taken={takenSlugs(draft, base)}
          onChange={set}
          hint={spec.hint}
          suggestion={object.name ? toSlug(String(object.name)) : object.title ? toSlug(String(object.title)) : undefined}
        />
      );
    case "seo": {
      const seo = (value as { title: string; description: string }) ?? { title: "", description: "" };
      const { url, isHome } = pageUrl(draft, base, object);
      return (
        <SeoField
          label={spec.label}
          value={seo}
          url={url}
          isHome={isHome}
          siteName={draft.settings.siteName}
          onTitle={(title) => store.edit([...path, "title"], title)}
          onDescription={(description) => store.edit([...path, "description"], description)}
        />
      );
    }
    case "group":
      return (
        <FieldGroup label={spec.label} hint={spec.hint}>
          <FieldList fields={spec.fields ?? []} base={path} object={(value as Obj) ?? {}} draft={draft} />
        </FieldGroup>
      );
    case "collection":
      return <CollectionEditor spec={spec} path={path} collection={value as Collection<Obj>} draft={draft} />;
  }
}

/** The fields of one object (a section, a list item), one under the other. */
export function FieldList({ fields, base, object, draft }: { fields: FieldSpec[]; base: ContentPath; object: Obj; draft: SiteData }) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <FieldEditor key={field.key} spec={field} base={base} object={object} draft={draft} />
      ))}
    </div>
  );
}

/** A list in the content (questions, steps, people …): items open one at a time, can be added, removed and reordered. */
export function CollectionEditor({
  spec,
  path,
  collection,
  draft,
  onOpen,
  hideLegend = false,
}: {
  spec: FieldSpec;
  path: ContentPath;
  collection: Collection<Obj>;
  draft: SiteData;
  /** Told which item is open, e.g. so the preview can show it. */
  onOpen?: (id: string | null) => void;
  /** When a heading above already names the list. */
  hideLegend?: boolean;
}) {
  const { store } = useDraft();
  const item = spec.item!;
  const [openId, setOpenIdState] = useState<string | null>(null);
  const setOpenId = (id: string | null) => {
    setOpenIdState(id);
    onOpen?.(id);
  };
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const items = list(collection);
  const full = item.max !== undefined && items.length >= item.max;
  const imageField = item.fields.find((field) => field.kind === "image");

  function add(image?: SiteImage) {
    const value = emptyItem(item.fields, image);
    const id = newId(collection, `${item.label}`);
    // A new page needs an address of its own from the start; the owner can make it nicer from its name.
    for (const field of item.fields) {
      if (field.kind !== "slug") continue;
      const taken = new Set(list(collection).map((other) => String(other[field.key] ?? "")));
      let slug = toSlug(id);
      for (let n = 2; taken.has(slug); n++) slug = `${toSlug(id)}-${n}`;
      value[field.key] = slug;
    }
    store.editMany([
      { path: [...path, "items", id], op: "set", value },
      { path: [...path, "order"], op: "set", value: [...collection.order, id] },
    ]);
    setOpenId(id);
  }

  function remove(id: string) {
    store.editMany([
      { path: [...path, "items", id], op: "delete" },
      { path: [...path, "order"], op: "set", value: collection.order.filter((other) => other !== id) },
    ]);
    setConfirmRemove(null);
  }

  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 text-[14px] font-semibold text-admin-ink"}>
        {spec.label} <span className="font-normal text-admin-muted">({items.length})</span>
      </legend>
      {items.length > 0 && (
        <SortableList
          label={spec.label}
          items={items}
          onMove={(order) => store.edit([...path, "order"], order)}
          renderItem={(entry, handle, index) => {
            const title = item.titleKey ? String(entry[item.titleKey] ?? "") : "";
            const open = openId === entry.id;
            return (
              <div className="rounded-2xl bg-white ring-1 ring-admin-line">
                <div className="flex items-center gap-1 py-1 pl-1 pr-2">
                  {handle}
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : entry.id)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-admin-ink">
                      {title || `${item.label} ${index + 1}`}
                    </span>
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-admin-muted transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {confirmRemove === entry.id ? (
                    <span className="flex items-center gap-1">
                      <AdminButton size="sm" variant="danger" onClick={() => remove(entry.id)}>
                        Ta bort
                      </AdminButton>
                      <AdminButton size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Behåll
                      </AdminButton>
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Ta bort ${title || item.label.toLowerCase()}`}
                      onClick={() => setConfirmRemove(entry.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {open && (
                  <div className="border-t border-admin-line p-4">
                    <FieldList fields={item.fields} base={[...path, "items", entry.id]} object={entry} draft={draft} />
                  </div>
                )}
              </div>
            );
          }}
        />
      )}
      <AdminButton
        size="sm"
        icon={Plus}
        className="mt-3"
        disabled={full}
        onClick={() => (imageField ? setPickingImage(true) : add())}
      >
        {full ? `Max ${item.max} st` : `Lägg till ${item.label.toLowerCase()}`}
      </AdminButton>
      {imageField && (
        <ImagePicker
          open={pickingImage}
          onClose={() => setPickingImage(false)}
          usage={imageField.imageUsage}
          title={`Välj bild till ${item.label.toLowerCase()}`}
          onSelect={(image) => add(image)}
        />
      )}
    </fieldset>
  );
}
