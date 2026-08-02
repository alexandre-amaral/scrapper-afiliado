"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ActionAlert } from "@/components/action-alert";
import type { ActionResult } from "@/lib/action-result";
import { saveCredentials } from "@/app/actions";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white disabled:opacity-50"
    >
      {pending ? "Salvando…" : label}
    </button>
  );
}

/** Formulário de credenciais com feedback de erro/sucesso (evita “nada acontece”). */
export function CredentialsForm({
  children,
  submitLabel,
  className,
  inline = false,
}: {
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  /** Botão ao lado dos campos (ex.: salvar tag). */
  inline?: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveCredentials,
    null,
  );

  if (inline) {
    return (
      <div className="space-y-2">
        <form action={action} className={className}>
          {children}
          <SaveButton label={submitLabel} />
        </form>
        <ActionAlert result={state} />
      </div>
    );
  }

  return (
    <form action={action} className={className}>
      {children}
      <div className="space-y-3">
        <SaveButton label={submitLabel} />
        <ActionAlert result={state} />
      </div>
    </form>
  );
}
