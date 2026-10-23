import type { ReactNode } from "react";
import { Wordmark } from "@/components/Wordmark";

/** The centred card the sign-in and password pages sit in. */
export function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="admin-rise w-full max-w-[420px]">
        <div className="mb-6 flex justify-center text-admin">
          <Wordmark content={{ logo: { kind: "wordmark" }, name: "CW Enterprise" }} />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(30,30,28,0.05),0_24px_48px_-24px_rgba(30,30,28,0.25)] sm:p-8">
          <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-admin-ink">{title}</h1>
          {intro && <div className="mt-2 text-[15px] leading-relaxed text-admin-muted">{intro}</div>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
