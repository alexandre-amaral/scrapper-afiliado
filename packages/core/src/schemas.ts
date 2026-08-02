import { z } from "zod";

/** Zod schemas para validação nas bordas (API do agente, entradas do dashboard). */

export const offerSourceSchema = z.enum(["ml-api", "scraper", "manual"]);

export const messageStatusSchema = z.enum([
  "draft",
  "approved",
  "scheduled",
  "sent",
  "failed",
  "rejected",
]);

export const newOfferSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  price: z.number().positive(),
  originalPrice: z.number().positive().nullable().default(null),
  discountPct: z.number().min(0).max(100).nullable().default(null),
  freeShipping: z.boolean().default(false),
  imageUrl: z.string().url().nullable().default(null),
  category: z.string().nullable().default(null),
  seller: z.string().nullable().default(null),
  source: offerSourceSchema,
});
export type NewOfferInput = z.infer<typeof newOfferSchema>;

/** Payload da fonte manual: uma ou mais URLs de produto coladas no dashboard. */
export const manualUrlsSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
});

export const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  maxPerDay: z.number().int().min(1).max(50).default(5),
});

// Preço: aceita null/0/negativo como "sem limite" (o dashboard pode mandar 0
// para campo vazio) e normaliza para null, evitando 400 na UI.
const optionalPrice = z
  .number()
  .nullable()
  .default(null)
  .transform((v) => (v != null && v > 0 ? v : null));

export const offerFiltersSchema = z.object({
  minDiscountPct: z
    .number()
    .catch(10)
    .transform((v) => Math.min(100, Math.max(0, v)))
    .default(10),
  minPrice: optionalPrice,
  maxPrice: optionalPrice,
  blockedSellers: z.array(z.string()).default([]),
  blockedCategories: z.array(z.string()).default([]),
  dedupWindowHours: z
    .number()
    .int()
    .catch(72)
    .transform((v) => Math.max(1, Math.round(v)))
    .default(72),
});

/**
 * Inteiro que "prende" o valor no intervalo [min, max] em vez de rejeitar.
 * Settings vêm de formulários — um campo vazio/fora do range deve cair no
 * limite mais próximo, nunca dar 400. `def` é usado quando o valor não é número.
 */
function clampedInt(min: number, max: number, def: number) {
  return z
    .number()
    .catch(def)
    .transform((v) => {
      const n = Math.round(v);
      return Math.min(max, Math.max(min, n));
    });
}

/**
 * Piso do intervalo entre envios. 5 segundos existe para permitir teste real
 * no painel; a cadência de produção continua sendo minutos (ver aviso na UI).
 */
export const MIN_SEND_INTERVAL_SECONDS = 5;
/** Teto: 24 horas entre envios. */
export const MAX_SEND_INTERVAL_SECONDS = 86_400;
/** Teto do jitter: 2 horas para cada lado. */
export const MAX_SEND_JITTER_SECONDS = 7_200;

export const agentSettingsSchema = z.object({
  filters: offerFiltersSchema,
  autoApprove: z.boolean().default(false),
  sendWindowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .catch("09:00")
    .default("09:00"),
  sendWindowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .catch("21:00")
    .default("21:00"),
  // Cadência em SEGUNDOS. Settings antigas guardavam minutos
  // (sendIntervalMinutes/sendJitterMinutes) e são convertidas na leitura —
  // ver migrateCadence em apps/agent/src/settings.ts.
  sendIntervalSeconds: clampedInt(
    MIN_SEND_INTERVAL_SECONDS,
    MAX_SEND_INTERVAL_SECONDS,
    2_700,
  ).default(2_700),
  sendJitterSeconds: clampedInt(0, MAX_SEND_JITTER_SECONDS, 900).default(900),
  composerPrompt: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  rankTopN: clampedInt(1, 20, 8).default(8),
  paused: z.boolean().default(false),
});

/** Atualização parcial de settings vinda do dashboard. */
export const settingsPatchSchema = agentSettingsSchema.partial();

export const messagePatchSchema = z.object({
  body: z.string().min(1).optional(),
  status: messageStatusSchema.optional(),
  groupId: z.string().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});
