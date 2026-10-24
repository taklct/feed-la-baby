import type { SQLiteDatabase } from "expo-sqlite";
import { supabase } from "../lib/supabase";

type EntityType = "baby" | "weight" | "activity";

type OutboxRow = { id: number; entity_type: EntityType; entity_id: string };

const TABLES: Record<EntityType, string> = {
  baby: "babies",
  weight: "weights",
  activity: "activities",
};

// Owner-user columns are left out: their ids reference local users, not server users.
const PULL_COLUMNS = {
  babies: [
    "id",
    "name",
    "date_of_birth",
    "premature_status",
    "clinician_feeding_plan_status",
    "created_at",
    "updated_at",
    "deleted_at",
    "server_version",
  ],
  weights: [
    "id",
    "baby_id",
    "weight_kg",
    "measurement_date",
    "created_at",
    "updated_at",
    "deleted_at",
    "server_version",
  ],
  activities: [
    "id",
    "baby_id",
    "milk_ml",
    "pee_level",
    "poop_level",
    "bath",
    "occurred_at",
    "created_at",
    "updated_at",
    "deleted_at",
    "server_version",
  ],
} as const;

type PullTable = keyof typeof PULL_COLUMNS;

const PULL_ENTITY: Record<PullTable, EntityType> = {
  babies: "baby",
  weights: "weight",
  activities: "activity",
};

let running: Promise<void> | null = null;
let rerun = false;

// Pushes queued local writes to Supabase. Parents are queued before children, so they upload first.
export function syncOutbox(db: SQLiteDatabase): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }

  running = (async () => {
    do {
      rerun = false;
      await drainOutbox(db);
      await pullChanges(db);
    } while (rerun);
  })()
    .catch((e) => console.warn("Sync failed", e))
    .finally(() => {
      running = null;
    });

  return running;
}

async function drainOutbox(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<OutboxRow>(
    "SELECT id, entity_type, entity_id FROM sync_outbox ORDER BY id",
  );

  for (const row of rows) {
    const table = TABLES[row.entity_type];
    try {
      // Deletes are soft deletes, so the full row (including deleted_at) is always sent.
      const local = await db.getFirstAsync<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE id = ?`,
        [row.entity_id],
      );

      if (local) {
        const { error } = await supabase
          .from(table)
          .upsert(local, { onConflict: "id" });
        if (error) throw error;
      }

      await db.runAsync("DELETE FROM sync_outbox WHERE id = ?", [row.id]);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? String(e);
      await db.runAsync(
        "UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?",
        [message, row.id],
      );
      console.warn("Could not sync", row.entity_type, row.entity_id, message);
    }
  }
}

// Server rows overwrite local rows unless the local row has a change still waiting in the outbox.
async function pullChanges(db: SQLiteDatabase) {
  const babies = await db.getAllAsync<{ id: string }>("SELECT id FROM babies");
  if (babies.length === 0) return;

  const { data: babyRows, error: babyError } = await supabase
    .from("babies")
    .select("*")
    .in(
      "id",
      babies.map((b) => b.id),
    );
  if (babyError) throw babyError;
  await upsertLocal(db, "babies", babyRows ?? []);

  for (const { id: babyId } of babies) {
    const cursor = await db.getFirstAsync<{ last_synced_at: number | null }>(
      "SELECT last_synced_at FROM sync_cursors WHERE baby_id = ?",
      [babyId],
    );
    const since = cursor?.last_synced_at ?? 0;

    const { data: weightRows, error: weightError } = await supabase
      .from("weights")
      .select("*")
      .eq("baby_id", babyId)
      .gt("updated_at", since);
    if (weightError) throw weightError;

    const { data: activityRows, error: activityError } = await supabase
      .from("activities")
      .select("*")
      .eq("baby_id", babyId)
      .gt("updated_at", since);
    if (activityError) throw activityError;

    await upsertLocal(db, "weights", weightRows ?? []);
    await upsertLocal(db, "activities", activityRows ?? []);

    const newest = Math.max(
      since,
      ...[...(weightRows ?? []), ...(activityRows ?? [])].map((r) =>
        Number(r.updated_at),
      ),
    );
    await db.runAsync(
      `INSERT INTO sync_cursors (baby_id, last_synced_at) VALUES (?, ?)
       ON CONFLICT(baby_id) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
      [babyId, newest],
    );
  }
}

async function upsertLocal(
  db: SQLiteDatabase,
  table: PullTable,
  rows: Record<string, unknown>[],
) {
  const columns = PULL_COLUMNS[table];
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns
    .filter((c) => c !== "id")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updates}`;

  if (rows.length === 0) return;

  const pendingRows = await db.getAllAsync<{ entity_id: string }>(
    "SELECT entity_id FROM sync_outbox WHERE entity_type = ?",
    [PULL_ENTITY[table]],
  );
  const pending = new Set(pendingRows.map((r) => r.entity_id));

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      if (pending.has(String(row.id))) continue;

      await db.runAsync(
        sql,
        columns.map((c) => (row[c] ?? null) as string | number | null),
      );
    }
  });
}
