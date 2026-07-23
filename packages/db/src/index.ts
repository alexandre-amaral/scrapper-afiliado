import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.js";

export * from "./schema.js";
export { schema };

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Abre (criando se necessário) o banco SQLite e aplica pragmas seguros.
 * Migrações são aplicadas via drizzle-kit (pnpm db:migrate) ou no boot do agente.
 */
export function openDb(databasePath: string): Db {
  const path = resolve(databasePath);
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}
