"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { NotConnected } from "@/components/admin/NotConnected";
import { AdminDataProvider } from "@/contexts/admin/AdminDataContext";
import { isConnected } from "@/lib/admin/config";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!isConnected) return <NotConnected />;
  return (
    <ProtectedRoute>
      <AdminDataProvider>
        <AdminShell>{children}</AdminShell>
      </AdminDataProvider>
    </ProtectedRoute>
  );
}
