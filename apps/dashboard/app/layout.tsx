import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Syne, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-syne",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-plex-mono",
  display: "swap",
});

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
    <html
      lang="pt-BR"
      className={`${syne.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
