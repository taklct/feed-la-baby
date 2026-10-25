import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { FontAwesome6 } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
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
import { TYPE_STYLE, type RecordType } from "../constants/records";
import { BottomNav } from "../components/bottom-nav";
import { COLORS, FONTS } from "../constants/theme";
import { deleteActivity, updateActivity } from "../db/activities";
import { loadHistory, type HistoryData, type HistoryRow } from "../db/history";
import { formatClock, formatDate } from "../i18n/format";
import { useI18n } from "../i18n/i18n";
import { LEVEL_KEYS, type Lang, type MessageKey } from "../i18n/messages";

type FilterKey = "all" | "milk" | "diaper" | "bath";
type HistoryRecord = {
  id: string;
  t: Date;
  milk: number | null;
  pee: number | null;
  poop: number | null;
  bath: boolean;
};

const MIN_ML = 5;
const MAX_ML = 400;
const DEFAULT_ML = 120;
const DEFAULT_LEVEL = 3;
const DANGER = "#B3261E";
const ACTIVITY_TYPES: RecordType[] = ["milk", "pee", "poop", "bath"];
const LEVEL_VALUES = [1, 2, 3, 4, 5];

type EditDraft = {
  milk: number | null;
  pee: number | null;
  poop: number | null;
  bath: boolean;
};

const FILTERS: { key: FilterKey; label: MessageKey }[] = [
  { key: "all", label: "history.filterAll" },
  { key: "milk", label: "common.milk" },
  { key: "diaper", label: "history.filterDiaper" },
  { key: "bath", label: "common.bath" },
];

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const sameDay = (a: Date, b: Date) =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

const clockLabel = (date: Date, lang: Lang) =>
  formatClock(date.getHours(), date.getMinutes(), lang);

const dateLabel = (date: Date, lang: Lang) => formatDate(date, lang, true);

const toRecord = (row: HistoryRow): HistoryRecord => ({
  id: row.id,
  t: new Date(row.occurredAt),
  milk: row.milk,
  pee: row.pee,
  poop: row.poop,
  bath: row.bath,
});

