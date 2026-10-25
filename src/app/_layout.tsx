import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { Suspense } from "react";
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

  return (
    <DatabaseBoundary>
      <Suspense fallback={null}>
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          onInit={initDatabase}
          useSuspense
        >
          <LanguageProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </LanguageProvider>
        </SQLiteProvider>
      </Suspense>
    </DatabaseBoundary>
  );
}
