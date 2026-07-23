import { z } from "zod";

/** Env do agente, validada no boot — falha cedo com mensagem clara. */
const agentEnvSchema = z.object({
  AGENT_PORT: z.coerce.number().int().default(3001),
  AGENT_TOKEN: z.string().min(16, "AGENT_TOKEN muito curto — gere com: openssl rand -hex 32"),
  DATABASE_PATH: z.string().default("./data/agent.sqlite"),
  SESSION_ENCRYPTION_KEY: z
    .string()
    .min(32, "SESSION_ENCRYPTION_KEY muito curta — gere com: openssl rand -hex 32"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional().default(""),
  LLM_MODEL: z.string().default("gemini-2.5-flash"),
  ML_CLIENT_ID: z.string().optional().default(""),
  ML_CLIENT_SECRET: z.string().optional().default(""),
  ML_REFRESH_TOKEN: z.string().optional().default(""),
  EVOLUTION_URL: z.string().url().default("http://localhost:8080"),
  EVOLUTION_API_KEY: z.string().default(""),
  EVOLUTION_INSTANCE: z.string().default("ml-agent"),
});

export type AgentEnv = z.infer<typeof agentEnvSchema>;

export function loadAgentEnv(source: NodeJS.ProcessEnv = process.env): AgentEnv {
  const parsed = agentEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}\nVeja .env.example.`);
  }
  return parsed.data;
}
