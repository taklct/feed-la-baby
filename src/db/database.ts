import type { SQLiteDatabase } from "expo-sqlite";
import { SCHEMA_SQL } from "./schema";
import { getOrCreateLocalUser } from "./users";

export const DATABASE_NAME = "feedla.db";

// Runs on every app start; all statements are IF NOT EXISTS, so it is safe to repeat.
export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(SCHEMA_SQL);
  await getOrCreateLocalUser(db);
}
