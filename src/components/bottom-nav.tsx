import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, FONTS } from "../constants/theme";
import { useI18n } from "../i18n/i18n";

type IconName = ComponentProps<typeof FontAwesome6>["name"];
type Tab = "home" | "history" | "dashboard" | "baby";

const TABS: {
  key: Tab;
  icon: IconName;
  labelKey: "nav.home" | "nav.history" | "nav.dashboard" | "nav.baby";
  route: string;
}[] = [
  { key: "home", icon: "house", labelKey: "nav.home", route: "/home" },
  {
    key: "history",
    icon: "clock-rotate-left",
    labelKey: "nav.history",
    route: "/history",
  },
  {
    key: "dashboard",
    icon: "chart-simple",
    labelKey: "nav.dashboard",
    route: "/dashboard",
  },
  { key: "baby", icon: "baby", labelKey: "nav.baby", route: "/baby-profile" },
];

export function BottomNav({ active }: { active: Tab }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <View style={styles.nav}>
      {TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={on ? undefined : () => router.navigate(tab.route)}
            style={styles.tab}
          >
            <View style={[styles.pill, on && styles.pillActive]}>
              <FontAwesome6
                name={tab.icon}
                size={16}
                color={on ? COLORS.blue700 : "#8C948F"}
              />
            </View>
            <Text style={[styles.label, on && styles.labelActive]}>
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  tab: {
    alignItems: "center",
    gap: 4,
  },
  pill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: {
    backgroundColor: COLORS.blue100,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: "#8C948F",
  },
  labelActive: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.blue700,
  },
});
