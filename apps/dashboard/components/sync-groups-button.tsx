"use client";

import { useTransition } from "react";

/**
 * Botão que dispara a sincronização de grupos com a Evolution.
 * A operação é lenta (lista centenas de grupos), então mostramos estado
 * "Sincronizando…" e desabilitamos o botão enquanto roda.
 */
export function SyncGroupsButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => action())}
      disabled={pending}
      className="shrink-0 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50"
    >
      {pending ? "Sincronizando…" : "Sincronizar grupos"}
    </button>
  );
}
