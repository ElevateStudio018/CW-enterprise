"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Images, Inbox, LayoutDashboard, LogOut, Menu, PanelsTopLeft, Settings, Sparkles, X, type LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { StatusBar } from "./StatusBar";
import { ConflictBanner } from "./ConflictBanner";
import { ResetBanner } from "./ResetBanner";
import { useAuth } from "@/contexts/admin/AuthContext";
import { useAdminData, useDraft } from "@/contexts/admin/AdminDataContext";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/hemsidan", label: "Hemsidan", icon: PanelsTopLeft },
  { href: "/admin/ai", label: "AI-assistent", icon: Sparkles },
  { href: "/admin/bilder", label: "Bilder", icon: Images },
  { href: "/admin/offertforfragningar", label: "Offertförfrågningar", icon: Inbox },
  { href: "/admin/installningar", label: "Inställningar", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname().replace(/\/$/, "");
  const { newQuotes, newSuggestions } = useAdminData();
  // What is waiting behind a page: new quote requests, and new suggestions from the staff under Hemsidan → Förslag.
  const counts: Record<string, { count: number; label: string }> = {
    "/admin/hemsidan": { count: newSuggestions, label: newSuggestions === 1 ? "1 nytt förslag" : `${newSuggestions} nya förslag` },
    "/admin/offertforfragningar": { count: newQuotes, label: `${newQuotes} nya` },
  };
  return (
    <ul className="space-y-0.5">
      {nav.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin lg:min-h-10 lg:text-[14px] ${
                active ? "bg-admin/[0.08] font-semibold text-admin-ink" : "font-medium text-admin-muted hover:bg-stone-900/[0.04] hover:text-admin-ink"
              }`}
            >
              <Icon aria-hidden="true" className={`h-[18px] w-[18px] shrink-0 ${active ? "text-admin" : ""}`} strokeWidth={2} />
              <span className="flex-1">{item.label}</span>
              {(counts[item.href]?.count ?? 0) > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-admin px-1.5 text-[11px] font-bold text-admin-contrast">
                  <span aria-hidden="true">{counts[item.href].count}</span>
                  <span className="sr-only">{counts[item.href].label}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AccountBlock() {
  const { profile, signOut } = useAuth();
  return (
    <div className="space-y-0.5 border-t border-admin-line pt-3">
      <a
        href="../"
        onClick={(event) => {
          event.preventDefault();
          window.open(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`, "_blank", "noopener");
        }}
        className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-admin-muted hover:bg-stone-900/[0.04] hover:text-admin-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
      >
        <ExternalLink aria-hidden="true" className="h-[18px] w-[18px]" />
        Visa hemsidan
      </a>
      <button
        type="button"
        onClick={() => void signOut()}
        className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[14px] font-medium text-admin-muted hover:bg-stone-900/[0.04] hover:text-admin-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
      >
        <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
        <span className="min-w-0 flex-1">
          Logga ut
          {profile?.email && <span className="block truncate text-[12px] font-normal text-admin-subtle">{profile.email}</span>}
        </span>
      </button>
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  // The company's own logo: an uploaded one once there is one (Inställningar → Hemsida), otherwise the drawn wordmark.
  const { draft } = useDraft();
  const content = { logo: draft?.settings.logo ?? ({ kind: "wordmark" } as const), name: draft?.company.shortName ?? "CW Enterprise" };
  return (
    <Link href="/admin" className="flex min-h-12 items-center gap-3 rounded-xl text-admin focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin" aria-label="Adminpanelen – dashboard">
      <Wordmark content={content} className={compact ? "origin-left scale-[0.72]" : "origin-left scale-[0.86]"} />
    </Link>
  );
}

/** The panel's frame: a sidebar on desktop; on phones and tablets a bar fixed at the top with a menu button. */
export function AdminShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  // The editor uses the whole width for its form and live preview side by side.
  const wide = pathname.startsWith("/admin/hemsidan") || pathname.startsWith("/admin/ai");

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    // No layout jump: the scrollbar's width is kept while the page behind the menu is locked.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-svh">
      <a
        href="#admin-innehall"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[500] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:shadow-lg"
      >
        Hoppa till innehållet
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-admin-line bg-white px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
          <p className="text-[12px] font-medium text-admin-subtle">Adminpanel</p>
        </div>
        <nav aria-label="Adminmeny" className="mt-7 flex-1">
          <NavLinks />
        </nav>
        <AccountBlock />
      </aside>

      {/* Phones and tablets: a bar that stays at the top while scrolling */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-admin-line bg-white/95 px-2 backdrop-blur pr-[calc(1rem+var(--scrollbar-comp,0px))] lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="admin-mobilmeny"
          aria-label="Öppna menyn"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-admin-ink hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 overflow-hidden">
          <Logo compact />
        </div>
        <StatusBar compact />
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" id="admin-mobilmeny">
          <div className="admin-fade absolute inset-0 bg-stone-950/35" aria-hidden="true" onClick={() => setMenuOpen(false)} />
          <nav aria-label="Adminmeny" className="admin-rise absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-white px-4 pb-5 pt-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Stäng menyn"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-admin-ink hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              >
                <X aria-hidden="true" className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
            <AccountBlock />
          </nav>
        </div>
      )}

      <div className="lg:pl-[264px]">
        <div className="sticky top-0 z-30 hidden h-16 items-center justify-end border-b border-admin-line bg-admin-canvas/90 px-8 backdrop-blur lg:flex">
          <StatusBar />
        </div>
        <main id="admin-innehall" tabIndex={-1} className={`mx-auto px-4 pb-16 pt-20 outline-none sm:px-6 lg:px-8 lg:pt-8 ${wide ? "max-w-[1760px]" : "max-w-[1280px]"}`}>
          <ConflictBanner />
          <ResetBanner />
          <div key={pathname} className="admin-rise">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
