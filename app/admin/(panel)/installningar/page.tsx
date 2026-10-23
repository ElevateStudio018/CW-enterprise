"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { PublishBar } from "@/components/admin/PublishBar";
import { Tabs } from "@/components/admin/ui/Tabs";
import { CompanyTab } from "@/components/admin/settings/CompanyTab";
import { SiteTab } from "@/components/admin/settings/SiteTab";
import { CreditsTab } from "@/components/admin/settings/CreditsTab";
import { VersionsTab } from "@/components/admin/settings/VersionsTab";
import { PasswordTab } from "@/components/admin/settings/PasswordTab";
import { DangerTab } from "@/components/admin/settings/DangerTab";

const tabs = [
  { id: "foretag", label: "Företagsuppgifter" },
  { id: "hemsida", label: "Hemsidan" },
  { id: "credits", label: "Credits" },
  { id: "versioner", label: "Versionshistorik" },
  { id: "losenord", label: "Byt lösenord" },
  { id: "farozon", label: "Farozon" },
];

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("flik");
  const tab = tabs.some((item) => item.id === requested) ? (requested as string) : "foretag";

  return (
    <>
      <PageHeader title="Inställningar" description="Företagsuppgifter, hemsidans inställningar, credits, versioner och ditt lösenord." />
      {(tab === "foretag" || tab === "hemsida") && <PublishBar />}
      <div className="mb-6">
        <Tabs label="Inställningar" items={tabs} active={tab} onChange={(id) => router.replace(`${pathname}?flik=${id}`, { scroll: false })} />
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="max-w-4xl">
        {tab === "foretag" && <CompanyTab />}
        {tab === "hemsida" && <SiteTab />}
        {tab === "credits" && <CreditsTab />}
        {tab === "versioner" && <VersionsTab />}
        {tab === "losenord" && <PasswordTab />}
        {tab === "farozon" && <DangerTab />}
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
