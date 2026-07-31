"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoLogin } from "./actions";

function BotaoEntrar() {
  // useFormStatus só funciona dentro do <form>, por isso o botão é um
  // componente separado: ele sabe se o envio está em andamento.
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
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
        <label
          htmlFor="senha"
          className="mb-1.5 block text-sm font-medium text-neutral-300"
        >
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-emerald-600"
          placeholder="••••••••"
        />
      </div>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-md border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300"
        >
          {estado.erro}
        </p>
      ) : null}

      <BotaoEntrar />
    </form>
  );
}
