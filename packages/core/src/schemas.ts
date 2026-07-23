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
  minDiscountPct: z.number().min(0).max(100).default(10),
  minPrice: optionalPrice,
  maxPrice: optionalPrice,
  blockedSellers: z.array(z.string()).default([]),
  blockedCategories: z.array(z.string()).default([]),
  dedupWindowHours: z.number().int().min(1).default(72),
});

export const agentSettingsSchema = z.object({
  filters: offerFiltersSchema,
  autoApprove: z.boolean().default(false),
  sendWindowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("09:00"),
  sendWindowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("21:00"),
  sendIntervalMinutes: z.number().int().min(5).default(45),
  sendJitterMinutes: z.number().int().min(0).default(15),
  composerPrompt: z.string().default(""),
  keywords: z.array(z.string()).default([]),
  rankTopN: z.number().int().min(1).max(20).default(8),
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
