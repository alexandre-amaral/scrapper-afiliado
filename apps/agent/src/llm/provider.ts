/**
 * Provider LLM centralizado (BYOK — Bring Your Own Key).
 *
 * Toda a criação de modelo passa por aqui: a chave vem SEMPRE do env
 * validado (nunca do ambiente implícito do SDK), o que mantém o provider
 * trocável no futuro (ex.: OpenAI, Anthropic) sem tocar no resto do pipeline.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { AgentEnv } from "@ml-agent/core";

/**
 * Retorna o LanguageModel configurado em env.LLM_MODEL.
 * Falha cedo com mensagem clara se a chave não estiver configurada.
 */
export function getModel(env: AgentEnv): LanguageModel {
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY não configurada — defina a chave no .env " +
        "(BYOK: obtenha em https://aistudio.google.com/apikey).",
    );
  }

  // Provider explícito com a chave do env — nunca depender de env ambiente do SDK.
  const google = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  return google(env.LLM_MODEL);
}
