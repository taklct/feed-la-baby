import type { SQLiteDatabase } from "expo-sqlite";
import type { RecordType } from "../constants/records";

// t is minutes from local midnight today; negative values are earlier days.
export type LogRecord = { t: number; type: RecordType; ml?: number };

export type DashboardBaby = {
  name: string;
  dob: string;
  weightKg: number;
};

// One row per saved activity, used by the Recent Activities table.
export type RecentActivity = {
  t: number;
  milk: number | null;
  pee: number | null;
  poop: number | null;
  bath: boolean;
};

export type DashboardData = {
  baby: DashboardBaby | null;
  records: LogRecord[];
  recent: RecentActivity[];
};

type BabyRow = {
  id: string;
  name: string;
  date_of_birth: string;
};

type ActivityRow = {
  milk_ml: number | null;
  pee_level: number | null;
  poop_level: number | null;
  bath: number;
  occurred_at: number;
};

const RECENT_LIMIT = 200;
const RECENT_TABLE_LIMIT = 5;
const MS_PER_MINUTE = 60 * 1000;

export async function loadDashboard(
  db: SQLiteDatabase,
): Promise<DashboardData> {
  const baby = await db.getFirstAsync<BabyRow>(
    `SELECT id, name, date_of_birth
       FROM babies
      WHERE deleted_at IS NULL
      ORDER BY created_at
      LIMIT 1`,
  );
  if (!baby) return { baby: null, records: [], recent: [] };

  const weight = await db.getFirstAsync<{ weight_kg: number }>(
    `SELECT weight_kg FROM weights
      WHERE baby_id = ? AND deleted_at IS NULL
      ORDER BY measurement_date DESC, created_at DESC
      LIMIT 1`,
    [baby.id],
  );

  const activities = await db.getAllAsync<ActivityRow>(
    `SELECT milk_ml, pee_level, poop_level, bath, occurred_at
       FROM activities
      WHERE baby_id = ? AND deleted_at IS NULL
      ORDER BY occurred_at DESC
      LIMIT ?`,
    [baby.id, RECENT_LIMIT],
  );

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const midnight = startOfToday.getTime();

  const records: LogRecord[] = [];
  const recent: RecentActivity[] = [];
  for (const activity of activities) {
    const t = Math.round((activity.occurred_at - midnight) / MS_PER_MINUTE);
    if (recent.length < RECENT_TABLE_LIMIT) {
      recent.push({
        t,
        milk: activity.milk_ml,
        pee: activity.pee_level,
        poop: activity.poop_level,
        bath: activity.bath === 1,
      });
    }
    if (activity.milk_ml !== null) {
      records.push({ t, type: "milk", ml: activity.milk_ml });
    }
    if (activity.pee_level !== null) records.push({ t, type: "pee" });
    if (activity.poop_level !== null) records.push({ t, type: "poop" });
    if (activity.bath === 1) records.push({ t, type: "bath" });
  }

  return {
    baby: {
      name: baby.name,
      dob: baby.date_of_birth,
      weightKg: weight?.weight_kg ?? 0,
    },
    records,
    recent,
  };
}
