"use client";

import { Card, CardHeader } from "../ui/Card";
import { SkeletonLines } from "../ui/Skeleton";
import { FieldList } from "../editor/FieldEditor";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { rootFields } from "@/lib/site/labels.ts";

/** The company's details: shown in the footer, the contact section and the service pages, and told to Google. */
export function CompanyTab() {
  const { draft } = useDraft();
  if (!draft) return <SkeletonLines lines={6} />;
  return (
    <Card>
      <CardHeader
        title="Företagsuppgifter"
        description="Visas i sidfoten, vid kontaktuppgifterna och på tjänstesidorna, och hjälper Google att visa rätt uppgifter. Ändringarna syns när du publicerar."
      />
      <FieldList fields={rootFields.company} base={["company"]} object={draft.company as unknown as Record<string, unknown>} draft={draft} />
    </Card>
  );
}
