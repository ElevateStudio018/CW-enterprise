"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Card, CardHeader } from "../ui/Card";
import { AdminButton } from "../ui/Button";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { PasswordFields, passwordOk } from "../PasswordFields";
import { useAuth } from "@/contexts/admin/AuthContext";
import { callFunction, errorMessage, supabase } from "@/lib/admin/supabase";

/** The current password first (checked, with the same limit on attempts as signing in), then the new one twice. */
export function PasswordTab() {
  const toast = useToast();
  const { profile } = useAuth();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    setError("");
    if (!current) return setError("Skriv ditt nuvarande lösenord.");
    if (!passwordOk(password)) return setError("Det nya lösenordet uppfyller inte alla krav nedan.");
    if (password !== confirm) return setError("Lösenorden är inte likadana.");
    if (password === current) return setError("Det nya lösenordet måste skilja sig från det nuvarande.");
    setBusy(true);
    try {
      try {
        await callFunction("admin-login", { email: profile?.email ?? "", password: current });
      } catch (failure) {
        setError(errorMessage(failure, "Det nuvarande lösenordet stämmer inte."));
        return;
      }
      const { error: updateError } = await supabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Lösenordet är bytt. Använd det nya nästa gång du loggar in.");
      setCurrent("");
      setPassword("");
      setConfirm("");
      setTried(false);
    } catch (failure) {
      setError(errorMessage(failure, "Lösenordet kunde inte bytas. Försök igen."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader title="Byt lösenord" description="Minst 12 tecken med stor och liten bokstav, en siffra och ett specialtecken." />
      <form onSubmit={(event) => void submit(event)} className="space-y-5" noValidate>
        {/* For password managers: which account the password belongs to. */}
        <input type="email" autoComplete="username" value={profile?.email ?? ""} readOnly hidden />
        <TextField label="Nuvarande lösenord" type="password" autoComplete="current-password" value={current} onChange={setCurrent} />
        <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} showMismatch={tried} />
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </p>
        )}
        <AdminButton type="submit" variant="primary" icon={KeyRound} busy={busy} busyLabel="Byter lösenord…">
          Byt lösenord
        </AdminButton>
      </form>
    </Card>
  );
}
