import * as Crypto from "expo-crypto";
import { getDeviceUserId } from "../lib/device-user";
import { supabase } from "../lib/supabase";
import { findFirstBaby } from "./babies";

export type NewActivity = {
  milkMl: number | null;
  peeLevel: number | null;
  poopLevel: number | null;
  bath: boolean;
  occurredAt: number;
};

const requireBabyId = async (): Promise<string> => {
  const baby = await findFirstBaby();
  if (!baby) throw new Error("No baby profile");
  return baby.id;
};

export const createActivity = async (input: NewActivity): Promise<string> => {
  const babyId = await requireBabyId();
  const userId = await getDeviceUserId();
  const id = Crypto.randomUUID();
  const now = Date.now();

  const { error } = await supabase.from("activities").insert({
    id,
    baby_id: babyId,
    created_by_user_id: userId,
    occurred_at: input.occurredAt,
    milk_ml: input.milkMl,
    pee_level: input.peeLevel,
    poop_level: input.poopLevel,
    bath: input.bath ? 1 : 0,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return id;
};

export const updateActivity = async (
  id: string,
  input: NewActivity,
): Promise<void> => {
  const userId = await getDeviceUserId();
  const { error } = await supabase
    .from("activities")
    .update({
      occurred_at: input.occurredAt,
      milk_ml: input.milkMl,
      pee_level: input.peeLevel,
      poop_level: input.poopLevel,
      bath: input.bath ? 1 : 0,
      updated_by_user_id: userId,
      updated_at: Date.now(),
    })
    .eq("id", id);
  if (error) throw error;
};

// Soft delete so other devices can sync the removal.
export const deleteActivity = async (id: string): Promise<void> => {
  const now = Date.now();
  const { error } = await supabase
    .from("activities")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id);
  if (error) throw error;
};

export const loadLastMilkMl = async (): Promise<number | null> => {
  const baby = await findFirstBaby();
  if (!baby) return null;

  const { data, error } = await supabase
    .from("activities")
    .select("milk_ml")
    .eq("baby_id", baby.id)
    .is("deleted_at", null)
    .not("milk_ml", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.milk_ml ?? null;
};
