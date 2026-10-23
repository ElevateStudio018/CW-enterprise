"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/admin/AuthCard";
import { AdminButton } from "@/components/admin/ui/Button";
import { TextField } from "@/components/admin/ui/Field";
import { NotConnected } from "@/components/admin/NotConnected";
import { useAuth } from "@/contexts/admin/AuthContext";
import { callFunction, errorMessage } from "@/lib/admin/supabase";
import { isConnected } from "@/lib/admin/config";

function LoginForm() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const destination = next && next.startsWith("/admin") ? next : "/admin";

  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "signed-in") router.replace(destination);
  }, [status, destination, router]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Fyll i både e-postadress och lösenord.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (problem) {
      setError(errorMessage(problem, "Det gick inte att logga in. Försök igen."));
      setBusy(false);
    }
  }

  async function handleForgot(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Ange din e-postadress.");
      return;
    }
    setBusy(true);
    try {
      await callFunction("admin-password-reset", { email: email.trim() });
      setMode("sent");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }

  if (mode === "sent") {
    return (
      <AuthCard title="Kolla din e-post" intro={<>Om {email.trim()} hör till adminpanelen har vi skickat en länk för att välja ett nytt lösenord. Länken fungerar i en timme.</>}>
        <AdminButton variant="secondary" className="w-full" onClick={() => setMode("login")}>
          Tillbaka till inloggningen
        </AdminButton>
      </AuthCard>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthCard title="Glömt lösenordet?" intro="Ange din e-postadress så skickar vi en länk där du väljer ett nytt lösenord.">
        <form onSubmit={handleForgot} noValidate className="space-y-4">
          <TextField label="E-postadress" type="email" autoComplete="email" value={email} onChange={setEmail} error={error || undefined} data-autofocus />
          <AdminButton type="submit" variant="primary" className="w-full" busy={busy} busyLabel="Skickar…">
            Skicka länk
          </AdminButton>
          <AdminButton variant="ghost" className="w-full" onClick={() => { setError(""); setMode("login"); }}>
            Tillbaka
          </AdminButton>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Logga in" intro="Välkommen till hemsidans adminpanel.">
      {status === "not-admin" && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          Kontot du loggade in med har inte behörighet till adminpanelen.
        </p>
      )}
      <form onSubmit={handleLogin} noValidate className="space-y-4">
        <TextField label="E-postadress" type="email" autoComplete="username" inputMode="email" value={email} onChange={setEmail} />
        <TextField label="Lösenord" type="password" autoComplete="current-password" value={password} onChange={setPassword} />
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </p>
        )}
        <AdminButton type="submit" variant="primary" className="w-full" busy={busy} busyLabel="Loggar in…">
          Logga in
        </AdminButton>
      </form>
      <button
        type="button"
        onClick={() => { setError(""); setMode("forgot"); }}
        className="mt-4 w-full rounded-xl py-2.5 text-[14px] font-semibold text-admin hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
      >
        Glömt lösenordet?
      </button>
    </AuthCard>
  );
}

export default function LoginPage() {
  if (!isConnected) return <NotConnected />;
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
