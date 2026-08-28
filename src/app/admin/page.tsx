"use client";

import { AuthProvider } from "@/state/auth-context";
import { AdminGate } from "@/features/admin/admin-gate";
import { AdminShell } from "@/features/admin/admin-shell";

export default function AdminPage() {
  // sync={false}: the panel has no business pulling anyone's journal onto this
  // device, its own owner's included.
  return (
    <AuthProvider sync={false}>
      <AdminGate>
        <AdminShell />
      </AdminGate>
    </AuthProvider>
  );
}
