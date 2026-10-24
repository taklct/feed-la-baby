import { FontAwesome6 } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../constants/theme";

const OPTIONS = [
  {
    key: "create",
    icon: "plus",
    title: "Create a new baby profile",
    description: "Start fresh and set up your baby's details.",
    href: "/baby-setup",
  },
  {
    key: "join",
    icon: "user-plus",
    title: "Join an existing profile",
    description: "Enter an invite code from the parent who shared it.",
    href: "/join-baby-profile",
  },
] as const;

export default function SetProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.replace("/home")}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome6 name="arrow-left" size={15} color={COLORS.ink} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>How would you like to start?</Text>
        <Text style={styles.subtitle}>
          Create a profile for your baby, or join one someone already shared
          with you.
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              onPress={() => router.push(option.href)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.iconTile}>
                <FontAwesome6
                  name={option.icon}
                  size={18}
                  color={COLORS.blue700}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{option.title}</Text>
                <Text style={styles.cardDescription}>{option.description}</Text>
              </View>
              <FontAwesome6
                name="chevron-right"
                size={14}
                color={COLORS.muted}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: COLORS.ink,
  },
  subtitle: {
    marginTop: 10,
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
  },
  options: {
    marginTop: 32,
    gap: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.blue100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.ink,
  },
  cardDescription: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
});
