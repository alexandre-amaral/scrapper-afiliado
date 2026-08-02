import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioLogin } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight text-ink">
            Agente ML Afiliados
          </p>
          <p className="mt-2 text-sm text-mute">
            Digite a senha para entrar no painel
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <Suspense>
            <FormularioLogin />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-mute">
          Perdeu a senha? Peça para quem instalou o agente.
        </p>
      </div>
    </main>
  );
}
