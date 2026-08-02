"use client";

import { useTransition } from "react";
import { ui } from "@/lib/ui";

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
      className={`shrink-0 ${ui.btnSecondary}`}
    >
      {pending ? "Sincronizando…" : "Sincronizar grupos"}
    </button>
  );
}
