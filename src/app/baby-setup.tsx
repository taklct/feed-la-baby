import { FontAwesome6 } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSQLiteContext } from "expo-sqlite";
import { useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../constants/theme";
import { createBaby } from "../db/babies";
import { useI18n } from "../i18n/i18n";

type Status = "idle" | "creating" | "created";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value: string) =>
  DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));

// Dates are YYYY-MM-DD, so string comparison matches calendar order.
const clampToToday = (value: string, today: string) =>
  isValidDate(value) && value > today ? today : value;

const SAMPLE_NAME = "Emma";
const SAMPLE_DOB = "2026-08-18";
const SAMPLE_WEIGHT = "5.0";

const toDateString = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const todayString = () => toDateString(new Date());

// Falls back to 61 days ago when the sample date is in the future.
const sampleDobString = (today: string) => {
  if (SAMPLE_DOB <= today) return SAMPLE_DOB;
  const date = new Date();
  date.setDate(date.getDate() - 61);
  return toDateString(date);
};

export default function BabySetupScreen() {
  const { t } = useI18n();
  const today = todayString();

  const [name, setName] = useState(SAMPLE_NAME);
  const [dob, setDob] = useState(() => sampleDobString(today));
  const [dobNotice, setDobNotice] = useState(false);
  const [weight, setWeight] = useState(SAMPLE_WEIGHT);
  const [weightDate, setWeightDate] = useState(today);
  const [status, setStatus] = useState<Status>("idle");
  const db = useSQLiteContext();

  const hasWeight = weight !== "" && !Number.isNaN(parseFloat(weight));
  const canCreate = name.trim().length > 0 && isValidDate(dob);
  const isDisabled = !canCreate || status !== "idle";

  const handleDobChange = (text: string) => {
    const clamped = clampToToday(text, today);
    setDob(clamped);
    setDobNotice(clamped !== text);
  };

  const handleWeightChange = (text: string) => {
    const cleaned = text.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const [whole, ...rest] = cleaned.split(".");
    setWeight(rest.length > 0 ? `${whole}.${rest.join("")}` : whole);
  };

  const handleCreate = async () => {
    if (isDisabled) return;
    setStatus("creating");
    try {
      const parsedWeight = hasWeight ? parseFloat(weight) : NaN;
      await createBaby(db, {
        name,
        dateOfBirth: dob,
        premature: null,
        clinicianFeedingPlan: null,
        weightKg: parsedWeight > 0 ? parsedWeight : undefined,
        weightDate: isValidDate(weightDate) ? weightDate : today,
      });
      setStatus("created");
      router.replace("/home");
    } catch {
      setStatus("idle");
      Alert.alert(t("common.couldNotSave"), t("common.tryAgain"));
    }
  };

  const buttonLabel =
    status === "creating"
      ? t("setup.creating")
      : status === "created"
        ? t("setup.created")
        : t("setup.create");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.glow} pointerEvents="none" />

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("setup.title")}</Text>
        <Text style={styles.subtitle}>{t("setup.subtitle")}</Text>

        <View style={styles.form}>
          <Field label={t("setup.nameLabel")}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("setup.namePlaceholder")}
              placeholderTextColor={COLORS.placeholder}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              style={styles.input}
            />
          </Field>

          <Field
            label={t("setup.dobLabel")}
            notice={dobNotice ? t("setup.dobNotice") : undefined}
          >
            <View style={styles.inputWrap}>
              <TextInput
                value={dob}
                onChangeText={handleDobChange}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={[styles.input, styles.inputWithIcon]}
              />
              <View pointerEvents="none" style={styles.inputIcon}>
                <FontAwesome6
                  name="calendar"
                  size={15}
                  color={COLORS.blue700}
                />
              </View>
            </View>
          </Field>

          <View>
            <View style={styles.weightRow}>
              <View style={styles.weightColumn}>
                <Text style={styles.label}>{t("setup.weightLabel")}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={weight}
                    onChangeText={handleWeightChange}
                    placeholder="e.g. 5.0"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    style={[styles.input, styles.inputWithUnit]}
                  />
                  <View pointerEvents="none" style={styles.unitBadge}>
                    <Text style={styles.unitText}>kg</Text>
                  </View>
                </View>
              </View>

              {hasWeight ? (
                <View style={styles.weightColumn}>
                  <Text style={styles.label}>{t("setup.weightDateLabel")}</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={weightDate}
                      onChangeText={(text) =>
                        setWeightDate(clampToToday(text, today))
                      }
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={COLORS.placeholder}
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                      style={[styles.input, styles.inputWithIcon]}
                    />
                    <View pointerEvents="none" style={styles.inputIcon}>
                      <FontAwesome6
                        name="calendar"
                        size={15}
                        color={COLORS.blue700}
                      />
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
            <Text style={styles.helper}>{t("setup.optional")}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
          disabled={isDisabled}
          onPress={handleCreate}
          style={({ pressed }) => [
            styles.button,
            isDisabled && styles.buttonDisabled,
            pressed && !isDisabled && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
          <FontAwesome6
            name={status === "created" ? "check" : "arrow-right"}
            size={15}
            color="#FFFFFF"
          />
        </Pressable>
        {!canCreate ? <Text style={styles.hint}>{t("setup.hint")}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join an existing baby profile"
          onPress={() => router.push("/join-baby-profile")}
          style={({ pressed }) => [
            styles.joinLink,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.joinLinkText}>{t("setup.joinLink")}</Text>
        </Pressable>
      </View>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

function Field({
  label,
  notice,
  children,
}: {
  label: string;
  notice?: string;
  children: ReactNode;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {children}
      {notice ? (
        <View style={styles.noticeRow}>
          <FontAwesome6 name="circle-check" size={12} color={COLORS.blue700} />
          <Text style={styles.helperText}>{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  glow: {
    position: "absolute",
    top: -112,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(225, 238, 249, 0.7)",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.56,
    color: COLORS.ink,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.muted,
  },
  form: {
    marginTop: 24,
    gap: 20,
  },
  label: {
    marginBottom: 8,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.ink,
  },
  inputWrap: {
    justifyContent: "center",
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  inputWithUnit: {
    paddingRight: 56,
  },
  inputIcon: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 16,
    justifyContent: "center",
  },
  unitBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 6,
    backgroundColor: COLORS.blue50,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unitText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.blue700,
  },
  weightRow: {
    flexDirection: "row",
    gap: 12,
  },
  weightColumn: {
    flex: 1,
  },
  helper: {
    marginTop: 6,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  helperText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  noticeRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    padding: 16,
    shadowColor: COLORS.ink,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontFamily: FONTS.display,
    fontSize: 19,
    lineHeight: 23,
    color: COLORS.ink,
  },
  cardSubtitle: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
  },
  choiceBlock: {
    marginTop: 16,
  },
  segmented: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cream,
  },
  segment: {
    flex: 1,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  segmentSelected: {
    borderColor: COLORS.blue300,
    backgroundColor: "#FFFFFF",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.muted,
  },
  segmentTextSelected: {
    color: COLORS.blue700,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: COLORS.cream,
  },
  button: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.blue700,
    shadowColor: COLORS.blue700,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: COLORS.blueDisabled,
    shadowOpacity: 0,
    elevation: 0,
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
  joinLink: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  joinLinkText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.blue700,
  },
  hint: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
});
