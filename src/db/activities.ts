import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { syncOutbox } from "./sync";
import { getOrCreateLocalUser } from "./users";

export type NewActivity = {
  milkMl: number | null;
  peeLevel: number | null;
  poopLevel: number | null;
  bath: boolean;
  occurredAt: number;
};

// Records go to the first (earliest created) baby profile.
export async function createActivity(db: SQLiteDatabase, input: NewActivity) {
  const baby = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM babies WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1",
  );
  if (!baby) throw new Error("No baby profile found");

  const userId = await getOrCreateLocalUser(db);
  const id = Crypto.randomUUID();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO activities
         (id, baby_id, milk_ml, pee_level, poop_level, bath, occurred_at,
          created_by_user_id, updated_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        baby.id,
        input.milkMl,
        input.peeLevel,
        input.poopLevel,
        input.bath ? 1 : 0,
        input.occurredAt,
        userId,
        userId,
        now,
        now,
      ],
    );
    await db.runAsync(
      `INSERT INTO sync_outbox (entity_type, entity_id, operation, base_version, queued_at)
       VALUES ('activity', ?, 'upsert', 0, ?)`,
      [id, now],
    );
  });

  void syncOutbox(db);
  return id;
}

export async function deleteActivity(db: SQLiteDatabase, id: string) {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE activities SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id],
    );
    await db.runAsync(
      `INSERT INTO sync_outbox (entity_type, entity_id, operation, base_version, queued_at)
       VALUES ('activity', ?, 'delete', 0, ?)
       ON CONFLICT(entity_type, entity_id)
       DO UPDATE SET operation = 'delete', queued_at = excluded.queued_at`,
      [id, now],
    );
  });

  void syncOutbox(db);
}

// Updates the amounts and levels of an existing record; occurred_at is not changed.
export async function updateActivity(
  db: SQLiteDatabase,
  id: string,
  input: NewActivity,
) {
  const userId = await getOrCreateLocalUser(db);
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE activities
          SET milk_ml = ?, pee_level = ?, poop_level = ?, bath = ?,
              updated_by_user_id = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.milkMl,
        input.peeLevel,
        input.poopLevel,
        input.bath ? 1 : 0,
        userId,
        now,
        id,
      ],
    );
    await db.runAsync(
      `INSERT INTO sync_outbox (entity_type, entity_id, operation, base_version, queued_at)
       VALUES ('activity', ?, 'upsert', 0, ?)
       ON CONFLICT(entity_type, entity_id)
       DO UPDATE SET operation = 'upsert', queued_at = excluded.queued_at`,
      [id, now],
    );
  });

  void syncOutbox(db);
}
