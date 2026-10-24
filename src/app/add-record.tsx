import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FontAwesome6 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { RecordIcon } from "../components/record-icon";
import { DateTimeWheel } from "../components/datetime-wheel";
import { TYPE_STYLE, type RecordType } from "../constants/records";
import { COLORS, FONTS } from "../constants/theme";
import { createActivity, deleteActivity } from "../db/activities";
import { loadBabyProfile } from "../db/babies";
import { formatClock, formatMonthDay } from "../i18n/format";
import { useI18n, type TranslateFn } from "../i18n/i18n";
import { LEVEL_KEYS, type Lang } from "../i18n/messages";

const ACTIVITIES: RecordType[] = ["milk", "pee", "poop", "bath"];
const MIN_ML = 5;
const MAX_ML = 400;
const STEP_ML = 10;
const LAST_MILK_ML = 120;
const SAVE_DELAY_MS = 500;
const TOAST_MS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL_VALUES = [1, 2, 3, 4, 5] as const;
const levelText = (n: number, t: TranslateFn) =>
  t(LEVEL_KEYS[n as keyof typeof LEVEL_KEYS]);

const toggleActivity = (list: RecordType[], type: RecordType) =>
  ACTIVITIES.filter((t) => (t === type ? !list.includes(t) : list.includes(t)));

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const clockLabel = (date: Date, lang: Lang) =>
  formatClock(date.getHours(), date.getMinutes(), lang);

const dayLabel = (date: Date, now: Date, t: TranslateFn, lang: Lang) => {
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return t("common.today");
  if (days === 1) return t("common.yesterday");
  return formatMonthDay(date, lang);
};

