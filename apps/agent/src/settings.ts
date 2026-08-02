import { eq } from "drizzle-orm";
import {
  agentSettingsSchema,
  settingsPatchSchema,
  type AgentSettings,
} from "@ml-agent/core";
import { settings, type Db } from "@ml-agent/db";

/** Chave única usada na tabela k/v de settings. */
const SETTINGS_KEY = "agent";

/**
 * Converte a cadência antiga (sendIntervalMinutes/sendJitterMinutes) para os
 * campos em segundos. Sem isso, um upgrade transformaria "45 minutos" no
 * default de segundos e mudaria a cadência do operador pelas costas.
 * Os campos em segundos, quando presentes, sempre vencem.
 */
function migrateCadence(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const out = { ...(raw as Record<string, unknown>) };
  const legacy: Array<[string, string]> = [
    ["sendIntervalMinutes", "sendIntervalSeconds"],
    ["sendJitterMinutes", "sendJitterSeconds"],
  ];
  for (const [oldKey, newKey] of legacy) {
    const oldValue = out[oldKey];
    if (out[newKey] === undefined && typeof oldValue === "number" && Number.isFinite(oldValue)) {
      out[newKey] = Math.round(oldValue * 60);
    }
    delete out[oldKey];
  }
  return out;
}

/**
 * Lê as settings do agente da tabela k/v.
 * Se a linha não existir (primeiro boot) ou estiver corrompida,
 * retorna os defaults do schema — nunca lança para o chamador.
 */
export async function getSettings(db: Db): Promise<AgentSettings> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);

  if (rows.length === 0) {
    return agentSettingsSchema.parse({ filters: {} });
  }

  try {
    const raw: unknown = JSON.parse(rows[0]!.value);
    // Valida e preenche defaults — tolera settings antigas com campos faltando.
    return agentSettingsSchema.parse(migrateCadence(raw));
  } catch {
    return agentSettingsSchema.parse({ filters: {} });
  }
}

/** Merge profundo simples: objetos são mesclados, arrays e escalares substituídos. */
function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = out[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      out[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Aplica um patch parcial (validado por settingsPatchSchema) sobre as settings
 * atuais, persiste e retorna o resultado completo.
 */
export async function patchSettings(db: Db, patch: unknown): Promise<AgentSettings> {
  // Aceita patch com a cadência antiga em minutos (painel desatualizado).
  const parsedPatch = settingsPatchSchema.parse(migrateCadence(patch));
  const current = await getSettings(db);

  const merged = agentSettingsSchema.parse(
    deepMerge(current as unknown as Record<string, unknown>, parsedPatch as Record<string, unknown>),
  );

  const now = new Date().toISOString();
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(merged), updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(merged), updatedAt: now },
    });

  return merged;
}
