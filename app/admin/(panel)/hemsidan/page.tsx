"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, RefreshCw, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { PublishBar } from "@/components/admin/PublishBar";
import { AdminButton } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { Tabs } from "@/components/admin/ui/Tabs";
import { controlClasses } from "@/components/admin/ui/Field";
import { PageEditor } from "@/components/admin/editor/PageEditor";
import { PartEditor, partTarget, parts } from "@/components/admin/editor/PartEditor";
import { PreviewPane } from "@/components/admin/editor/PreviewPane";
import { ColorEditor } from "@/components/admin/editor/ColorEditor";
import { FontEditor } from "@/components/admin/editor/FontEditor";
import { SuggestionsTab } from "@/components/admin/suggestions/SuggestionsTab";
import { useAdminData, useDraft } from "@/contexts/admin/AdminDataContext";
import { list } from "@/lib/site/collection.ts";
import type { PreviewTarget } from "@/lib/admin/preview";

const tabs = [
  { id: "innehall", label: "Innehåll" },
  { id: "farger", label: "Färger" },
  { id: "typsnitt", label: "Typsnitt" },
  { id: "forslag", label: "Förslag" },
];

function EditorSkeleton() {
  return (
    <div role="status" aria-label="Hemsidans innehåll laddas">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="hidden h-[70svh] w-full rounded-2xl lg:block" />
      </div>
    </div>
  );
}

function WebsiteEditor() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { status, loadError, draft, canUndo, store } = useDraft();
  const { newSuggestions } = useAdminData();
  const tab = tabs.some((item) => item.id === params.get("flik")) ? (params.get("flik") as string) : "innehall";
  const tabItems = tabs.map((item) =>
    item.id === "forslag" ? { ...item, badge: { count: newSuggestions, label: newSuggestions === 1 ? "1 nytt" : `${newSuggestions} nya` } } : item
  );
  const pageParam = params.get("sida");
  const partParam = params.get("del");
  const sectionParam = params.get("sektion");

  const [openSection, setOpenSection] = useState<string | null>(sectionParam);
  const [activeSection, setActiveSection] = useState<string | null>(sectionParam);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [previewShown, setPreviewShown] = useState(true);

  // A link to a particular section (from the dashboard or the AI) opens it.
  useEffect(() => {
    if (!sectionParam) return;
    setOpenSection(sectionParam);
    setActiveSection(sectionParam);
  }, [sectionParam]);

  function navigate(changes: Record<string, string | null>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const pages = useMemo(() => (draft ? list(draft.pages) : []), [draft]);
  const home = pages.find((page) => page.slug === "") ?? pages[0];
  const part = partParam ? parts.find((candidate) => candidate.id === partParam) : undefined;
  const page = part ? undefined : pages.find((candidate) => candidate.id === pageParam) ?? home;

  const target: PreviewTarget | null = useMemo(() => {
    if (!draft || !home) return null;
    if (tab !== "innehall") return { kind: "page", pageId: home.id };
    if (part) return partTarget(part, draft, activeItem);
    if (page) return { kind: "page", pageId: page.id, sectionId: activeSection ?? undefined };
    return null;
  }, [draft, home, tab, part, page, activeItem, activeSection]);

  const header = (
    <>
      <PageHeader
        title="Hemsidan"
        description="Allt sparas automatiskt medan du skriver. Ändringarna syns på hemsidan när du publicerar."
        actions={
          tab !== "forslag" && (
            <AdminButton icon={Undo2} onClick={() => store.undo()} disabled={!canUndo} title="Ångrar din senaste ändring (upp till 20 steg)">
              Ångra
            </AdminButton>
          )
        }
      />
      <PublishBar />
      <Tabs label="Vad du vill ändra" items={tabItems} active={tab} onChange={(id) => navigate({ flik: id === "innehall" ? null : id })} />
    </>
  );

  // The staff's suggestions need no editor or preview, so they show without waiting for the content.
  if (tab === "forslag") {
    return (
      <>
        {header}
        <div role="tabpanel" id="panel-forslag" aria-labelledby="tab-forslag" className="mt-5">
          <SuggestionsTab />
        </div>
      </>
    );
  }

  if (status === "loading") return <EditorSkeleton />;
  if (status === "error" || !draft || !home) {
    return (
      <Card className="max-w-xl">
        <h1 className="text-[20px] font-semibold text-admin-ink">Hemsidans innehåll kunde inte hämtas</h1>
        <p className="mt-2 text-[15px] text-admin-muted">{loadError ?? "Kontrollera anslutningen och försök igen."}</p>
        <AdminButton className="mt-5" icon={RefreshCw} onClick={() => void store.load()}>
          Försök igen
        </AdminButton>
      </Card>
    );
  }

  const selectValue = part ? `del:${part.id}` : `sida:${page?.id ?? home.id}`;
  const partGroups = Array.from(new Set(parts.map((candidate) => candidate.group)));

  return (
    <>
      {header}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="order-2 min-w-0 lg:order-1">
          {tab === "innehall" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="editor-part" className="mb-1.5 block text-[14px] font-semibold text-admin-ink">
                  Vad vill du redigera?
                </label>
                <select
                  id="editor-part"
                  value={selectValue}
                  onChange={(event) => {
                    const [kind, id] = event.target.value.split(":");
                    setOpenSection(null);
                    setActiveSection(null);
                    setActiveItem(null);
                    navigate(kind === "sida" ? { sida: id, del: null, sektion: null } : { del: id, sida: null, sektion: null });
                  }}
                  className={`${controlClasses} min-h-12 text-[16px] font-semibold`}
                >
                  <optgroup label="Sidor">
                    {pages.map((candidate) => (
                      <option key={candidate.id} value={`sida:${candidate.id}`}>
                        {candidate.slug ? candidate.title : "Startsidan"}
                      </option>
                    ))}
                  </optgroup>
                  {partGroups.map((group) => (
                    <optgroup key={group} label={group}>
                      {parts
                        .filter((candidate) => candidate.group === group)
                        .map((candidate) => (
                          <option key={candidate.id} value={`del:${candidate.id}`}>
                            {candidate.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {page && (
                <PageEditor
                  key={page.id}
                  pageId={page.id}
                  draft={draft}
                  openSection={openSection}
                  onOpenSection={setOpenSection}
                  onActiveSection={setActiveSection}
                />
              )}
              {part && <PartEditor key={part.id} part={part} draft={draft} onActiveItem={setActiveItem} />}
            </div>
          )}
          {tab === "farger" && <ColorEditor />}
          {tab === "typsnitt" && <FontEditor />}
        </div>

        <div className="order-1 lg:sticky lg:top-[88px] lg:order-2">
          <button
            type="button"
            aria-expanded={previewShown}
            onClick={() => setPreviewShown(!previewShown)}
            className="mb-2 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-[14px] font-semibold text-admin-muted hover:text-admin-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin lg:hidden"
          >
            {previewShown ? "Dölj förhandsvisningen" : "Visa förhandsvisningen"}
            <ChevronDown aria-hidden="true" className={`h-5 w-5 transition-transform ${previewShown ? "rotate-180" : ""}`} />
          </button>
          {target && (
            <PreviewPane
              draft={draft}
              target={target}
              className={`${previewShown ? "h-[46svh]" : "hidden"} lg:flex lg:h-[calc(100svh-112px)]`}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default function WebsiteEditorPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <WebsiteEditor />
    </Suspense>
  );
}
