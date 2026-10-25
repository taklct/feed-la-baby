import { useEffect, useState, type ReactNode } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const LOCK_NAME = "feedla-db-owner";

// Only one browser tab may own the web database; other tabs wait here until it is free.
export function SingleTabGate({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!navigator.locks) {
      setIsOwner(true);
      return;
    }

    const controller = new AbortController();
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    navigator.locks
      .request(LOCK_NAME, { signal: controller.signal }, () => {
        setIsOwner(true);
        return held;
      })
      .catch(() => {});

    return () => {
      controller.abort();
      release();
    };
  }, []);

  if (isOwner) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>This app is open in another tab</Text>
      <Text style={styles.body}>
        Close the other tab to use the app here. This tab will continue
        automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 14, textAlign: "center", opacity: 0.7 },
});
