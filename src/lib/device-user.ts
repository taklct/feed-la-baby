import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const STORAGE_KEY = "feedla.userId";
let cached: string | null = null;

// The app has no sign-in. Each install gets one stable user id, stored on the
// device, which is used to link the device to the babies it owns or joined.
export async function getDeviceUserId(): Promise<string> {
  if (cached) return cached;
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const id = stored ?? Crypto.randomUUID();
  if (!stored) await AsyncStorage.setItem(STORAGE_KEY, id);
  cached = id;
  return id;
}
