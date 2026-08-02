"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ActionAlert } from "@/components/action-alert";
import type { ActionResult } from "@/lib/action-result";
import { importAffiliateCookies } from "@/app/actions";

function ImportButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-yellow-400 disabled:opacity-50"
    >
      {pending ? "Salvando sessão…" : "Salvar cookies da sessão"}
    </button>
  );
}

/**
 * Fluxo VPS: o operador loga no Chrome dele e cola os cookies no painel.
 * Não precisa de tela no servidor nem de copiar pastas via SSH.
 */
export function AffiliateCookieImport({ emphasized }: { emphasized?: boolean }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    importAffiliateCookies,
    null,
  );

  return (
    <div
      className={
        emphasized
          ? "mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4"
          : "mt-4 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4"
      }
    >
      <h3 className="text-sm font-semibold text-neutral-200">
        Colar cookies da sessão
      </h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-neutral-400">
        <li>
          No seu computador, abra o Chrome e entre em{" "}
          <a
            href="https://www.mercadolivre.com.br/afiliados/linkbuilder"
            target="_blank"
            rel="noreferrer"
            className="text-yellow-200 underline decoration-yellow-500/40 underline-offset-2 hover:text-yellow-100"
          >
            portal de afiliados
          </a>{" "}
          (faça login e o 2FA se pedir).
        </li>
        <li>
          Instale a extensão gratuita{" "}
          <a
            href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm"
            target="_blank"
            rel="noreferrer"
            className="text-yellow-200 underline decoration-yellow-500/40 underline-offset-2 hover:text-yellow-100"
          >
            Cookie-Editor
          </a>
          , clique nela na barra do Chrome e escolha{" "}
          <strong className="text-neutral-300">Export</strong> →{" "}
          <strong className="text-neutral-300">JSON</strong> (copia para a área
          de transferência).
        </li>
        <li>Cole o JSON no campo abaixo e clique em salvar.</li>
      </ol>
      <p className="mt-2 text-xs text-neutral-500">
        Também aceita o cabeçalho Cookie de um “Copiar como cURL” do DevTools
        (F12 → Network). Os cookies ficam criptografados só no agente — não
        compartilhe esse texto.
      </p>

      <form action={action} className="mt-3 space-y-3">
        <textarea
          name="cookies"
          required
          rows={5}
          spellCheck={false}
          autoComplete="off"
          placeholder='Cole aqui o JSON do Cookie-Editor (começa com [ ou { )…'
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-100 placeholder:text-neutral-600"
        />
        <div className="flex flex-wrap items-center gap-3">
          <ImportButton />
          <ActionAlert result={state} />
        </div>
      </form>
    </div>
  );
}
