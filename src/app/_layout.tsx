import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { Suspense } from "react";
import { Platform } from "react-native";
import { LanguageProvider } from "../i18n/i18n";
import { DatabaseBoundary } from "../components/database-boundary";
import { DATABASE_NAME, initDatabase } from "../db/database";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
  });

  if (!fontsLoaded) return null;

  const app = (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </LanguageProvider>
  );

  return (
    <DatabaseBoundary>
      {Platform.OS === "web" ? (
        app
      ) : (
        <Suspense fallback={null}>
          <SQLiteProvider
            databaseName={DATABASE_NAME}
            onInit={initDatabase}
            useSuspense
          >
            {app}
          </SQLiteProvider>
        </Suspense>
      )}
    </DatabaseBoundary>
  );
}
