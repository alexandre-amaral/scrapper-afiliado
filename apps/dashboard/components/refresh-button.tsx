"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshButton({ label = "Atualizar" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50"
    >
      {pending ? "Atualizando…" : label}
    </button>
  );
}
