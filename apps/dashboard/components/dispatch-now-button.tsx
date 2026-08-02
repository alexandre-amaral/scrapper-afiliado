"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ActionAlert } from "@/components/action-alert";
import { dispatchNow } from "@/app/actions";
import type { ActionResult } from "@/lib/action-result";
import { ui } from "@/lib/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={ui.btnPrimary}>
      {pending ? "Enviando…" : "Enviar uma agora"}
    </button>
  );
}

/**
 * Dispara uma mensagem da fila imediatamente. Quando nada sai, o alerta traz
 * o motivo devolvido pelo agente — é o atalho de diagnóstico do operador.
 */
export function DispatchNowButton() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async () => dispatchNow(),
    null,
  );

  return (
    <div className="space-y-2">
      <form action={action}>
        <Submit />
      </form>
      <ActionAlert result={state} />
    </div>
  );
}
