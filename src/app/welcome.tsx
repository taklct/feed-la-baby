import { FontAwesome6 } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { loadBabyProfile } from "../db/babies";
import { useI18n } from "../i18n/i18n";
import { COLORS, FONTS } from "../constants/theme";

const HERO_IMAGE_URI =
  "https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_bbbe0f6c05_10c3972e39a62593.png";

export default function WelcomeScreen() {
  const { t } = useI18n();

  useEffect(() => {
    loadBabyProfile().then((baby) => {
      if (baby) router.replace("/home");
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoTile}>
            <Svg width={24} height={29} viewBox="0 0 20 24">
              <Path
                d="M8 1.5h4a.8.8 0 0 1 .8.8V4H7.2V2.3a.8.8 0 0 1 .8-.8Z"
                fill="#FFFFFF"
              />
              <Rect
                x={5}
                y={4.2}
                width={10}
                height={2.6}
                rx={1.3}
                fill="#FFFFFF"
              />
              <Path
                d="M5.6 8h8.8a1 1 0 0 1 1 1v11.2a2.6 2.6 0 0 1-2.6 2.6H7.2a2.6 2.6 0 0 1-2.6-2.6V9a1 1 0 0 1 1-1Z"
                fill="#FFFFFF"
                fillOpacity={0.95}
              />
              <Path
                d="M4.6 15.2h10.8v5a2.6 2.6 0 0 1-2.6 2.6H7.2a2.6 2.6 0 0 1-2.6-2.6v-5Z"
                fill="#E1EEF9"
              />
              <Rect
                x={8}
                y={11}
                width={4}
                height={1.3}
                rx={0.65}
                fill="#A7C7E7"
              />
            </Svg>
          </View>
          <Text style={styles.brand}>Feedla</Text>
        </View>

        <View style={styles.heroFrame}>
          <View style={styles.heroCard}>
            <Image
              source={{ uri: HERO_IMAGE_URI }}
              style={styles.heroImage}
              contentFit="cover"
              accessibilityLabel="A happy baby resting comfortably on a soft blanket"
            />
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{t("welcome.tagline")}</Text>
          <Text style={styles.subtitle}>{t("welcome.subtitle")}</Text>
        </View>

        <View style={styles.cta}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started and set up your baby's profile"
            onPress={() => router.push("/baby-setup")}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>{t("welcome.getStarted")}</Text>
            <FontAwesome6 name="arrow-right" size={15} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.footer}>{t("welcome.footer")}</Text>
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
    overflow: "hidden",
  },
  glowTop: {
    position: "absolute",
    top: -96,
    left: "50%",
    marginLeft: -190,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(225, 238, 249, 0.7)",
  },
  glowBottom: {
    position: "absolute",
    bottom: 112,
    right: -96,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(243, 233, 223, 0.7)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  header: {
    alignItems: "center",
  },
  logoTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: COLORS.blue300,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.blue700,
    shadowOpacity: 0.4,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  brand: {
    marginTop: 10,
    fontFamily: FONTS.display,
    fontSize: 24,
    letterSpacing: -0.5,
    color: COLORS.ink,
  },
  heroFrame: {
    marginTop: 24,
    padding: 12,
    borderRadius: 48,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroCard: {
    width: 284,
    height: 284,
    borderRadius: 42,
    overflow: "hidden",
    backgroundColor: COLORS.blue50,
    shadowColor: COLORS.blue700,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 8,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  copy: {
    marginTop: 36,
    alignItems: "center",
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -0.68,
    textAlign: "center",
    color: COLORS.ink,
  },
  subtitle: {
    marginTop: 14,
    maxWidth: 320,
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    color: COLORS.muted,
  },
  cta: {
    marginTop: "auto",
    width: "100%",
    alignItems: "center",
  },
  button: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.blue700,
    shadowColor: COLORS.blue700,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  footer: {
    marginTop: 16,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
});
