import * as Crypto from "expo-crypto";
import { getDeviceUserId } from "../lib/device-user";
import { supabase } from "../lib/supabase";

export type NewBaby = {
  name: string;
  dateOfBirth: string;
  weightKg?: number;
  weightDate?: string;
};

export type BabyDetails = {
  name: string;
  dateOfBirth: string;
};

export type BabyRow = {
  id: string;
  name: string;
  date_of_birth: string;
  daily_milk_ref_ml: number | null;
  created_at: number;
  updated_at: number;
};

export type BabyProfile = BabyDetails & {
  id: string;
  dailyMilkRefMl: number | null;
  weights: { id: string; date: string; kg: number }[];
};

// Invite codes are the first 6 characters of the baby id.
export const inviteCodeFor = (babyId: string) =>
  babyId.slice(0, 6).toUpperCase();

// Babies this device owns or joined, via baby_members.
const myBabyIds = async (): Promise<string[]> => {
  const userId = await getDeviceUserId();
  const { data, error } = await supabase
    .from("baby_members")
    .select("baby_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.baby_id);
};

// The earliest active baby this device belongs to, or null.
export const findFirstBaby = async (): Promise<BabyRow | null> => {
  const ids = await myBabyIds();
  if (ids.length === 0) return null;
  const { data, error } = await supabase
    .from("babies")
    .select(
      "id, name, date_of_birth, daily_milk_ref_ml, created_at, updated_at",
    )
    .in("id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createBaby = async (input: NewBaby): Promise<string> => {
  const userId = await getDeviceUserId();
  const babyId = Crypto.randomUUID();
  const now = Date.now();

  const { error } = await supabase.from("babies").insert({
    id: babyId,
    owner_user_id: userId,
    name: input.name.trim(),
    date_of_birth: input.dateOfBirth,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;

  const { error: memberError } = await supabase.from("baby_members").insert({
    baby_id: babyId,
    user_id: userId,
    role: "owner",
    joined_at: now,
  });
  if (memberError) throw memberError;

  if (input.weightKg !== undefined && input.weightDate !== undefined) {
    await addWeight(babyId, input.weightKg, input.weightDate);
  }
  return babyId;
};

export const loadBabyProfile = async (): Promise<BabyProfile | null> => {
  const baby = await findFirstBaby();
  if (!baby) return null;

  const { data, error } = await supabase
    .from("weights")
    .select("id, weight_kg, measurement_date")
    .eq("baby_id", baby.id)
    .is("deleted_at", null)
    .order("measurement_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  return {
    id: baby.id,
    name: baby.name,
    dateOfBirth: baby.date_of_birth,
    dailyMilkRefMl: baby.daily_milk_ref_ml,
    weights: (data ?? []).map((w) => ({
      id: w.id,
      date: w.measurement_date,
      kg: w.weight_kg,
    })),
  };
};

export const updateBaby = async (
  babyId: string,
  input: BabyDetails,
): Promise<void> => {
  const { error } = await supabase
    .from("babies")
    .update({
      name: input.name.trim(),
      date_of_birth: input.dateOfBirth,
      updated_at: Date.now(),
    })
    .eq("id", babyId);
  if (error) throw error;
};

export const updateDailyMilkRef = async (
  babyId: string,
  ml: number | null,
): Promise<void> => {
  const { error } = await supabase
    .from("babies")
    .update({ daily_milk_ref_ml: ml, updated_at: Date.now() })
    .eq("id", babyId);
  if (error) throw error;
};

export const addWeight = async (
  babyId: string,
  kg: number,
  date: string,
): Promise<void> => {
  const now = Date.now();
  const { error } = await supabase.from("weights").insert({
    id: Crypto.randomUUID(),
    baby_id: babyId,
    weight_kg: kg,
    measurement_date: date,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
};

// Soft delete: marks the baby, its weights and its activities as deleted.
export const deleteBabyData = async (babyId: string): Promise<void> => {
  const now = Date.now();
  const softDelete = { deleted_at: now, updated_at: now };

  const { error: activityError } = await supabase
    .from("activities")
    .update(softDelete)
    .eq("baby_id", babyId)
    .is("deleted_at", null);
  if (activityError) throw activityError;

  const { error: weightError } = await supabase
    .from("weights")
    .update(softDelete)
    .eq("baby_id", babyId)
    .is("deleted_at", null);
  if (weightError) throw weightError;

  const { error } = await supabase
    .from("babies")
    .update(softDelete)
    .eq("id", babyId);
  if (error) throw error;
};

export const joinBaby = async (code: string) => {
  const userId = await getDeviceUserId();
  const { data, error } = await supabase.rpc("join_baby_by_code", {
    p_code: code,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
};
