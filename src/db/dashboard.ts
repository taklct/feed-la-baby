import type { RecordType } from "../constants/records";
import { supabase } from "../lib/supabase";
import { findFirstBaby } from "./babies";

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

const RECENT_LIMIT = 200;
const RECENT_TABLE_LIMIT = 5;
const MS_PER_MINUTE = 60 * 1000;

export async function loadDashboard(): Promise<DashboardData> {
  const baby = await findFirstBaby();
  if (!baby) return { baby: null, records: [], recent: [] };

  const { data: weight, error: weightError } = await supabase
    .from("weights")
    .select("weight_kg")
    .eq("baby_id", baby.id)
    .is("deleted_at", null)
    .order("measurement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (weightError) throw weightError;

  const { data: activities, error: activityError } = await supabase
    .from("activities")
    .select("milk_ml, pee_level, poop_level, bath, occurred_at")
    .eq("baby_id", baby.id)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(RECENT_LIMIT);
  if (activityError) throw activityError;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const midnight = startOfToday.getTime();

  const records: LogRecord[] = [];
  const recent: RecentActivity[] = [];
  for (const activity of activities ?? []) {
    const t = Math.round((activity.occurred_at - midnight) / MS_PER_MINUTE);
    const bath = activity.bath === 1;
    if (recent.length < RECENT_TABLE_LIMIT) {
      recent.push({
        t,
        milk: activity.milk_ml,
        pee: activity.pee_level,
        poop: activity.poop_level,
        bath,
      });
    }
    if (activity.milk_ml !== null) {
      records.push({ t, type: "milk", ml: activity.milk_ml });
    }
    if (activity.pee_level !== null) records.push({ t, type: "pee" });
    if (activity.poop_level !== null) records.push({ t, type: "poop" });
    if (bath) records.push({ t, type: "bath" });
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
