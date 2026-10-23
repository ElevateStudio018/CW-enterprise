"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/admin/AuthCard";
import { AdminButton } from "@/components/admin/ui/Button";
import { PasswordFields, passwordOk } from "@/components/admin/PasswordFields";
import { NotConnected } from "@/components/admin/NotConnected";
import { SkeletonLines } from "@/components/admin/ui/Skeleton";
import { useToast } from "@/components/admin/ui/Toast";
import { useAuth } from "@/contexts/admin/AuthContext";
import { errorMessage, supabase } from "@/lib/admin/supabase";
import { isConnected } from "@/lib/admin/config";

/** Where the e-mailed links (invitation, forgotten password) lead: the link has signed the person in; now they choose a password. */
function ResetForm() {
  const params = useSearchParams();
  const welcome = params.get("valkommen") === "1";
  const { status } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkProblem, setLinkProblem] = useState("");

  useEffect(() => {
    // Supabase reports an expired or used link in the address.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const problem = hash.get("error_description") ?? params.get("error_description");
    if (problem) setLinkProblem(problem);
  }, [params]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    setError("");
    if (!passwordOk(password)) {
      setError("Lösenordet uppfyller inte alla krav ännu.");
      return;
    }
    if (password !== confirm) return;
    setBusy(true);
    try {
      const { error: updateError } = await supabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Lösenordet är sparat.");
      router.replace("/admin");
    } catch (problem) {
      setError(errorMessage(problem, "Lösenordet kunde inte sparas. Försök igen."));
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <AuthCard title="Ett ögonblick…">
        <SkeletonLines lines={3} />
      </AuthCard>
    );
  }

  if (linkProblem || status === "signed-out") {
    return (
      <AuthCard title="Länken fungerar inte längre" intro="Länken har redan använts eller gått ut. Be om en ny från inloggningssidan, så kommer den direkt till din e-post.">
        <Link
          href="/admin/login"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-admin px-5 text-[15px] font-semibold text-admin-contrast hover:brightness-110"
        >
          Till inloggningen
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={welcome ? "Välkommen! Välj ditt lösenord" : "Välj ett nytt lösenord"}
      intro={welcome ? "Lösenordet använder du sedan för att logga in i adminpanelen." : "Välj ett lösenord som du inte använder någon annanstans."}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <PasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} showMismatch={tried} />
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-800">
            {error}
          </p>
        )}
        <AdminButton type="submit" variant="primary" className="w-full" busy={busy} busyLabel="Sparar…">
          Spara lösenordet
        </AdminButton>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  if (!isConnected) return <NotConnected />;
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
