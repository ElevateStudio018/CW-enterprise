"use client";

import { Check, X } from "lucide-react";
import { TextField } from "./ui/Field";

export const passwordRules: { id: string; label: string; test: (value: string) => boolean }[] = [
  { id: "length", label: "Minst 12 tecken", test: (v) => v.length >= 12 },
  { id: "upper", label: "En stor bokstav", test: (v) => /[A-ZÅÄÖ]/.test(v) },
  { id: "lower", label: "En liten bokstav", test: (v) => /[a-zåäö]/.test(v) },
  { id: "digit", label: "En siffra", test: (v) => /\d/.test(v) },
  { id: "symbol", label: "Ett specialtecken (t.ex. ! ? # %)", test: (v) => /[^A-Za-zÅÄÖåäö0-9\s]/.test(v) },
];

export function passwordOk(value: string): boolean {
  return passwordRules.every((rule) => rule.test(value));
}

function strength(value: string): { score: number; label: string; color: string } {
  const met = passwordRules.filter((rule) => rule.test(value)).length;
  const bonus = value.length >= 16 ? 1 : 0;
  const score = Math.min(4, Math.max(0, met - 1 + bonus));
  return [
    { score: 0, label: "Mycket svagt", color: "bg-red-600" },
    { score: 1, label: "Svagt", color: "bg-red-500" },
    { score: 2, label: "Godkänt men kan bli bättre", color: "bg-amber-500" },
    { score: 3, label: "Starkt", color: "bg-emerald-600" },
    { score: 4, label: "Mycket starkt", color: "bg-emerald-700" },
  ][score];
}

/** New password twice, with the requirements ticking themselves off and a strength meter. */
export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  showMismatch,
}: {
  password: string;
  confirm: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  showMismatch: boolean;
}) {
  const level = strength(password);
  return (
    <div className="space-y-4">
      <TextField label="Nytt lösenord" type="password" autoComplete="new-password" value={password} onChange={onPassword} />
      <div aria-live="polite">
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => (
            <span key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${password && step < Math.max(1, level.score) ? level.color : "bg-stone-200"}`} />
          ))}
        </div>
        {password && <p className="mt-1.5 text-[13px] text-admin-muted">Styrka: {level.label}</p>}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {passwordRules.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={`flex items-center gap-2 text-[13px] ${ok ? "text-emerald-800" : "text-admin-muted"}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${ok ? "bg-emerald-100" : "bg-stone-100"}`}>
                {ok ? <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} /> : <X aria-hidden="true" className="h-3 w-3" />}
              </span>
              {rule.label}
              <span className="sr-only">{ok ? "– uppfyllt" : "– saknas"}</span>
            </li>
          );
        })}
      </ul>
      <TextField
        label="Upprepa lösenordet"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={onConfirm}
        error={showMismatch && confirm !== password ? "Lösenorden är inte likadana." : undefined}
      />
    </div>
  );
}
