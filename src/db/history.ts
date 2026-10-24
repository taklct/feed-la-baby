import type { SQLiteDatabase } from "expo-sqlite";

export type HistoryRow = {
  id: string;
  occurredAt: number;
  milk: number | null;
  pee: number | null;
  poop: number | null;
  bath: boolean;
};

export type HistoryData = {
  babyName: string | null;
  rows: HistoryRow[];
};

type ActivityRow = {
  id: string;
  milk_ml: number | null;
  pee_level: number | null;
  poop_level: number | null;
  bath: number;
  occurred_at: number;
};

// Loads activities for the baby with occurred_at in [dayStart, dayEnd), newest first.
export async function loadHistory(
  db: SQLiteDatabase,
  dayStart: number,
  dayEnd: number,
): Promise<HistoryData> {
  const baby = await db.getFirstAsync<{ id: string; name: string }>(
    `SELECT id, name FROM babies
      WHERE deleted_at IS NULL
      ORDER BY created_at
      LIMIT 1`,
  );
  if (!baby) return { babyName: null, rows: [] };

  const activities = await db.getAllAsync<ActivityRow>(
    `SELECT id, milk_ml, pee_level, poop_level, bath, occurred_at
       FROM activities
      WHERE baby_id = ?
        AND deleted_at IS NULL
        AND occurred_at >= ?
        AND occurred_at < ?
      ORDER BY occurred_at DESC`,
    [baby.id, dayStart, dayEnd],
  );

  return {
    babyName: baby.name,
    rows: activities.map((activity) => ({
      id: activity.id,
      occurredAt: activity.occurred_at,
      milk: activity.milk_ml,
      pee: activity.pee_level,
      poop: activity.poop_level,
      bath: activity.bath === 1,
    })),
  };
}
