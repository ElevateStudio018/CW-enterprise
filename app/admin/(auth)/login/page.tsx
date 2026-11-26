"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/admin/AuthCard";
import { AdminButton } from "@/components/admin/ui/Button";
import { TextField } from "@/components/admin/ui/Field";
import { useAuth } from "@/contexts/admin/AuthContext";

function LoginForm() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const destination = next && next.startsWith("/admin") ? next : "/admin";

  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "signed-in") router.replace(destination);
  }, [status, destination, router]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!key.trim()) {
      setError("Fyll i din inloggningsnyckel.");
      return;
    }
    setBusy(true);
    try {
      await signIn(key);
    } catch (problem) {
      setError(problem instanceof Error && problem.message ? problem.message : "Det gick inte att logga in. Försök igen.");
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Logga in" intro="Välkommen till hemsidans adminpanel.">
      <form onSubmit={handleLogin} noValidate className="space-y-4">
        <TextField
          label="Inloggningsnyckel"
          type="password"
          autoComplete="current-password"
          value={key}
          onChange={setKey}
          hint="Nyckeln du fått av Elevate Studio. Spara den i din lösenordshanterare."
          data-autofocus
        />
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </p>
        )}
        <AdminButton type="submit" variant="primary" className="w-full" busy={busy} busyLabel="Loggar in…">
          Logga in
        </AdminButton>
      </form>
      <p className="mt-4 text-center text-[13px] text-admin-muted">Har du tappat nyckeln? Hör av dig till Elevate Studio så får du en ny.</p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
