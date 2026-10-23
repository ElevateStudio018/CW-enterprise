"use client";

import { FormEvent, useId, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";
import { buttonClasses, tapTarget } from "./Button";
import { useQuoteModal } from "@/contexts/QuoteModalContext";
import { fill, toTelHref } from "@/lib/site/format.ts";
import { fallbackFormEmail, isConnected, supabaseAnonKey, supabaseUrl } from "@/lib/connection";
import type { SiteData } from "@/lib/site/schema.ts";

interface FormValues {
  namn: string;
  telefon: string;
  epost: string;
  typAvArbete: string;
  beskrivning: string;
}

const initialValues: FormValues = {
  namn: "",
  telefon: "",
  epost: "",
  typAvArbete: "",
  beskrivning: "",
};

// "kontakt" is the error when neither phone nor e-mail is given; one of them is enough.
type FormErrors = Partial<Record<keyof FormValues | "kontakt", string>>;

/** What the form needs from the content: its texts, the kinds of work to choose from and the company's phone number. */
export interface QuoteFormContent {
  texts: SiteData["form"];
  workTypes: { id: string; label: string }[];
  phone: string;
}

const fieldBaseClass =
  "w-full border border-line/15 bg-field py-3.5 pl-12 pr-4 text-[17px] text-heading placeholder:text-muted transition-colors duration-150 focus:border-accent focus:outline focus:outline-2 focus:outline-accent/25";

const labelClass = "mb-2 block text-[15px] font-semibold text-heading";

// With the site connected to its backend, requests are stored for the admin's list and e-mailed by the submit-quote
// function. Without it they go by e-mail through FormSubmit (formsubmit.co) to fallbackFormEmail; the first request to a
// new address there only sends an activation e-mail, and nothing is forwarded until its link has been clicked.
const submitUrl = `https://formsubmit.co/ajax/${fallbackFormEmail}`;

const fieldIds: Record<keyof FormValues, string> = {
  namn: "namn",
  telefon: "telefon",
  epost: "epost",
  typAvArbete: "typ",
  beskrivning: "beskrivning",
};

export function QuoteForm({ variant = "inline", content }: { variant?: "inline" | "modal"; content: QuoteFormContent }) {
  const { texts, workTypes, phone } = content;
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  // Left empty by people; bots that fill in every field give themselves away.
  const [website, setWebsite] = useState("");
  const idPrefix = useId();
  const { showConfirmation, close } = useQuoteModal();

  // In the quote window the fields rise into place one after another as it opens, like the rows of the menu.
  function entrance(order: number): { className?: string; style?: CSSProperties } {
    if (variant !== "modal") return {};
    return { className: "animate-rise-fast", style: { animationDelay: `${80 + order * 45}ms` } };
  }

  // Each time the form is sent with mistakes, the fields in question give a short, gentle shake. Web Animations
  // ignore the reduced-motion rule in globals.css, hence the check.
  function shake(keys: (keyof FormErrors)[]) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fields = keys.flatMap((key) => (key === "kontakt" ? (["telefon", "epost"] as const) : [key]));
    for (const key of fields) {
      document.getElementById(`${idPrefix}-${fieldIds[key]}`)?.parentElement?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-5px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(-2px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 340, easing: "ease-out" }
      );
    }
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    const telefon = values.telefon.trim();
    const epost = values.epost.trim();
    if (!values.namn.trim()) next.namn = texts.errors.name;
    if (!telefon && !epost) next.kontakt = texts.errors.contact;
    if (telefon && !/^[\d\s()+-]{6,}$/.test(telefon)) next.telefon = texts.errors.phone;
    if (epost && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost)) next.epost = texts.errors.email;
    if (!values.typAvArbete) next.typAvArbete = texts.errors.workType;
    return next;
  }

  function handleChange<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Typing in either contact field also clears the "phone or e-mail" error.
    const cleared: (keyof FormErrors)[] = key === "telefon" || key === "epost" ? [key, "kontakt"] : [key];
    if (cleared.some((k) => errors[k])) {
      setErrors((prev) => ({ ...prev, ...Object.fromEntries(cleared.map((k) => [k, undefined])) }));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      shake(Object.keys(nextErrors) as (keyof FormErrors)[]);
      return;
    }

    setIsSubmitting(true);
    setSendFailed(false);
    try {
      const workType = workTypes.find((typ) => typ.id === values.typAvArbete)?.label ?? values.typAvArbete;
      if (isConnected) {
        const response = await fetch(`${supabaseUrl}/functions/v1/submit-quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
          body: JSON.stringify({
            name: values.namn.trim(),
            phone: values.telefon.trim(),
            email: values.epost.trim(),
            workType,
            message: values.beskrivning.trim(),
            website,
          }),
        });
        if (!response.ok) throw new Error("Not sent");
      } else {
        const response = await fetch(submitUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: fill(texts.emailSubject, { namn: values.namn.trim() }),
            _template: "table",
            _captcha: "false",
            _honey: website,
            ...(values.epost.trim() ? { _replyto: values.epost.trim() } : {}),
            Namn: values.namn.trim(),
            Telefon: values.telefon.trim() || "–",
            "E-post": values.epost.trim() || "–",
            "Typ av arbete": workType,
            Beskrivning: values.beskrivning.trim() || "–",
          }),
        });
        const result: { success?: string | boolean } | null = await response.json().catch(() => null);
        if (!response.ok || String(result?.success) !== "true") throw new Error("Not sent");
      }
      setValues(initialValues);
      showConfirmation();
    } catch {
      // Kept as typed, so it can be sent again or read out over the phone.
      setSendFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div {...entrance(0)}>
        <label htmlFor={`${idPrefix}-namn`} className={labelClass}>
          {texts.labels.name}
        </label>
        <div className="group/field relative">
          <Icon name="User" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within/field:text-accent" />
          <input
            id={`${idPrefix}-namn`}
            type="text"
            autoComplete="name"
            value={values.namn}
            onChange={(e) => handleChange("namn", e.target.value)}
            className={fieldBaseClass}
            aria-invalid={Boolean(errors.namn)}
            aria-describedby={errors.namn ? `${idPrefix}-namn-error` : undefined}
          />
        </div>
        {errors.namn && (
          <p id={`${idPrefix}-namn-error`} className="mt-1.5 animate-error-in text-[14px] text-error">
            {errors.namn}
          </p>
        )}
      </div>

      <div {...entrance(1)}>
        <label htmlFor={`${idPrefix}-telefon`} className={labelClass}>
          {texts.labels.phone}
        </label>
        <div className="group/field relative">
          <Icon name="Phone" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within/field:text-accent" />
          <input
            id={`${idPrefix}-telefon`}
            type="tel"
            autoComplete="tel"
            value={values.telefon}
            onChange={(e) => handleChange("telefon", e.target.value)}
            className={fieldBaseClass}
            aria-invalid={Boolean(errors.telefon || errors.kontakt)}
            aria-describedby={errors.telefon ? `${idPrefix}-telefon-error` : `${idPrefix}-kontakt`}
          />
        </div>
        {errors.telefon && (
          <p id={`${idPrefix}-telefon-error`} className="mt-1.5 animate-error-in text-[14px] text-error">
            {errors.telefon}
          </p>
        )}
      </div>

      <div {...entrance(2)}>
        <label htmlFor={`${idPrefix}-epost`} className={labelClass}>
          {texts.labels.email}
        </label>
        <div className="group/field relative">
          <Icon name="Mail" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within/field:text-accent" />
          <input
            id={`${idPrefix}-epost`}
            type="email"
            autoComplete="email"
            value={values.epost}
            onChange={(e) => handleChange("epost", e.target.value)}
            className={fieldBaseClass}
            aria-invalid={Boolean(errors.epost || errors.kontakt)}
            aria-describedby={errors.epost ? `${idPrefix}-epost-error` : `${idPrefix}-kontakt`}
          />
        </div>
        {errors.epost && (
          <p id={`${idPrefix}-epost-error`} className="mt-1.5 animate-error-in text-[14px] text-error">
            {errors.epost}
          </p>
        )}
        <p
          id={`${idPrefix}-kontakt`}
          className={`mt-1.5 text-[14px] ${errors.kontakt ? "animate-error-in text-error" : "text-muted"}`}
        >
          {errors.kontakt ?? texts.contactHint}
        </p>
      </div>

      <div {...entrance(3)}>
        <label htmlFor={`${idPrefix}-typ`} className={labelClass}>
          {texts.labels.workType}
        </label>
        <div className="group/field relative">
          <Icon name="Wrench" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within/field:text-accent" />
          <select
            id={`${idPrefix}-typ`}
            value={values.typAvArbete}
            onChange={(e) => handleChange("typAvArbete", e.target.value)}
            className={`${fieldBaseClass} appearance-none pr-11`}
            aria-invalid={Boolean(errors.typAvArbete)}
            aria-describedby={errors.typAvArbete ? `${idPrefix}-typ-error` : undefined}
          >
            <option value="" disabled>
              {texts.workTypePlaceholder}
            </option>
            {workTypes.map((typ) => (
              <option key={typ.id} value={typ.id}>
                {typ.label}
              </option>
            ))}
          </select>
          <Icon name="ChevronDown" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within/field:text-accent" />
        </div>
        {errors.typAvArbete && (
          <p id={`${idPrefix}-typ-error`} className="mt-1.5 animate-error-in text-[14px] text-error">
            {errors.typAvArbete}
          </p>
        )}
      </div>

      <div {...entrance(4)}>
        <label htmlFor={`${idPrefix}-beskrivning`} className={labelClass}>
          {texts.labels.description}
        </label>
        <div className="group/field relative">
          <Icon name="MessageSquare" className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-muted transition-colors duration-200 group-focus-within/field:text-accent" />
          <textarea
            id={`${idPrefix}-beskrivning`}
            rows={3}
            value={values.beskrivning}
            onChange={(e) => handleChange("beskrivning", e.target.value)}
            placeholder={texts.descriptionPlaceholder}
            className={`${fieldBaseClass} resize-none`}
          />
        </div>
      </div>

      {/* Wrapped, so the entrance doesn't hold the button's own press-in transform. */}
      <div {...entrance(5)}>
        <button type="submit" disabled={isSubmitting} className={buttonClasses("solid", "w-full disabled:opacity-70")}>
          {isSubmitting ? (
            <>
              <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
              {texts.sending}
            </>
          ) : (
            texts.submit
          )}
        </button>
        {sendFailed && (
          <p role="alert" className="mt-3 animate-error-in text-[14px] text-error">
            {texts.sendFailed}{" "}
            <a href={toTelHref(phone)} className={`${tapTarget} whitespace-nowrap font-semibold underline underline-offset-2`}>
              {phone}
            </a>
            .
          </p>
        )}
      </div>

      {variant === "modal" && (
        <p className={`text-center text-[14px] text-muted ${entrance(6).className}`} style={entrance(6).style}>
          {texts.closeHint}{" "}
          <button type="button" onClick={close} className={`${tapTarget} underline underline-offset-2`}>
            {texts.closeHintButton}
          </button>
          .
        </p>
      )}

      {/* The trap for bots: out of sight, out of the tab order and named so that autofill leaves it alone; people never fill it in. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <input type="text" name="kontrollfalt" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>
    </form>
  );
}
