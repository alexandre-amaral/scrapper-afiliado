import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** Ofertas coletadas (todas as fontes convergem aqui). Dedup por item_id. */
export const offers = sqliteTable(
  "offers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: text("item_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    price: real("price").notNull(),
    originalPrice: real("original_price"),
    discountPct: real("discount_pct"),
    freeShipping: integer("free_shipping", { mode: "boolean" }).notNull().default(false),
    imageUrl: text("image_url"),
    category: text("category"),
    seller: text("seller"),
    source: text("source", { enum: ["ml-api", "scraper", "manual"] }).notNull(),
    collectedAt: text("collected_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("offers_item_id_idx").on(t.itemId), index("offers_collected_at_idx").on(t.collectedAt)],
);

export const affiliateLinks = sqliteTable(
  "affiliate_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    offerId: integer("offer_id")
      .notNull()
      .references(() => offers.id),
    shortUrl: text("short_url").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("affiliate_links_offer_idx").on(t.offerId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    offerId: integer("offer_id")
      .notNull()
      .references(() => offers.id),
    affiliateLinkId: integer("affiliate_link_id").references(() => affiliateLinks.id),
    body: text("body").notNull(),
    status: text("status", {
      enum: ["draft", "approved", "scheduled", "sent", "failed", "rejected"],
    })
      .notNull()
      .default("draft"),
    groupId: text("group_id").notNull(),
    scheduledFor: text("scheduled_for"),
    sentAt: text("sent_at"),
    error: text("error"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("messages_status_idx").on(t.status), index("messages_group_idx").on(t.groupId)],
);

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(), // JID do WhatsApp
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  maxPerDay: integer("max_per_day").notNull().default(5),
});

/** Chave/valor JSON — settings editáveis pelo dashboard. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON serializado
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Log de execuções de jobs (coleta, disparo, renovação de sessão…). */
export const runs = sqliteTable(
  "runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    job: text("job").notNull(),
    startedAt: text("started_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    finishedAt: text("finished_at"),
    ok: integer("ok", { mode: "boolean" }),
    detail: text("detail"),
  },
  (t) => [index("runs_job_idx").on(t.job)],
);
