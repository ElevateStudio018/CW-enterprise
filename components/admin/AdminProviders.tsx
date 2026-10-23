"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "./ui/Toast";
import { AuthProvider } from "@/contexts/admin/AuthContext";

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
