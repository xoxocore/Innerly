"use client";

import { exportAll } from "@/lib/sync";
import { suspendPresence } from "@/lib/presence";

/** Pausing, deleting, and taking a copy of everything with you. */

async function call(action: "pause" | "resume" | "delete", password?: string) {
  const res = await fetch("/api/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, password }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? "That didn't work.");
  return body;
}

export const pauseAccount = async () => {
  suspendPresence();
  return call("pause");
};
export const resumeAccount = () => call("resume");
export const deleteAccount = (password: string) => call("delete", password);

function stamp(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/**
 * Save everything to a file.
 *
 * Plain JSON rather than a tidy PDF on purpose: the point of an export is that
 * it can be read by something other than Innerly, and reflections written over
 * a year should not need this app to still exist to be readable.
 */
export function downloadExport(email: string | null) {
  const payload = {
    app: "Innerly",
    exported_at: new Date().toISOString(),
    account: email ?? null,
    note:
      "Your own writing, exactly as Innerly stores it. Every date is ISO-8601. " +
      "Nothing here is encrypted, so keep it somewhere you would keep a diary.",
    data: exportAll(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `innerly-${stamp()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Freed on the next tick; revoking immediately can cancel the download in
  // Safari before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
