import { defineConfig } from "drizzle-kit";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Caminho padrão aponta para o data dir do agente; DATABASE_PATH sobrescreve.
const url = process.env.DATABASE_PATH ?? "../../apps/agent/data/agent.sqlite";

// drizzle-kit não cria o diretório do banco — garantimos aqui (primeira execução).
mkdirSync(dirname(resolve(url)), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url },
});
