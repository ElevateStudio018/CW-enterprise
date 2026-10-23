"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/admin/AuthContext";
import { Skeleton } from "./ui/Skeleton";

/** Admins only: anyone else goes to the sign-in page, which brings them back here afterwards. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signed-out" || status === "not-admin") {
      const next = typeof window === "undefined" ? pathname : `${pathname}${window.location.search}`;
      router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, pathname, router]);

  if (status !== "signed-in") {
    return (
      <div className="min-h-svh px-4 pt-24 lg:pl-[290px] lg:pr-8 lg:pt-28" aria-busy="true">
        <div className="mx-auto max-w-[1280px] space-y-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 max-w-full" />
          <div className="grid gap-4 pt-4 md:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
