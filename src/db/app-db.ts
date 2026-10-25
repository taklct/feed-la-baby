import { useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import { getWebDb } from "./web-db-bridge";

export function useAppDb(): SQLiteDatabase {
  return Platform.OS === "web" ? getWebDb() : useSQLiteContext();
}
