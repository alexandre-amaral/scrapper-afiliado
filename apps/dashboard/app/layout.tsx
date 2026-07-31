import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Layout raiz: só o esqueleto do documento. A barra lateral e o aviso de pausa
// ficam em (painel)/layout.tsx, para que a tela de login — que está fora desse
// grupo — não herde a navegação de quem já entrou.
export const metadata: Metadata = {
  title: {
    default: "Agente ML Afiliados",
    template: "%s · Agente ML Afiliados",
  },
  description:
    "Painel de controle do agente de ofertas do Mercado Livre para WhatsApp.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-950 font-sans text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
