import { supabase } from "../lib/supabase";
import { findFirstBaby } from "./babies";

export type DayStat = {
  start: number;
  isToday: boolean;
  milk: number;
  feeds: number;
  pee: number;
  poop: number;
  count: number;
  targetMl: number | null;
};

export type WeightPoint = {
  id: string;
  date: string;
  kg: number;
};

export type TrendsData = {
  baby: { name: string; dailyMilkRefMl: number | null } | null;
  days: DayStat[];
  weights: WeightPoint[];
};

const startOfDay = (time: number) => {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

// Daily totals for the last `periodDays` days (oldest first, today last) plus all weights.
export async function loadTrends(periodDays: number): Promise<TrendsData> {
  const baby = await findFirstBaby();
  if (!baby) return { baby: null, days: [], weights: [] };

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - (periodDays - 1));
  const rangeEnd = new Date(todayStart);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  const days: DayStat[] = [];
  for (let i = 0; i < periodDays; i++) {
    const day = new Date(rangeStart);
    day.setDate(rangeStart.getDate() + i);
    days.push({
      start: day.getTime(),
      isToday: i === periodDays - 1,
      milk: 0,
      feeds: 0,
      pee: 0,
      poop: 0,
      count: 0,
      targetMl: null,
    });
  }

  const { data: activities, error: activityError } = await supabase
    .from("activities")
    .select("occurred_at, milk_ml, pee_level, poop_level")
    .eq("baby_id", baby.id)
    .is("deleted_at", null)
    .gte("occurred_at", rangeStart.getTime())
    .lt("occurred_at", rangeEnd.getTime());
  if (activityError) throw activityError;

  const byStart = new Map(days.map((day) => [day.start, day]));
  for (const activity of activities ?? []) {
    const day = byStart.get(startOfDay(activity.occurred_at));
    if (!day) continue;
    day.count += 1;
    if (activity.milk_ml !== null) {
      day.milk += activity.milk_ml;
      day.feeds += 1;
    }
    if (activity.pee_level !== null) day.pee += activity.pee_level;
    if (activity.poop_level !== null) day.poop += activity.poop_level;
  }

  const { data: weights, error: weightError } = await supabase
    .from("weights")
    .select("id, weight_kg, measurement_date")
    .eq("baby_id", baby.id)
    .is("deleted_at", null)
    .order("measurement_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (weightError) throw weightError;

  const rate = baby.daily_milk_ref_ml;
  const weightList = weights ?? [];
  if (rate !== null && weightList.length > 0) {
    for (const day of days) {
      const d = new Date(day.start);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      // Weight on or before the day; falls back to the first weight.
      const weight =
        weightList.filter((w) => w.measurement_date <= key).at(-1) ??
        weightList[0];
      day.targetMl = Math.round(rate * weight.weight_kg);
    }
  }

  return {
    baby: { name: baby.name, dailyMilkRefMl: rate },
    days,
    weights: (weights ?? []).map((w) => ({
      id: w.id,
      date: w.measurement_date,
      kg: w.weight_kg,
    })),
  };
}
