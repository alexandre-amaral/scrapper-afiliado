import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O dashboard é stateless: tudo passa pela API do agente via AGENT_URL/AGENT_TOKEN
  // (variáveis server-side; nunca expostas ao client).
};

export default nextConfig;