function SummaryCell({
  type,
  value,
  unit,
  label,
  divider,
}: {
  type: RecordType;
  value: number;
  unit?: string;
  label: string;
  divider: boolean;
}) {
  const style = TYPE_STYLE[type];
  return (
    <View style={[styles.summaryCell, divider && styles.summaryDivider]}>
      <View style={[styles.summaryIcon, { backgroundColor: style.tint }]}>
        <RecordIcon type={type} color={style.ink} size={14} />
      </View>
      <View style={styles.summaryValueRow}>
        <Text style={styles.summaryValue}>{value}</Text>
        {unit ? <Text style={styles.summaryUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function LevelBadge({ type, level }: { type: RecordType; level: number }) {
  const style = TYPE_STYLE[type];
  return (
    <View
      accessibilityLabel={`Level ${level}`}
      style={[styles.badge, { backgroundColor: style.tint }]}
    >
      <Text style={[styles.badgeText, { color: style.ink }]}>{level}</Text>
    </View>
  );
}

function Dash() {
  return <Text style={styles.dash}>—</Text>;
}

export default function HistoryScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { t, lang } = useI18n();
  const today = startOfDay(new Date());
  const [selected, setSelected] = useState(today);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [data, setData] = useState<HistoryData | null>(null);
  const isToday = sameDay(selected, today);

  const loadDay = useCallback(async () => {
    const nextDay = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate() + 1,
    ).getTime();
    setData(await loadHistory(db, selected.getTime(), nextDay));
  }, [db, selected]);

  useFocusEffect(
    useCallback(() => {
      loadDay();
    }, [loadDay]),
  );

  const [editing, setEditing] = useState<HistoryRecord | null>(null);
  const [draft, setDraft] = useState<EditDraft>({
    milk: null,
    pee: null,
    poop: null,
    bath: false,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const draftEmpty =
    draft.milk === null &&
    draft.pee === null &&
    draft.poop === null &&
    !draft.bath;
  const draftMilkValid =
    draft.milk === null || (draft.milk >= MIN_ML && draft.milk <= MAX_ML);
  const canSaveEdit = !draftEmpty && draftMilkValid;

  const openEdit = (record: HistoryRecord) => {
    setDraft({
      milk: record.milk,
      pee: record.pee,
      poop: record.poop,
      bath: record.bath,
    });
    setConfirmDelete(false);
    setEditing(record);
  };
  const closeEdit = () => setEditing(null);

  const toggleDraft = (type: RecordType) =>
    setDraft((d) => {
      if (type === "milk")
        return { ...d, milk: d.milk === null ? DEFAULT_ML : null };
      if (type === "pee")
        return { ...d, pee: d.pee === null ? DEFAULT_LEVEL : null };
      if (type === "poop")
        return { ...d, poop: d.poop === null ? DEFAULT_LEVEL : null };
      return { ...d, bath: !d.bath };
    });

  const isOn = (type: RecordType) =>
    type === "bath" ? draft.bath : draft[type] !== null;

  const setLevel = (type: "pee" | "poop", level: number) =>
    setDraft((d) =>
      type === "pee" ? { ...d, pee: level } : { ...d, poop: level },
    );

  const onMilkText = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 3);
    setDraft((d) => ({ ...d, milk: digits ? parseInt(digits, 10) : 0 }));
  };

  const levelBlock = (type: "pee" | "poop") => {
    const value = draft[type];
    const style = TYPE_STYLE[type];
    return (
      <View key={type} style={styles.block}>
        <Text style={styles.blockLabel}>
          {t("add.levelTitle", { type: t(style.label) })}
        </Text>
        <View style={styles.levelRow}>
          {LEVEL_VALUES.map((n) => {
            const on = value === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setLevel(type, n)}
                style={[
                  styles.levelButton,
                  on && { backgroundColor: style.ink, borderColor: style.ink },
                ]}
              >
                <Text style={[styles.levelText, on && styles.levelTextOn]}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.levelName, { color: style.ink }]}>
          {value ? t(LEVEL_KEYS[value as keyof typeof LEVEL_KEYS]) : ""}
        </Text>
      </View>
    );
  };

  const saveEdit = async () => {
    if (!editing || !canSaveEdit) return;
    try {
      await updateActivity(db, editing.id, {
        milkMl: draft.milk,
        peeLevel: draft.pee,
        poopLevel: draft.poop,
        bath: draft.bath,
        occurredAt: editing.t.getTime(),
      });
    } catch {
      Alert.alert(t("common.couldNotSave"), t("common.tryAgain"));
      return;
    }
    setEditing(null);
    loadDay();
  };

  const removeRecord = async () => {
    if (!editing) return;
    try {
      await deleteActivity(db, editing.id);
    } catch {
      Alert.alert(t("common.couldNotDelete"), t("common.tryAgain"));
      return;
    }
    setEditing(null);
    loadDay();
  };

  const shiftDay = (offset: number) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + offset);
    setSelected(next > today ? today : next);
  };

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setPickerOpen(false);
    if (event.type === "dismissed" || !date) return;
    setSelected(startOfDay(date > today ? today : date));
  };

  if (data === null) return null;
  if (data.babyName === null) return <Redirect href="/baby-setup" />;

  const dayRecords = data.rows.map(toRecord);
  const matches = (r: HistoryRecord) => {
    if (filter === "milk") return r.milk !== null;
    if (filter === "diaper") return r.pee !== null || r.poop !== null;
    if (filter === "bath") return r.bath;
    return true;
  };
  const rows = dayRecords.filter(matches);

  const milkRecords = dayRecords.filter((r) => r.milk !== null);
  const milkTotal = milkRecords.reduce((sum, r) => sum + (r.milk ?? 0), 0);
  const peeCount = dayRecords.filter((r) => r.pee !== null).length;
  const poopCount = dayRecords.filter((r) => r.poop !== null).length;
  const bathCount = dayRecords.filter((r) => r.bath).length;

  const filterLabel = t(
    FILTERS.find((f) => f.key === filter)?.label ?? "history.filterAll",
  ).toLowerCase();
  const emptyTitle =
    dayRecords.length > 0 && filter !== "all"
      ? t("history.noneForFilter", { filter: filterLabel })
      : t("history.noActivities");
  const emptyText =
    dayRecords.length > 0 && filter !== "all"
      ? t("history.tryOther")
      : t("history.emptyHint");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.glow} pointerEvents="none" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("history.title")}</Text>
        <Text style={styles.subtitle}>
          {t("history.subtitle", { name: data.babyName })}
        </Text>

        <View style={styles.dateRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => shiftDay(-1)}
            style={({ pressed }) => [
              styles.navButton,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome6
              name="chevron-left"
              size={13}
              color={COLORS.blue700}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pick a date"
            onPress={() => setPickerOpen((open) => !open)}
            style={({ pressed }) => [
              styles.datePill,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome6 name="calendar" size={13} color={COLORS.blue700} />
            <Text style={styles.dateText} numberOfLines={1}>
              {dateLabel(selected, lang)}
            </Text>
            {isToday ? (
              <View style={styles.todayTag}>
                <Text style={styles.todayTagText}>{t("common.today")}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            disabled={isToday}
            onPress={() => shiftDay(1)}
            style={({ pressed }) => [
              styles.navButton,
              isToday && styles.navButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome6
              name="chevron-right"
              size={13}
              color={COLORS.blue700}
            />
          </Pressable>
        </View>

        {pickerOpen ? (
          <DateTimePicker
            value={selected}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={today}
            onChange={onDateChange}
          />
        ) : null}

        <View style={styles.summaryCard}>
          <SummaryCell
            type="milk"
            value={milkTotal}
            unit="ml"
            label={t("history.milkSummary", {
              count: milkRecords.length,
              unit: t(
                milkRecords.length === 1 ? "unit.feed.one" : "unit.feed.other",
              ),
            })}
            divider={false}
          />
          <SummaryCell
            type="pee"
            value={peeCount}
            label={t("common.pee")}
            divider
          />
          <SummaryCell
            type="poop"
            value={poopCount}
            label={t("common.poop")}
            divider
          />
          <SummaryCell
            type="bath"
            value={bathCount}
            label={bathCount === 1 ? t("common.bath") : t("common.baths")}
            divider
          />
        </View>

        <View style={styles.filters} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(f.key)}
                style={[styles.filterButton, on && styles.filterButtonOn]}
              >
                <Text style={[styles.filterText, on && styles.filterTextOn]}>
                  {t(f.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {rows.length > 0 ? (
          <>
            <View style={styles.tableCard}>
              <View style={styles.tableHead}>
                <View style={[styles.timeCell, { flex: 26 }]}>
                  <Text style={styles.headTime}>{t("home.time")}</Text>
                </View>
                {(["milk", "pee", "poop", "bath"] as RecordType[]).map(
                  (type) => (
                    <View
                      key={type}
                      style={[styles.centerCell, { flex: COLUMN_FLEX[type] }]}
                    >
                      <View
                        style={[
                          styles.headIcon,
                          { backgroundColor: TYPE_STYLE[type].tint },
                        ]}
                      >
                        <RecordIcon
                          type={type}
                          color={TYPE_STYLE[type].ink}
                          size={13}
                        />
                      </View>
                      <Text
                        style={[
                          styles.headLabel,
                          { color: TYPE_STYLE[type].ink },
                        ]}
                      >
                        {t(TYPE_STYLE[type].label)}
                      </Text>
                    </View>
                  ),
                )}
              </View>

              {rows.map((r, index) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit record at ${clockLabel(r.t, lang)}`}
                  onPress={() => openEdit(r)}
                  style={({ pressed }) => [
                    styles.tableRow,
                    index % 2 === 1 && styles.rowAlt,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.timeCell, { flex: 26 }]}>
                    <Text style={styles.timeText}>{clockLabel(r.t, lang)}</Text>
                  </View>
                  <View style={[styles.centerCell, { flex: 22 }]}>
                    {r.milk !== null ? (
                      <Text style={styles.milkText}>
                        {r.milk}
                        <Text style={styles.milkUnit}> ml</Text>
                      </Text>
                    ) : (
                      <Dash />
                    )}
                  </View>
                  <View style={[styles.centerCell, { flex: 17 }]}>
                    {r.pee !== null ? (
                      <LevelBadge type="pee" level={r.pee} />
                    ) : (
                      <Dash />
                    )}
                  </View>
                  <View style={[styles.centerCell, { flex: 17 }]}>
                    {r.poop !== null ? (
                      <LevelBadge type="poop" level={r.poop} />
                    ) : (
                      <Dash />
                    )}
                  </View>
                  <View style={[styles.centerCell, { flex: 18 }]}>
                    {r.bath ? (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: TYPE_STYLE.bath.tint },
                        ]}
                      >
                        <FontAwesome6
                          name="check"
                          size={12}
                          color={TYPE_STYLE.bath.ink}
                        />
                      </View>
                    ) : (
                      <Dash />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.hint}>
              <FontAwesome6
                name="hand-pointer"
                size={11}
                color={COLORS.muted}
              />
              <Text style={styles.hintText}>{t("history.tableHint")}</Text>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <FontAwesome6
                name="clock-rotate-left"
                size={18}
                color={COLORS.blue700}
              />
            </View>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      </ScrollView>

      <BottomNav active="history" />

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={closeEdit}
            accessibilityLabel="Close"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {confirmDelete
                    ? t("history.deleteQuestion")
                    : t("history.editTitle")}
                </Text>
                {editing ? (
                  <Text style={styles.sheetSub}>
                    {t("history.recordedOn", {
                      date: dateLabel(editing.t, lang),
                      time: clockLabel(editing.t, lang),
                    })}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={closeEdit}
                style={styles.sheetClose}
              >
                <FontAwesome6 name="xmark" size={15} color={COLORS.muted} />
              </Pressable>
            </View>

            {confirmDelete ? (
              <>
                <Text style={styles.confirmText}>
                  {t("history.deleteBody")}
                </Text>
                <View style={styles.confirmRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmDelete(false)}
                    style={[styles.confirmButton, styles.confirmCancel]}
                  >
                    <Text style={styles.confirmCancelText}>
                      {t("common.cancel")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={removeRecord}
                    style={[styles.confirmButton, styles.confirmDanger]}
                  >
                    <Text style={styles.confirmDangerText}>
                      {t("common.delete")}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <ScrollView
                  style={styles.sheetBody}
                  contentContainerStyle={styles.sheetBodyContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.typeRow}>
                    {ACTIVITY_TYPES.map((type) => {
                      const on = isOn(type);
                      const style = TYPE_STYLE[type];
                      return (
                        <Pressable
                          key={type}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          onPress={() => toggleDraft(type)}
                          style={[
                            styles.typeChip,
                            on && {
                              borderColor: style.ink,
                              backgroundColor: style.tint,
                            },
                          ]}
                        >
                          <RecordIcon
                            type={type}
                            color={on ? style.ink : COLORS.muted}
                            size={16}
                          />
                          <Text
                            style={[
                              styles.typeChipText,
                              on && { color: style.ink },
                            ]}
                          >
                            {t(style.label)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {draft.milk !== null ? (
                    <View style={styles.block}>
                      <Text style={styles.blockLabel}>
                        {t("history.milkAmount")}
                      </Text>
                      <View style={styles.amountRow}>
                        <TextInput
                          value={String(draft.milk)}
                          onChangeText={onMilkText}
                          keyboardType="number-pad"
                          maxLength={3}
                          accessibilityLabel="Amount in ml"
                          style={styles.amountInput}
                        />
                        <Text style={styles.amountUnit}>ml</Text>
                      </View>
                      {!draftMilkValid ? (
                        <Text style={styles.errorText}>
                          {t("history.amountRange", {
                            min: MIN_ML,
                            max: MAX_ML,
                          })}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {draft.pee !== null ? levelBlock("pee") : null}
                  {draft.poop !== null ? levelBlock("poop") : null}
                  {draftEmpty ? (
                    <Text style={styles.emptyNote}>
                      {t("history.selectOne")}
                    </Text>
                  ) : null}
                </ScrollView>

                <Pressable
                  accessibilityRole="button"
                  disabled={!canSaveEdit}
                  onPress={saveEdit}
                  style={({ pressed }) => [
                    styles.saveButton,
                    !canSaveEdit && styles.saveDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.saveText}>{t("common.saveChanges")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmDelete(true)}
                  style={styles.deleteButton}
                >
                  <FontAwesome6 name="trash-can" size={14} color={DANGER} />
                  <Text style={styles.deleteText}>
                    {t("history.deleteRecord")}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const COLUMN_FLEX: Record<RecordType, number> = {
  milk: 22,
  pee: 17,
  poop: 17,
  bath: 18,
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 32, 44, 0.35)",
  },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.display,
    fontSize: 21,
    lineHeight: 24,
    color: COLORS.ink,
  },
  sheetSub: {
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    flexGrow: 0,
  },
  sheetBodyContent: {
    gap: 12,
  },
  typeRow: {
    flexDirection: "row",
    gap: 6,
  },
  typeChip: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  typeChipText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.muted,
  },
  block: {
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  blockLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.ink,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 4,
  },
  amountInput: {
    minWidth: 90,
    padding: 0,
    textAlign: "center",
    fontFamily: FONTS.display,
    fontSize: 30,
    color: COLORS.ink,
  },
  amountUnit: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.muted,
  },
  errorText: {
    textAlign: "center",
    fontFamily: FONTS.body,
    fontSize: 12,
    color: DANGER,
  },
  levelRow: {
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
  levelText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.muted,
  },
  levelTextOn: {
    color: "#FFFFFF",
  },
  levelName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
  emptyNote: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    textAlign: "center",
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  saveButton: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.blue700,
    alignItems: "center",
    justifyContent: "center",
  },
  saveDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  deleteButton: {
    marginTop: 8,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: DANGER,
  },
  confirmText: {
    marginBottom: 16,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.muted,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancel: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  confirmCancelText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  confirmDanger: {
    backgroundColor: DANGER,
  },
  confirmDangerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -128,
    right: -96,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(225, 238, 249, 0.7)",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 40,
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
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.muted,
  },
  dateRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  datePill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  dateText: {
    flexShrink: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  todayTag: {
    borderRadius: 10,
    backgroundColor: COLORS.blue100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  todayTagText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.blue700,
  },
  summaryCard: {
    marginTop: 12,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  summaryCell: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  summaryDivider: {
    borderLeftWidth: 1,
    borderLeftColor: COLORS.line,
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  summaryValue: {
    fontFamily: FONTS.display,
    fontSize: 19,
    lineHeight: 22,
    color: COLORS.ink,
  },
  summaryUnit: {
    marginLeft: 2,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.muted,
  },
  summaryLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
  },
  filters: {
    marginTop: 12,
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  filterButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonOn: {
    backgroundColor: COLORS.blue100,
  },
  filterText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.muted,
  },
  filterTextOn: {
    color: COLORS.blue700,
  },
  tableCard: {
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 10,
    backgroundColor: COLORS.blue50,
  },
  headTime: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.blue700,
  },
  headIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  headLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
  },
  tableRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  rowAlt: {
    backgroundColor: COLORS.cream,
  },
  timeCell: {
    alignItems: "flex-start",
    paddingLeft: 12,
  },
  centerCell: {
    alignItems: "center",
  },
  timeText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  milkText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.blue700,
  },
  milkUnit: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },
  dash: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.placeholder,
  },
  hint: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  hintText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  empty: {
    marginTop: 12,
    alignItems: "center",
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.blue200,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    lineHeight: 20,
    textAlign: "center",
    color: COLORS.muted,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
