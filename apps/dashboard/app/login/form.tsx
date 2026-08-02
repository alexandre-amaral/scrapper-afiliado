"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoLogin } from "./actions";
import { ui } from "@/lib/ui";

function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`w-full ${ui.btnPrimary}`}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormularioLogin() {
  const destino = useSearchParams().get("destino") ?? "/";
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="destino" value={destino} />

      <div>
        <label htmlFor="senha" className={ui.label}>
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className={ui.input}
          placeholder="••••••••"
        />
      </div>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {estado.erro}
        </p>
      ) : null}

      <BotaoEntrar />
    </form>
  );
}
