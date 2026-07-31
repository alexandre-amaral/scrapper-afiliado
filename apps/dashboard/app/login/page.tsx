import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioLogin } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-100">
            Agente ML Afiliados
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Digite a senha para entrar no painel
          </p>
        </div>

        <Suspense>
          <FormularioLogin />
        </Suspense>

        <p className="mt-6 text-center text-xs text-neutral-600">
          Perdeu a senha? Peça para quem instalou o agente.
        </p>
      </div>
    </main>
  );
}