export default function AddRecordScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { t, lang } = useI18n();
  const [babyName, setBabyName] = useState<string | null>(null);
  const savedId = useRef<string | null>(null);
  const [selected, setSelected] = useState<RecordType[]>(["milk", "pee"]);
  const [levels, setLevels] = useState({ pee: 3, poop: 3 });
  const [amount, setAmount] = useState<number | null>(LAST_MILK_ML);
  const [recordedAt, setRecordedAt] = useState(() => new Date());
  const [timeClamped, setTimeClamped] = useState(false);
  const [androidStep, setAndroidStep] = useState<"date" | "time" | null>(null);
  const draftDate = useRef<Date | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [savedMessage, setSavedMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    loadBabyProfile(db).then((baby) => setBabyName(baby?.name ?? null));
  }, [db]);

  const milkSelected = selected.includes("milk");
  const hasDiaper = selected.includes("pee") || selected.includes("poop");
  const hasBath = selected.includes("bath");
  const amountValid = amount !== null && amount >= MIN_ML && amount <= MAX_ML;
  const canSave =
    status === "idle" && selected.length > 0 && (!milkSelected || amountValid);
  const now = new Date();

  const setTime = (next: Date) => {
    const current = new Date();
    const clamped = next.getTime() > current.getTime();
    setRecordedAt(clamped ? current : next);
    setTimeClamped(clamped);
  };

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "ios") {
      if (date) setTime(date);
      return;
    }
    if (event.type === "dismissed" || !date) {
      setAndroidStep(null);
      return;
    }
    if (androidStep === "date") {
      draftDate.current = date;
      setAndroidStep("time");
      return;
    }
    const combined = new Date(draftDate.current ?? recordedAt);
    combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
    draftDate.current = null;
    setAndroidStep(null);
    setTime(combined);
  };

  const stepAmount = (delta: number) =>
    setAmount(Math.max(MIN_ML, Math.min(MAX_ML, (amount ?? 0) + delta)));

  const handleAmountText = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 3);
    setAmount(digits ? parseInt(digits, 10) : null);
  };

  const handleSave = () => {
    if (!canSave) return;
    const parts = [
      milkSelected ? t("add.partMilk", { ml: amount ?? 0 }) : "",
      selected.includes("pee") ? t("add.partPee", { n: levels.pee }) : "",
      selected.includes("poop") ? t("add.partPoop", { n: levels.poop }) : "",
      hasBath ? t("add.partBath") : "",
    ].filter(Boolean);
    setSavedMessage(t("add.savedMessage", { parts: parts.join(" · ") }));
    setStatus("saving");
    timer.current = setTimeout(async () => {
      try {
        savedId.current = await createActivity(db, {
          milkMl: milkSelected ? amount : null,
          peeLevel: selected.includes("pee") ? levels.pee : null,
          poopLevel: selected.includes("poop") ? levels.poop : null,
          bath: hasBath,
          occurredAt: recordedAt.getTime(),
        });
      } catch {
        setStatus("idle");
        Alert.alert(t("common.couldNotSave"), t("common.tryAgain"));
        return;
      }
      setStatus("saved");
      timer.current = setTimeout(() => router.replace("/home"), TOAST_MS);
    }, SAVE_DELAY_MS);
  };

  const handleUndo = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (savedId.current) {
      await deleteActivity(db, savedId.current);
      savedId.current = null;
    }
    setStatus("idle");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.glow} pointerEvents="none" />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => router.replace("/home")}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome6 name="arrow-left" size={15} color={COLORS.ink} />
        </Pressable>
        <Text style={styles.title}>{t("add.title")}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.question}>{t("add.question")}</Text>
        <Text style={styles.questionHint}>{t("add.questionHint")}</Text>
        <View style={styles.typeGrid}>
          {ACTIVITIES.map((type) => {
            const on = selected.includes(type);
            const style = TYPE_STYLE[type];
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={t(style.label)}
                accessibilityState={{ selected: on }}
                onPress={() =>
                  setSelected((list) => toggleActivity(list, type))
                }
                style={[styles.typeCard, on && styles.typeCardOn]}
              >
                <View
                  style={[
                    styles.typeIcon,
                    { backgroundColor: on ? "#FFFFFF" : style.tint },
                  ]}
                >
                  <RecordIcon type={type} color={style.ink} size={22} />
                </View>
                <Text style={[styles.typeLabel, on && styles.typeLabelOn]}>
                  {t(style.label)}
                </Text>
                {on ? (
                  <View style={styles.typeCheck}>
                    <FontAwesome6 name="check" size={8} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.section, styles.stack]}>
          {selected.length === 0 ? <EmptyPanel /> : null}
          {milkSelected ? (
            <MilkPanel
              amount={amount}
              onChangeText={handleAmountText}
              onStep={stepAmount}
            />
          ) : null}
          {hasDiaper || hasBath ? (
            <>
              <Text style={styles.fieldLabel}>
                {milkSelected ? t("add.alsoInRecord") : t("add.inRecord")}
              </Text>
              {selected.includes("pee") ? (
                <LevelPanel
                  type="pee"
                  value={levels.pee}
                  onChange={(value) =>
                    setLevels((prev) => ({ ...prev, pee: value }))
                  }
                />
              ) : null}
              {selected.includes("poop") ? (
                <LevelPanel
                  type="poop"
                  value={levels.poop}
                  onChange={(value) =>
                    setLevels((prev) => ({ ...prev, poop: value }))
                  }
                />
              ) : null}
              {hasBath ? <BathRow name={babyName} /> : null}
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>{t("add.dateTime")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change date and time"
            disabled={Platform.OS !== "android"}
            onPress={() => setAndroidStep("date")}
            style={styles.timeRow}
          >
            <View style={styles.timeIcon}>
              <FontAwesome6 name="clock" size={14} color={COLORS.blue700} />
            </View>
            <Text style={styles.timeValue}>
              {`${dayLabel(recordedAt, now, t, lang)}, ${clockLabel(recordedAt, lang)}`}
            </Text>
          </Pressable>

          {Platform.OS === "ios" ? (
            <View style={styles.timePanel}>
              <DateTimePicker
                value={recordedAt}
                mode="datetime"
                display="spinner"
                maximumDate={now}
                onChange={onPickerChange}
              />
            </View>
          ) : null}
          {Platform.OS === "web" ? (
            <View style={styles.timePanel}>
              <DateTimeWheel
                value={recordedAt}
                maximum={now}
                onChange={setTime}
              />
            </View>
          ) : null}
          {androidStep ? (
            <DateTimePicker
              key={androidStep}
              value={draftDate.current ?? recordedAt}
              mode={androidStep}
              display="default"
              maximumDate={now}
              onChange={onPickerChange}
            />
          ) : null}

          {timeClamped ? (
            <View style={styles.timeHint}>
              <FontAwesome6
                name="circle-check"
                size={12}
                color={COLORS.blue600}
              />
              <Text style={styles.timeHintText}>{t("add.noFuture")}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {status === "saved" ? (
        <View style={styles.toast}>
          <View style={styles.toastBody}>
            <View style={styles.toastCheck}>
              <FontAwesome6 name="check" size={11} color={COLORS.ink} />
            </View>
            <Text style={styles.toastText}>{savedMessage}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo save"
            onPress={handleUndo}
            style={styles.undoButton}
          >
            <Text style={styles.undoText}>{t("add.undo")}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSave}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            !canSave && styles.saveButtonDisabled,
            pressed && canSave && styles.pressed,
          ]}
        >
          {status === "saving" ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <FontAwesome6 name="check" size={15} color="#FFFFFF" />
          )}
          <Text style={styles.saveText}>
            {status === "saved"
              ? t("add.saved")
              : status === "saving"
                ? t("add.saving")
                : t("add.saveRecord")}
          </Text>
        </Pressable>
      </View>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

function MilkPanel({
  amount,
  onChangeText,
  onStep,
}: {
  amount: number | null;
  onChangeText: (text: string) => void;
  onStep: (delta: number) => void;
}) {
  const { t } = useI18n();
  const valid = amount !== null && amount >= MIN_ML && amount <= MAX_ML;
  const hint =
    amount === null
      ? t("add.amountEmpty")
      : !valid
        ? t("add.amountRange", { min: MIN_ML, max: MAX_ML })
        : t("add.lastRecorded", { ml: LAST_MILK_ML });
  const atMin = amount !== null && amount <= MIN_ML;
  const atMax = amount !== null && amount >= MAX_ML;

  return (
    <View>
      <View style={styles.rowBetween}>
        <Text style={styles.fieldLabel}>{t("add.amountTitle")}</Text>
        <Text style={styles.fieldHint}>{t("add.amountSubtitle")}</Text>
      </View>
      <View style={styles.amountCard}>
        <View style={styles.amountRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Decrease by ${STEP_ML} ml`}
            disabled={atMin}
            onPress={() => onStep(-STEP_ML)}
            style={({ pressed }) => [
              styles.stepButton,
              styles.stepButtonLight,
              pressed && styles.pressed,
              atMin && styles.disabled,
            ]}
          >
            <FontAwesome6 name="minus" size={18} color={COLORS.blue700} />
          </Pressable>
          <View style={styles.amountField}>
            <TextInput
              value={amount === null ? "" : String(amount)}
              onChangeText={onChangeText}
              keyboardType="number-pad"
              maxLength={3}
              selectTextOnFocus
              accessibilityLabel="Amount in ml"
              style={styles.amountInput}
            />
            <Text style={styles.amountUnit}>ml</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Increase by ${STEP_ML} ml`}
            disabled={atMax}
            onPress={() => onStep(STEP_ML)}
            style={({ pressed }) => [
              styles.stepButton,
              styles.stepButtonDark,
              pressed && styles.pressed,
              atMax && styles.disabled,
            ]}
          >
            <FontAwesome6 name="plus" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text style={[styles.amountHint, !valid && styles.amountHintWarn]}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

function ActivityRow({
  icon,
  tint,
  title,
  subtitle,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: tint }]}>{icon}</View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <FontAwesome6 name="circle-check" size={16} color={COLORS.blue500} />
    </View>
  );
}

function LevelPanel({
  type,
  value,
  onChange,
}: {
  type: "pee" | "poop";
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const style = TYPE_STYLE[type];
  const activeStyle =
    type === "pee" ? styles.levelButtonOnPee : styles.levelButtonOnPoop;

  return (
    <View style={styles.levelCard}>
      <View style={styles.levelHeader}>
        <View style={[styles.rowIcon, { backgroundColor: style.tint }]}>
          <RecordIcon type={type} color={style.ink} size={20} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>
            {t("add.levelTitle", { type: t(style.label) })}
          </Text>
          <Text style={styles.rowSubtitle}>{t("add.levelQuestion")}</Text>
        </View>
        <Text
          style={[
            styles.levelValue,
            { color: type === "pee" ? COLORS.skyInk : COLORS.sandInk },
          ]}
        >
          {`${value} · ${levelText(value, t)}`}
        </Text>
      </View>

      <View style={styles.levelGrid} accessibilityRole="radiogroup">
        {LEVEL_VALUES.map((n) => {
          const on = n === value;
          return (
            <Pressable
              key={`${type}-${n}`}
              accessibilityRole="radio"
              accessibilityLabel={`Level ${n}`}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(n)}
              style={({ pressed }) => [
                styles.levelButton,
                on && activeStyle,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.levelButtonText, on && styles.levelButtonTextOn]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.levelScale}>
        <Text style={styles.levelScaleText}>{t("level.1")}</Text>
        <Text style={styles.levelScaleText}>{t("level.5")}</Text>
      </View>
    </View>
  );
}
function BathRow({ name }: { name: string | null }) {
  const { t } = useI18n();
  return (
    <ActivityRow
      tint={COLORS.lilacSoft}
      icon={<RecordIcon type="bath" color={COLORS.lilacInk} size={25} />}
      title={t("common.bath")}
      subtitle={t("add.bathSubtitle", { name: name ?? t("join.thisBaby") })}
    />
  );
}

function EmptyPanel() {
  const { t } = useI18n();
  return (
    <View style={styles.emptyPanel}>
      <View style={styles.emptyIcon}>
        <FontAwesome6 name="hand-pointer" size={16} color={COLORS.blue700} />
      </View>
      <Text style={styles.emptyTitle}>{t("add.chooseTitle")}</Text>
      <Text style={styles.emptyText}>{t("add.chooseText")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -128,
    left: -96,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(225, 238, 249, 0.7)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
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
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.ink,
  },
  headerSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  question: {
    fontFamily: FONTS.display,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.ink,
  },
  typeGrid: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  typeCard: {
    flex: 1,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  typeCardOn: {
    borderColor: COLORS.blue500,
    backgroundColor: COLORS.blue50,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.ink,
  },
  typeLabelOn: {
    color: COLORS.blue800,
  },
  typeCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.blue700,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 24,
  },
  fieldLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  fieldHint: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  amountCard: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  amountRow: {
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
  stepButtonDark: {
    backgroundColor: COLORS.blue700,
  },
  amountField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
  },
  amountInput: {
    minWidth: 96,
    padding: 0,
    fontFamily: FONTS.display,
    fontSize: 46,
    lineHeight: 52,
    textAlign: "right",
    color: COLORS.ink,
  },
  amountUnit: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 18,
    color: COLORS.muted,
  },
  amountHint: {
    marginTop: 12,
    textAlign: "center",
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  amountHintWarn: {
    color: "#A0703F",
  },
  questionHint: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  stack: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  rowSubtitle: {
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  levelCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    shadowColor: COLORS.ink,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },
  levelGrid: {
    marginTop: 14,
    flexDirection: "row",
    gap: 6,
  },
  levelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  levelButtonOnPee: {
    borderColor: COLORS.skyInk,
    backgroundColor: COLORS.skyInk,
  },
  levelButtonOnPoop: {
    borderColor: COLORS.sandInk,
    backgroundColor: COLORS.sandInk,
  },
  levelButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.muted,
  },
  levelButtonTextOn: {
    color: "#FFFFFF",
  },
  levelScale: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  levelScaleText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
  },
  emptyPanel: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.blue200,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.blue50,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  emptyText: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  timeRow: {
    marginTop: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.blue50,
    alignItems: "center",
    justifyContent: "center",
  },
  timeValue: {
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.ink,
  },
  timeChange: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.blue700,
  },
  timePanel: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  timeHint: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeHintText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.ink,
    shadowColor: COLORS.ink,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  toastBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toastCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.blue300,
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  undoButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  undoText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.blue300,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  saveButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.blue700,
    shadowColor: COLORS.blue700,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.blueDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
