"use client";

import { useState, useTransition } from "react";
import { ActionAlert } from "@/components/action-alert";
import type { ActionResult } from "@/lib/action-result";
import { ui } from "@/lib/ui";

/**
 * Botão que dispara a sincronização de grupos com a Evolution.
 * A operação é lenta (lista centenas de grupos), então mostramos estado
 * "Sincronizando…" e desabilitamos o botão enquanto roda.
 */
export function SyncGroupsButton({
  action,
}: {
  action: () => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            const next = await action();
            setResult(next);
          })
        }
        disabled={pending}
        className={`shrink-0 ${ui.btnSecondary}`}
      >
        {pending ? "Sincronizando…" : "Sincronizar grupos"}
      </button>
      <ActionAlert result={result} />
    </div>
  );
}
