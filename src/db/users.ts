import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

// The app has no sign-in, so the device has one local user, created on first launch.
export async function getOrCreateLocalUser(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM users ORDER BY rowid LIMIT 1",
  );
  if (existing) return existing.id;

  const id = Crypto.randomUUID();
  await db.runAsync("INSERT INTO users (id, display_name) VALUES (?, NULL)", [
    id,
  ]);
  return id;
}
