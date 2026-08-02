"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ActionAlert } from "@/components/action-alert";
import type { ActionResult } from "@/lib/action-result";
import { togglePause, triggerCollect } from "@/app/actions";
import { ui } from "@/lib/ui";

function GhostSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={ui.btnGhost}>
      {pending ? "…" : label}
    </button>
  );
}

function PrimarySubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={ui.btnPrimary}>
      {pending ? "…" : label}
    </button>
  );
}

function WarningSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-warning px-4 py-1.5 text-sm font-semibold text-bg transition-colors hover:brightness-110 disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function StatusStripActions({ paused }: { paused: boolean }) {
  const [pauseState, pauseAction] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => togglePause(formData),
    null,
  );
  const [collectState, collectAction] = useActionState<ActionResult | null, FormData>(
    async (_prev) => triggerCollect(),
    null,
  );
  const feedback = pauseState?.ok === false ? pauseState : collectState;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={pauseAction}>
          <input type="hidden" name="paused" value={String(paused)} />
          <GhostSubmit label={paused ? "Retomar" : "Pausar"} />
        </form>
        <form action={collectAction}>
          <PrimarySubmit label="Coletar agora" />
        </form>
      </div>
      <ActionAlert result={feedback} />
    </div>
  );
}

export function ResumePausedButton() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => togglePause(formData),
    null,
  );
  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action}>
        <input type="hidden" name="paused" value="true" />
        <WarningSubmit label="Retomar envios" />
      </form>
      <ActionAlert result={state} />
    </div>
  );
}
