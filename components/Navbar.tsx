"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { QuoteTrigger } from "./QuoteTrigger";
import { SiteLink } from "./SiteLink";
import { Wordmark, type LogoContent } from "./Wordmark";
import { toTelHref } from "@/lib/site/format.ts";

/** What the header and its menu need from the content, as it is handed to the browser. */
export interface NavContent {
  /** Shown in the bar on wide screens, after the services menu. */
  barLinks: { id: string; label: string; href: string }[];
  /** The rows of the menu on small screens; "services" rows list every service under them. */
  menu: { id: string; label: string; href: string; kind: "link" | "services" }[];
  /** The quote button's text. */
  menuButton: string;
  services: { slug: string; name: string }[];
  phone: string;
  logo: LogoContent;
  labels: {
    callPrefix: string;
    homeLink: string;
    openMenu: string;
    closeMenu: string;
    menu: string;
    mainMenu: string;
    quickLinks: string;
  };
}

/** The white header: logo, the services menu and the other pages, the phone number and the quote button. */
export function Navbar({ content }: { content: NavContent }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const servicesRow = content.menu.find((row) => row.kind === "services");
  const onService = pathname.includes("/tjanster/");

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isCurrent = (href: string) => !href.includes("#") && href !== "/" && pathname.replace(/\/$/, "").endsWith(href.replace(/\/$/, ""));

  return (
    <header className="head">
      <div className="wrap bar">
        <Link className="logo" href="/" aria-label={content.labels.homeLink}>
          <Wordmark content={content.logo} />
        </Link>
        <nav className="nav" aria-label={content.labels.mainMenu}>
          <ul>
            {servicesRow && (
              <li className={`has-sub${onService ? " on" : ""}`}>
                <Link href={servicesRow.href}>
                  {servicesRow.label}
                  <Icon name="ChevronDown" className="ic chev" />
                </Link>
                <ul className="sub">
                  {content.services.map((service) => (
                    <li key={service.slug}>
                      <Link href={`/tjanster/${service.slug}`} aria-current={pathname.includes(`/tjanster/${service.slug}`) ? "page" : undefined}>
                        {service.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {content.barLinks.map((link) => (
              <li key={link.id}>
                <SiteLink href={link.href} className={isCurrent(link.href) ? "current" : undefined}>
                  {link.label}
                </SiteLink>
              </li>
            ))}
          </ul>
        </nav>
        {content.phone && (
          <a className="head-tel" href={toTelHref(content.phone)}>
            <Icon name="Phone" className="ic" />
            {content.phone}
          </a>
        )}
        {content.menuButton && (
          <QuoteTrigger className="btn btn-dark btn-sm has-arrow head-cta">
            <span>{content.menuButton}</span>
            <span className="btn-arrow">
              <Icon name="ArrowRight" className="ic" />
            </span>
          </QuoteTrigger>
        )}
        {content.phone && (
          <a className="round" href={toTelHref(content.phone)} aria-label={`${content.labels.callPrefix} ${content.phone}`}>
            <Icon name="Phone" className="ic" />
          </a>
        )}
        <button
          className="burger"
          type="button"
          aria-expanded={open}
          aria-controls="meny"
          aria-label={open ? content.labels.closeMenu : content.labels.openMenu}
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      {open && (
        <nav className="menu" id="meny" aria-label={content.labels.menu}>
          <div className="wrap">
            <ul>
              {content.menu.map((row) => (
                <li key={row.id}>
                  <SiteLink href={row.href}>{row.label}</SiteLink>
                </li>
              ))}
            </ul>
            {servicesRow && (
              <>
                <p className="m-h">{servicesRow.label}</p>
                <ul>
                  {content.services.map((service) => (
                    <li key={service.slug}>
                      <Link href={`/tjanster/${service.slug}`}>{service.name}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="btns">
              {content.menuButton && (
                <QuoteTrigger className="btn btn-blue has-arrow">
                  <span>{content.menuButton}</span>
                  <span className="btn-arrow">
                    <Icon name="ArrowRight" className="ic" />
                  </span>
                </QuoteTrigger>
              )}
              {content.phone && (
                <a className="btn btn-ghost" href={toTelHref(content.phone)}>
                  <Icon name="Phone" className="ic" />
                  <span>{`${content.labels.callPrefix} ${content.phone}`}</span>
                </a>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
