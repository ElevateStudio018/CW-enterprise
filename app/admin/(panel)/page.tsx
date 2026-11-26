"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Globe, Images, Inbox, PanelsTopLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { PublishBar } from "@/components/admin/PublishBar";
import { Onboarding } from "@/components/admin/dashboard/Onboarding";
import { Card, CardHeader } from "@/components/admin/ui/Card";
import { buttonClasses } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { SkeletonLines } from "@/components/admin/ui/Skeleton";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useDraft } from "@/contexts/admin/AdminDataContext";
import { contentHistory, type ContentCommit } from "@/lib/admin/github";
import { formatRelative } from "@/lib/admin/dates";

function greeting(): string {
  const hour = Number(new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", timeZone: "Europe/Stockholm" }));
  return hour < 10 ? "God morgon" : hour < 18 ? "Välkommen tillbaka" : "God kväll";
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { status, publishedAt, pendingChanges, themeChanged, draft } = useDraft();
  const [lastChange, setLastChange] = useState<ContentCommit | null | undefined>(undefined);

  useEffect(() => {
    contentHistory(1)
      .then((commits) => setLastChange(commits[0] ?? null))
      .catch(() => setLastChange(null));
  }, [publishedAt]);

  const name = profile?.fullName && profile.fullName !== "Admin" ? profile.fullName.split(" ")[0] : "";
  const email = draft?.company.email;

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : `${greeting()}!`}
        description="Så går det för hemsidan just nu."
        actions={
          <Link href="/admin/hemsidan" className={buttonClasses("primary")}>
            <PanelsTopLeft aria-hidden="true" className="h-4 w-4" />
            Redigera hemsidan
          </Link>
        }
      />

      <PublishBar />
      <Onboarding />

      <div className="grid gap-4 md:grid-cols-3 lg:gap-6">
        <Card>
          <CardHeader
            title="Hemsidan"
            action={
              status === "ready" &&
              (pendingChanges > 0 || themeChanged ? <Badge tone="warning">Opublicerade ändringar</Badge> : <Badge tone="success">Publicerad</Badge>)
            }
          />
          {status !== "ready" || lastChange === undefined ? (
            <SkeletonLines lines={3} />
          ) : (
            <>
              <dl className="space-y-3 text-[14px]">
                <div>
                  <dt className="text-admin-muted">Senast publicerad</dt>
                  <dd className="font-semibold text-admin-ink">{publishedAt ? formatRelative(publishedAt) : lastChange ? formatRelative(lastChange.date) : "–"}</dd>
                </div>
                <div>
                  <dt className="text-admin-muted">Senaste ändring</dt>
                  <dd className="line-clamp-2 text-admin-ink">{lastChange?.message ?? "–"}</dd>
                </div>
              </dl>
              <a
                href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-[14px] font-semibold text-admin hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              >
                <Globe aria-hidden="true" className="h-4 w-4" /> Visa hemsidan <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Offertförfrågningar" />
          <p className="flex items-start gap-3 text-[14px] leading-relaxed text-admin-ink">
            <Inbox aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-admin" />
            <span>Förfrågningar från formuläret på hemsidan skickas med e-post och vidarebefordras till er{email ? ` (${email})` : ""}.</span>
          </p>
        </Card>

        <Card>
          <CardHeader title="Bilder" />
          <p className="text-[14px] leading-relaxed text-admin-muted">Ladda upp nya bilder och välj vilka som visas var på hemsidan.</p>
          <Link href="/admin/bilder" className={buttonClasses("secondary", "sm", "mt-4")}>
            <Images aria-hidden="true" className="h-4 w-4" /> Till bilderna
          </Link>
        </Card>
      </div>
    </>
  );
}
