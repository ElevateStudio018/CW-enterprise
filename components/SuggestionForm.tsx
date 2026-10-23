"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { buttonClasses } from "./Button";
import { Icon } from "./Icon";
import { fallbackFormEmail, isConnected, supabaseAnonKey, supabaseUrl } from "@/lib/connection";

// The suggestion box's own words: an internal tool for the company's staff, not part of the public site's content.
const NAME_KEY = "cwe-forslag-namn";
const fieldClass =
  "w-full border border-line/15 bg-field px-4 py-3.5 text-[17px] text-heading placeholder:text-muted transition-colors duration-150 focus:border-accent focus:outline focus:outline-2 focus:outline-accent/25";
const labelClass = "mb-2 block text-[15px] font-semibold text-heading";

/** Name, what it concerns and the suggestion; sent to the admin, or by e-mail while the site has no backend. */
export function SuggestionForm({ areas }: { areas: string[] }) {
  const id = useId();
  const [name, setName] = useState("");
  const [area, setArea] = useState(areas[0] ?? "");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<{ name?: string; message?: string }>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [failure, setFailure] = useState("");
  const [sentBy, setSentBy] = useState("");

  // The name is remembered on this device, so the next suggestion is quicker to write.
  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // Storage may be off.
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Skriv ditt namn.";
    if (message.trim().length < 3) next.message = "Skriv ditt förslag.";
    setErrors(next);
    if (next.name || next.message) return;
    setState("sending");
    try {
      if (isConnected) {
        const response = await fetch(`${supabaseUrl}/functions/v1/submit-suggestion`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
          body: JSON.stringify({ name: name.trim(), area, message: message.trim(), website }),
        });
        if (!response.ok) {
          // The function explains in Swedish, for example when one person has sent very many in a short time.
          const result: { message?: string } | null = await response.json().catch(() => null);
          throw new Error(response.status === 429 && result?.message ? result.message : "Not sent");
        }
      } else {
        const response = await fetch(`https://formsubmit.co/ajax/${fallbackFormEmail}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: `Förbättringsförslag från ${name.trim()}`,
            _template: "table",
            _captcha: "false",
            _honey: website,
            Från: name.trim(),
            Gäller: area,
            Förslag: message.trim(),
          }),
        });
        const result: { success?: string | boolean } | null = await response.json().catch(() => null);
        if (!response.ok || String(result?.success) !== "true") throw new Error("Not sent");
      }
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        // Not remembered; nothing else changes.
      }
      setSentBy(name.trim().split(" ")[0]);
      setMessage("");
      setState("sent");
    } catch (error) {
      setFailure(error instanceof Error && /[åäö]/i.test(error.message) ? error.message : "Förslaget kunde inte skickas. Försök igen om en stund.");
      setState("failed");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="animate-rise-fast py-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center text-accent">
          <Icon name="Check" strokeWidth={2.5} className="h-12 w-12" />
        </span>
        <p className="mt-4 text-h3 text-heading">Tack {sentBy}! Förslaget är skickat.</p>
        <p className="mt-2 text-[17px] text-body">Den som sköter hemsidan har fått det.</p>
        <button type="button" onClick={() => setState("idle")} className={buttonClasses("outline", "mt-7")}>
          Skriv ett förslag till
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative space-y-5">
      <div>
        <label htmlFor={`${id}-namn`} className={labelClass}>
          Ditt namn
        </label>
        <input
          id={`${id}-namn`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={100}
          className={fieldClass}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${id}-namn-fel` : undefined}
        />
        {errors.name && (
          <p id={`${id}-namn-fel`} className="mt-1.5 text-[14px] text-error">
            {errors.name}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-del`} className={labelClass}>
          Vad gäller det?
        </label>
        <select id={`${id}-del`} value={area} onChange={(event) => setArea(event.target.value)} className={`${fieldClass} appearance-none`}>
          {areas.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-forslag`} className={labelClass}>
          Ditt förslag
        </label>
        <textarea
          id={`${id}-forslag`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          maxLength={3000}
          placeholder="Till exempel: telefonnumret på kontaktsidan är fel, det ska vara …"
          className={`${fieldClass} resize-y leading-relaxed`}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? `${id}-forslag-fel` : undefined}
        />
        {errors.message && (
          <p id={`${id}-forslag-fel`} className="mt-1.5 text-[14px] text-error">
            {errors.message}
          </p>
        )}
      </div>
      <button type="submit" disabled={state === "sending"} className={buttonClasses("solid", "w-full disabled:opacity-70")}>
        {state === "sending" ? (
          <>
            <Icon name="Loader2" className="h-5 w-5 animate-spin" />
            Skickar…
          </>
        ) : (
          "Skicka förslaget"
        )}
      </button>
      {state === "failed" && (
        <p role="alert" className="text-[14px] text-error">
          {failure}
        </p>
      )}
      {/* The trap for bots: out of sight, out of the tab order and named so that autofill leaves it alone; people never fill it in. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <input type="text" name="kontrollfalt" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>
    </form>
  );
}
