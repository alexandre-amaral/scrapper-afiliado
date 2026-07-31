import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O dashboard é stateless: tudo passa pela API do agente via AGENT_URL/AGENT_TOKEN
  // (variáveis server-side; nunca expostas ao client).

  // Empacota só o necessário para rodar (server.js + node_modules usados) em
  // .next/standalone. A imagem Docker fica em centenas de MB em vez de GB,
  // porque não precisa carregar o node_modules inteiro do monorepo.
  output: "standalone",

  // O standalone rastreia dependências a partir da raiz do workspace — sem
  // isso o Next avisa que inferiu a raiz errada num monorepo pnpm.
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
