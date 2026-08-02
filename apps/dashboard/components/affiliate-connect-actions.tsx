"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ActionAlert } from "@/components/action-alert";
import type { ActionResult } from "@/lib/action-result";
import {
  connectAffiliate,
  refreshAffiliateSession,
} from "@/app/actions";

function SubmitButton({
  label,
  pendingLabel,
  disabled,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const base =
    variant === "primary"
      ? "rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-yellow-400 disabled:opacity-50"
      : "rounded-lg border border-neutral-600 bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50";
  return (
    <button type="submit" disabled={disabled || pending} className={base}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AffiliateConnectActions({
  loginRunning,
  interactiveAvailable,
  sessionLabel,
}: {
  loginRunning: boolean;
  interactiveAvailable: boolean;
  sessionLabel: string;
}) {
  const [connectState, connectAction] = useActionState<ActionResult | null, FormData>(
    connectAffiliate,
    null,
  );
  const [refreshState, refreshAction] = useActionState<ActionResult | null, FormData>(
    refreshAffiliateSession,
    null,
  );

  const feedback = connectState ?? refreshState;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {interactiveAvailable ? (
          <form action={connectAction}>
            <SubmitButton
              label={
                sessionLabel === "valid" ? "Reconectar conta" : "Conectar conta de afiliado"
              }
              pendingLabel="Abrindo navegador…"
              disabled={loginRunning}
            />
          </form>
        ) : null}
        <form action={refreshAction}>
          <SubmitButton
            label="Tentar renovar sessão"
            pendingLabel="Renovando…"
            disabled={loginRunning}
            variant={interactiveAvailable ? "secondary" : "primary"}
          />
        </form>
      </div>
      <ActionAlert result={feedback} />
    </div>
  );
}
