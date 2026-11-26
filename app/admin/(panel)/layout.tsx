"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { AdminDataProvider } from "@/contexts/admin/AdminDataContext";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminDataProvider>
        <AdminShell>{children}</AdminShell>
      </AdminDataProvider>
    </ProtectedRoute>
  );
}
