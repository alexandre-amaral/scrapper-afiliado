import "dotenv/config";
import { loadAgentEnv } from "@ml-agent/core";
import { openDb } from "@ml-agent/db";
import { buildServer } from "./api/server.js";
import { startScheduler } from "./scheduler/index.js";

async function main() {
  const env = loadAgentEnv();
  const db = openDb(env.DATABASE_PATH);

  const app = await buildServer({ env, db });
  await app.listen({ port: env.AGENT_PORT, host: "0.0.0.0" });
  app.log.info(`agente ouvindo na porta ${env.AGENT_PORT}`);

  startScheduler({ env, db, log: app.log });
}

main().catch((err) => {
  console.error("falha ao iniciar o agente:", err);
  process.exit(1);
});
