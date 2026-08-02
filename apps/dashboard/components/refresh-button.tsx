"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ui } from "@/lib/ui";

export function RefreshButton({ label = "Atualizar" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className={ui.btnSecondary}
    >
      {pending ? "Atualizando…" : label}
    </button>
  );
}
