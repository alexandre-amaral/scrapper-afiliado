import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NavLinks } from "@/components/nav-links";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Agente ML Afiliados",
    template: "%s · Agente ML Afiliados",
  },
  description:
    "Painel de controle do agente de ofertas do Mercado Livre para WhatsApp.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-950 font-sans text-neutral-100 antialiased">
        <div className="flex min-h-screen">
          <aside className="hidden w-56 shrink-0 border-r border-neutral-800 bg-neutral-950 p-4 md:flex md:flex-col">
            <div className="mb-6 px-3">
              <p className="text-sm font-semibold tracking-tight text-neutral-100">
                Agente ML Afiliados
              </p>
              <p className="text-xs text-neutral-500">Painel de controle</p>
            </div>
            <NavLinks />
          </aside>
          <main className="min-w-0 flex-1 p-6 md:p-10">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
