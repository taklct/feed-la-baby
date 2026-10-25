import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { supabase } from "../lib/supabase";
import { syncOutbox } from "./sync";
import { getOrCreateLocalUser } from "./users";

export type NewBaby = {
  name: string;
  dateOfBirth: string;
  weightKg?: number;
  weightDate?: string;
};

export const inviteCodeFor = (babyId: string) =>
  babyId.replace(/-/g, "").slice(0, 6).toUpperCase();

// Uploads a local baby and its owner membership so its invite code resolves on the server.
export async function publishBaby(db: SQLiteDatabase, babyId: string) {
  const baby = await db.getFirstAsync<{
    id: string;
    name: string;
    date_of_birth: string;
    created_at: number;
    updated_at: number;
  }>(
    `SELECT id, name, date_of_birth, created_at, updated_at
     FROM babies WHERE id = ?`,
    [babyId],
  );
  if (!baby) return;

  const owner = await db.getFirstAsync<{ user_id: string }>(
    "SELECT user_id FROM baby_members WHERE baby_id = ? AND role = 'owner'",
    [babyId],
  );

  const { error: babyError } = await supabase
    .from("babies")
    .upsert(
      { ...baby, owner_user_id: owner?.user_id ?? null },
      { onConflict: "id" },
    );
  if (babyError) throw babyError;

  if (owner) {
    const { error: memberError } = await supabase.from("baby_members").upsert(
      {
        baby_id: babyId,
        user_id: owner.user_id,
        role: "owner",
        joined_at: baby.created_at,
      },
      { onConflict: "baby_id,user_id" },
    );
    if (memberError) throw memberError;
  }
}

// Every local write is queued in sync_outbox so it can be synced later.
const queueUpsert = (
  db: SQLiteDatabase,
  entityType: "baby" | "weight",
  entityId: string,
  now: number,
) =>
  db.runAsync(
    `INSERT INTO sync_outbox (entity_type, entity_id, operation, base_version, queued_at)
     VALUES (?, ?, 'upsert', 0, ?)`,
    [entityType, entityId, now],
  );

export async function createBaby(db: SQLiteDatabase, input: NewBaby) {
  const now = Date.now();
  const babyId = Crypto.randomUUID();
  const userId = await getOrCreateLocalUser(db);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO babies
         (id, owner_user_id, name, date_of_birth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [babyId, userId, input.name.trim(), input.dateOfBirth, now, now],
    );
    await db.runAsync(
      `INSERT INTO baby_members (baby_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`,
      [babyId, userId, now],
    );
    await queueUpsert(db, "baby", babyId, now);

    if (input.weightKg !== undefined && input.weightDate !== undefined) {
      const weightId = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO weights (id, baby_id, weight_kg, measurement_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [weightId, babyId, input.weightKg, input.weightDate, now, now],
      );
      await queueUpsert(db, "weight", weightId, now);
    }
  });

  void syncOutbox(db);
  return babyId;
}

export type BabyDetails = {
  name: string;
  dateOfBirth: string;
};

export type BabyProfile = BabyDetails & {
  id: string;
  weights: { id: string; date: string; kg: number }[];
};

type BabyProfileRow = {
  id: string;
  name: string;
  date_of_birth: string;
};

// Weights are newest first.
export async function loadBabyProfile(
  db: SQLiteDatabase,
): Promise<BabyProfile | null> {
  const baby = await db.getFirstAsync<BabyProfileRow>(
    `SELECT id, name, date_of_birth
       FROM babies
      WHERE deleted_at IS NULL
      ORDER BY created_at
      LIMIT 1`,
  );
  if (!baby) return null;

  const weights = await db.getAllAsync<{
    id: string;
    measurement_date: string;
    weight_kg: number;
  }>(
    `SELECT id, measurement_date, weight_kg
       FROM weights
      WHERE baby_id = ? AND deleted_at IS NULL
      ORDER BY measurement_date DESC, created_at DESC`,
    [baby.id],
  );

  return {
    id: baby.id,
    name: baby.name,
    dateOfBirth: baby.date_of_birth,
    weights: weights.map((w) => ({
      id: w.id,
      date: w.measurement_date,
      kg: w.weight_kg,
    })),
  };
}

export async function updateBaby(
  db: SQLiteDatabase,
  babyId: string,
  input: BabyDetails,
) {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE babies
          SET name = ?, date_of_birth = ?, updated_at = ?
        WHERE id = ?`,
      [input.name.trim(), input.dateOfBirth, now, babyId],
    );
    await db.runAsync(
      `INSERT INTO sync_outbox (entity_type, entity_id, operation, base_version, queued_at)
       VALUES ('baby', ?, 'upsert', 0, ?)
       ON CONFLICT(entity_type, entity_id)
       DO UPDATE SET operation = 'upsert', queued_at = excluded.queued_at`,
      [babyId, now],
    );
  });

  void syncOutbox(db);
}

export type RemoteBaby = {
  id: string;
  name: string;
  date_of_birth: string;
  created_at: number;
  updated_at: number;
};

// Caches a baby joined on the server. The server already holds the membership, so nothing is queued.
export async function saveJoinedBaby(db: SQLiteDatabase, baby: RemoteBaby) {
  const userId = await getOrCreateLocalUser(db);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO babies
         (id, owner_user_id, name, date_of_birth, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         date_of_birth = excluded.date_of_birth,
         updated_at = excluded.updated_at`,
      [
        baby.id,
        baby.name,
        baby.date_of_birth,
        baby.created_at,
        baby.updated_at,
      ],
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO baby_members (baby_id, user_id, role, joined_at)
       VALUES (?, ?, 'caregiver', ?)`,
      [baby.id, userId, Date.now()],
    );
  });
}

export async function addWeight(
  db: SQLiteDatabase,
  babyId: string,
  weightKg: number,
  measurementDate: string,
) {
  const now = Date.now();
  const weightId = Crypto.randomUUID();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO weights (id, baby_id, weight_kg, measurement_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [weightId, babyId, weightKg, measurementDate, now, now],
    );
    await queueUpsert(db, "weight", weightId, now);
  });

  void syncOutbox(db);
}

const queueDeletes = (
  db: SQLiteDatabase,
  entityType: "baby" | "weight" | "activity",
  table: "babies" | "weights" | "activities",
  where: string,
  babyId: string,
  now: number,
) =>
  db.runAsync(
    `INSERT INTO sync_outbox (entity_type, entity_id, operation, base_version, queued_at)
     SELECT ?, id, 'delete', 0, ? FROM ${table}
      WHERE ${where} AND deleted_at = ?
     ON CONFLICT(entity_type, entity_id)
     DO UPDATE SET operation = 'delete', queued_at = excluded.queued_at`,
    [entityType, now, babyId, now],
  );

// Soft-deletes the baby with its activities and weights, queuing each for sync.
export async function deleteBabyData(db: SQLiteDatabase, babyId: string) {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE activities SET deleted_at = ?, updated_at = ? WHERE baby_id = ? AND deleted_at IS NULL",
      [now, now, babyId],
    );
    await db.runAsync(
      "UPDATE weights SET deleted_at = ?, updated_at = ? WHERE baby_id = ? AND deleted_at IS NULL",
      [now, now, babyId],
    );
    await db.runAsync(
      "UPDATE babies SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, babyId],
    );

    await queueDeletes(
      db,
      "activity",
      "activities",
      "baby_id = ?",
      babyId,
      now,
    );
    await queueDeletes(db, "weight", "weights", "baby_id = ?", babyId, now);
    await queueDeletes(db, "baby", "babies", "id = ?", babyId, now);
  });

  void syncOutbox(db);
}
