"use client";

import type { ActionResult } from "@/lib/action-result";

/** Feedback inline após Server Action (sucesso ou erro). */
export function ActionAlert({ result }: { result: ActionResult | null | undefined }) {
  if (!result) return null;
  if (result.ok) {
    if (!result.message) return null;
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
      >
        {result.message}
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
    >
      {result.error}
    </p>
  );
}
