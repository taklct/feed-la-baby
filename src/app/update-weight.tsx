import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FontAwesome6 } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../constants/theme";
import { addWeight, loadBabyProfile, type BabyProfile } from "../db/babies";
import { formatDate } from "../i18n/format";
import { useI18n } from "../i18n/i18n";
import { type Lang } from "../i18n/messages";
import { ageLabel, parseDate, toDateString } from "../utils/dates";

const MIN_KG = 1;
const MAX_KG = 15;
const STEP_KG = 0.1;
const BIG_CHANGE_KG = 1;
const WARM = "#A0703F";

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const sameDay = (a: Date, b: Date) =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

const dateLabel = (date: Date, lang: Lang) => formatDate(date, lang, true);

const parseKg = (text: string) => {
  const n = parseFloat(text.replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

// Alert.alert is a no-op on web, so use window dialogs there.
const notify = (title: string, message: string) => {
  if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function UpdateWeightScreen() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<BabyProfile | null | undefined>(
    undefined,
  );

  useEffect(() => {
    loadBabyProfile(db).then(setProfile);
  }, [db]);

  if (profile === undefined) return null;
  if (profile === null) return <Redirect href="/baby-setup" />;
  return <WeightForm profile={profile} />;
}

function WeightForm({ profile }: { profile: BabyProfile }) {
  const router = useRouter();
  const db = useSQLiteContext();
  const { t, lang } = useI18n();
  const BABY_NAME = profile.name;
  const BABY_AGE = t("age.old", {
    age: ageLabel(parseDate(profile.dateOfBirth), new Date(), t),
  });
  const latest = profile.weights[0];
  const PREVIOUS = latest
    ? { kg: latest.kg, date: parseDate(latest.date) }
    : null;
  const today = startOfDay(new Date());
  const [weightText, setWeightText] = useState(
    PREVIOUS ? PREVIOUS.kg.toFixed(1) : "",
  );
  const [date, setDate] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);

  const kg = parseKg(weightText);
  let error = "";
  if (kg === null) error = t("weight.enterFirst", { name: BABY_NAME });
  else if (kg < MIN_KG || kg > MAX_KG)
    error = t("weight.range", {
      min: MIN_KG.toFixed(1),
      max: MAX_KG.toFixed(1),
    });
  const invalid = error !== "";
  const isEarlier =
    PREVIOUS !== null && date.getTime() < PREVIOUS.date.getTime();

  const stepWeight = (delta: number) => {
    const base = kg ?? PREVIOUS?.kg ?? MIN_KG;
    const next = Math.min(
      MAX_KG,
      Math.max(MIN_KG, Math.round((base + delta) * 10) / 10),
    );
    setWeightText(next.toFixed(1));
  };

  const onWeightChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.,]/g, "").replace(",", ".");
    const [whole, ...rest] = cleaned.split(".");
    setWeightText(
      rest.length ? `${whole}.${rest.join("").slice(0, 1)}` : whole,
    );
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setPickerOpen(false);
    if (event.type === "set" && selected) {
      setDate(selected > today ? today : startOfDay(selected));
    }
  };

  const save = async (value: number) => {
    try {
      await addWeight(db, profile.id, value, toDateString(date));
    } catch {
      notify(t("common.couldNotSave"), t("common.tryAgain"));
      return;
    }
    router.replace("/home");
  };

  const onSave = () => {
    if (invalid || kg === null) return;
    if (PREVIOUS && Math.abs(kg - PREVIOUS.kg) >= BIG_CHANGE_KG) {
      const message = t("weight.bigChange", {
        next: kg.toFixed(1),
        name: BABY_NAME,
        prev: PREVIOUS.kg.toFixed(1),
      });
      if (Platform.OS === "web") {
        if (window.confirm(`${t("weight.checkTitle")}\n\n${message}`)) save(kg);
        return;
      }
      Alert.alert(t("weight.checkTitle"), message, [
        { text: t("weight.edit"), style: "cancel" },
        { text: t("weight.saveAnyway"), onPress: () => save(kg) },
      ]);
      return;
    }
    save(kg);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => router.replace("/home")}
          style={styles.iconButton}
        >
          <FontAwesome6 name="arrow-left" size={15} color={COLORS.ink} />
        </Pressable>
        <Text style={styles.title}>{t("weight.title")}</Text>
        <View style={styles.iconButtonSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.babyCard}>
          <View style={styles.babyAvatar}>
            <Text style={styles.babyAvatarText}>{BABY_NAME.charAt(0)}</Text>
          </View>
          <View style={styles.babyInfo}>
            <Text style={styles.babyName}>{BABY_NAME}</Text>
            <Text style={styles.babyAge}>{BABY_AGE}</Text>
          </View>
          <View style={styles.previousBlock}>
            <Text style={styles.previousLabel}>{t("weight.previous")}</Text>
            <Text style={styles.previousValue}>
              {PREVIOUS ? PREVIOUS.kg.toFixed(1) : "—"}{" "}
              <Text style={styles.previousUnit}>kg</Text>
            </Text>
          </View>
        </View>

        <Text style={styles.question}>
          {t("weight.question", { name: BABY_NAME })}
        </Text>

        <View style={[styles.weightCard, invalid && styles.weightCardInvalid]}>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease by 0.1 kg"
              disabled={kg !== null && kg <= MIN_KG}
              onPress={() => stepWeight(-STEP_KG)}
              style={[styles.stepButton, styles.stepButtonLight]}
            >
              <FontAwesome6 name="minus" size={18} color={COLORS.blue700} />
            </Pressable>
            <View style={styles.weightInputRow}>
              <TextInput
                value={weightText}
                onChangeText={onWeightChange}
                onBlur={() => {
                  if (kg !== null && !invalid) setWeightText(kg.toFixed(1));
                }}
                keyboardType="decimal-pad"
                maxLength={4}
                selectTextOnFocus
                style={styles.weightInput}
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase by 0.1 kg"
              disabled={kg !== null && kg >= MAX_KG}
              onPress={() => stepWeight(STEP_KG)}
              style={[styles.stepButton, styles.stepButtonSolid]}
            >
              <FontAwesome6 name="plus" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          {invalid ? (
            <View style={styles.errorRow}>
              <FontAwesome6 name="circle-info" size={12} color={WARM} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.helpText}>
              {t("weight.helper", { name: BABY_NAME })}
            </Text>
          )}
        </View>

        <Text style={styles.fieldLabel}>{t("weight.dateTitle")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickerOpen((open) => !open)}
          style={styles.dateRow}
        >
          <View style={styles.calendarIcon}>
            <FontAwesome6 name="calendar" size={14} color={COLORS.blue700} />
          </View>
          <Text style={styles.dateText}>{dateLabel(date, lang)}</Text>
          {sameDay(date, today) && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayText}>{t("common.today")}</Text>
            </View>
          )}
        </Pressable>
        {pickerOpen && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={today}
            onChange={onDateChange}
          />
        )}
        {isEarlier && PREVIOUS && (
          <Text style={styles.hintText}>
            {t("weight.earlierHint", {
              date: dateLabel(PREVIOUS.date, lang),
            })}
          </Text>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <FontAwesome6 name="heart" size={13} color={COLORS.blue700} />
          </View>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{t("weight.growingTitle")}</Text>
            <Text style={styles.infoBody}>
              {t("weight.growingBody", { name: BABY_NAME })}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={invalid}
          onPress={onSave}
          style={[styles.saveButton, invalid && styles.saveButtonDisabled]}
        >
          <FontAwesome6 name="check" size={15} color="#FFFFFF" />
          <Text style={styles.saveText}>{t("weight.save")}</Text>
        </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  iconButtonSpacer: {
    width: 44,
    height: 44,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.ink,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  babyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.blue200,
    backgroundColor: COLORS.blue50,
  },
  babyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue200,
  },
  babyAvatarText: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.blue800,
  },
  babyInfo: {
    flex: 1,
  },
  babyName: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.ink,
  },
  babyAge: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  previousBlock: {
    alignItems: "flex-end",
  },
  previousLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: COLORS.muted,
  },
  previousValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: COLORS.blue700,
  },
  previousUnit: {
    fontSize: 13,
  },
  question: {
    marginTop: 32,
    textAlign: "center",
    fontFamily: FONTS.display,
    fontSize: 24,
    color: COLORS.ink,
  },
  weightCard: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  weightCardInvalid: {
    borderColor: "#E6CBB0",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonLight: {
    backgroundColor: COLORS.blue50,
  },
  stepButtonSolid: {
    backgroundColor: COLORS.blue700,
  },
  weightInputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
  },
  weightInput: {
    minWidth: 92,
    fontFamily: FONTS.display,
    fontSize: 48,
    color: COLORS.ink,
    textAlign: "right",
    padding: 0,
  },
  weightUnit: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 20,
    color: COLORS.muted,
  },
  helpText: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  errorRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  errorText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: WARM,
  },
  fieldLabel: {
    marginTop: 24,
    marginBottom: 12,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  dateRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  calendarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue50,
  },
  dateText: {
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.ink,
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: COLORS.blue100,
  },
  todayText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.blue700,
  },
  hintText: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },
  infoCard: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.blue50,
    borderWidth: 1,
    borderColor: COLORS.blue200,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.blue800,
  },
  infoBody: {
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.blue800,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  saveButton: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: COLORS.blue700,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.blueDisabled,
  },
  saveText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
});
