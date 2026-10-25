import { supabase } from "../lib/supabase";
import { findFirstBaby } from "./babies";

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

// Activities for the first baby this device belongs to, between dayStart (inclusive) and dayEnd (exclusive), in ms.
export const loadHistory = async (
  dayStart: number,
  dayEnd: number,
): Promise<HistoryData> => {
  const baby = await findFirstBaby();
  if (!baby) return { babyName: null, rows: [] };

  const { data, error } = await supabase
    .from("activities")
    .select("id, occurred_at, milk_ml, pee_level, poop_level, bath")
    .eq("baby_id", baby.id)
    .is("deleted_at", null)
    .gte("occurred_at", dayStart)
    .lt("occurred_at", dayEnd)
    .order("occurred_at", { ascending: false });
  if (error) throw error;

  return {
    babyName: baby.name,
    rows: (data ?? []).map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      milk: row.milk_ml,
      pee: row.pee_level,
      poop: row.poop_level,
      bath: row.bath === 1,
    })),
  };
};
