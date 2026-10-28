import { FontAwesome6 } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../components/bottom-nav";
import { COLORS, FONTS } from "../constants/theme";
import {
  type BabyDetails,
  type BabyProfile,
  deleteBabyData,
  loadBabyProfile,
  inviteCodeFor,
  updateBaby,
  updateDailyMilkRef,
} from "../db/babies";
import { formatDate } from "../i18n/format";
import { useI18n } from "../i18n/i18n";
import { LANGUAGES, type Lang } from "../i18n/messages";
import { ageLabel, parseDate, toDateString } from "../utils/dates";

type IconName = ComponentProps<typeof FontAwesome6>["name"];

const DANGER = "#B3261E";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_DRAFT: BabyDetails = {
  name: "",
  dateOfBirth: "",
};

const isValidDate = (value: string) =>
  DATE_PATTERN.test(value) && toDateString(parseDate(value)) === value;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const dateLabel = (date: Date, lang: Lang) => formatDate(date, lang, true);

const shortDateLabel = (date: Date, lang: Lang) => formatDate(date, lang);

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <FontAwesome6 name={icon} size={14} color={COLORS.blue700} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function BabyProfileScreen() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [profile, setProfile] = useState<BabyProfile | null | undefined>(
    undefined,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<BabyDetails>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [milkOpen, setMilkOpen] = useState(false);
  const [milkDraft, setMilkDraft] = useState("");

  const reload = useCallback(() => {
    loadBabyProfile().then(setProfile);
  }, []);
  useFocusEffect(reload);

  if (profile === undefined) return null;
  if (profile === null) return <Redirect href="/baby-setup" />;

  const now = new Date();
  const today = toDateString(now);
  const dob = parseDate(profile.dateOfBirth);
  const weights = profile.weights.map((w) => ({
    id: w.id,
    date: parseDate(w.date),
    kg: w.kg,
  }));
  const latest = weights[0];
  const ageText = ageLabel(dob, now, t);
  const initial = profile.name.charAt(0).toUpperCase();
  const draftValid =
    draft.name.trim().length > 0 &&
    isValidDate(draft.dateOfBirth) &&
    draft.dateOfBirth <= today;

  const openEdit = () => {
    setDraft({
      name: profile.name,
      dateOfBirth: profile.dateOfBirth,
    });
    setEditOpen(true);
  };

  const updateDraft = (changes: Partial<BabyDetails>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const milkValue = milkDraft === "" ? null : parseInt(milkDraft, 10);
  const milkValid = milkValue === null || (milkValue >= 1 && milkValue <= 300);

  const openMilkRef = () => {
    setMilkDraft(
      profile.dailyMilkRefMl === null ? "" : String(profile.dailyMilkRefMl),
    );
    setMilkOpen(true);
  };

  const saveMilkRef = async () => {
    if (!milkValid || saving) return;
    setSaving(true);
    try {
      await updateDailyMilkRef(profile.id, milkValue);
      setMilkOpen(false);
      reload();
    } catch {
      Alert.alert(t("common.couldNotSave"), t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  const handleDobChange = (text: string) =>
    updateDraft({
      dateOfBirth: isValidDate(text) && text > today ? today : text,
    });

  const saveEdit = async () => {
    if (!draftValid || saving) return;
    setSaving(true);
    try {
      await updateBaby(profile.id, draft);
      setEditOpen(false);
      reload();
    } catch {
      Alert.alert(t("common.couldNotSave"), t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  const deleteData = async () => {
    try {
      await deleteBabyData(profile.id);
      setConfirmOpen(false);
      reload();
    } catch {
      Alert.alert(t("common.couldNotDelete"), t("common.tryAgain"));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("baby.title")}</Text>
          <Text style={styles.subtitle}>{t("baby.subtitle")}</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.profileAge}>
              {t("age.old", { age: ageText })}
            </Text>
            <Text style={styles.profileBorn}>
              {t("baby.born", { date: dateLabel(dob, lang) })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome6 name="pen" size={11} color={COLORS.blue700} />
            <Text style={styles.editButtonText}>{t("baby.edit")}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{t("baby.details")}</Text>
        <View style={styles.card}>
          <DetailRow
            icon="face-smile"
            label={t("baby.name")}
            value={profile.name}
          />
          <DetailRow
            icon="calendar"
            label={t("baby.dob")}
            value={shortDateLabel(dob, lang)}
          />
          <DetailRow
            icon="cake-candles"
            label={t("baby.age")}
            value={ageText}
          />
        </View>

        <Text style={styles.sectionTitle}>{t("baby.dailyMilkRef")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={openMilkRef}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome6 name="bottle-water" size={13} color={COLORS.blue700} />
          <Text style={styles.shareText}>
            {profile.dailyMilkRefMl === null
              ? t("baby.dailyMilkRefNotSet")
              : `${profile.dailyMilkRefMl} ml/kg`}
          </Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{t("baby.weight")}</Text>
        <View style={styles.weightCard}>
          {latest ? (
            <>
              <Text style={styles.cardKicker}>{t("baby.currentWeight")}</Text>
              <View style={styles.weightRow}>
                <Text style={styles.weightValue}>{latest.kg.toFixed(2)}</Text>
                <Text style={styles.weightUnit}>kg</Text>
              </View>
              <Text style={styles.weightUpdated}>
                {t("baby.lastUpdated", { date: dateLabel(latest.date, lang) })}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>{t("baby.noWeight")}</Text>
              <Text style={styles.emptyText}>
                {t("baby.addFirstWeight", { name: profile.name })}
              </Text>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/update-weight")}
            style={styles.updateWeightButton}
          >
            <FontAwesome6 name="plus" size={13} color={COLORS.blue700} />
            <Text style={styles.updateWeightText}>
              {t("baby.updateWeight")}
            </Text>
          </Pressable>
        </View>

        {weights.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t("baby.weightHistory")}</Text>
            <View style={styles.card}>
              {weights.map((w, index) => {
                const isLatest = index === 0;
                return (
                  <View key={w.id} style={styles.weightItem}>
                    <View style={styles.weightDateRow}>
                      <View
                        style={[
                          styles.weightDot,
                          isLatest && styles.weightDotActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.weightDate,
                          isLatest && styles.weightDateActive,
                        ]}
                      >
                        {shortDateLabel(w.date, lang)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.weightKg,
                        isLatest && styles.weightKgActive,
                      ]}
                    >
                      {w.kg.toFixed(2)} kg
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t("baby.sharing")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/join-baby-profile")}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome6 name="user-plus" size={13} color={COLORS.blue700} />
          <Text style={styles.shareText}>{t("baby.shareProfile")}</Text>
        </Pressable>

        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>{t("baby.inviteCode")}</Text>
          <Text style={styles.inviteCode}>{inviteCodeFor(profile.id)}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t("baby.settings")}</Text>
        <View style={styles.card}>
          <View style={styles.langHeader}>
            <Text style={styles.detailLabel}>{t("baby.language")}</Text>
          </View>
          {LANGUAGES.map((option) => {
            const selected = lang === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setLang(option.value)}
                style={({ pressed }) => [
                  styles.radioRow,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[styles.radioOuter, selected && styles.radioOuterOn]}
                >
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
                <Text
                  style={[styles.radioLabel, selected && styles.radioLabelOn]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmOpen(true)}
          style={({ pressed }) => [
            styles.dangerRow,
            styles.dangerRowSpaced,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.dangerIcon}>
            <FontAwesome6 name="trash-can" size={14} color={DANGER} />
          </View>
          <Text style={styles.dangerText}>{t("baby.deleteData")}</Text>
          <FontAwesome6 name="chevron-right" size={11} color="#D9B3A9" />
        </Pressable>
      </ScrollView>

      <BottomNav active="baby" />

      <StatusBar style="dark" />

      <Modal
        visible={editOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setEditOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("baby.editTitle")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setEditOpen(false)}
                style={styles.sheetClose}
              >
                <FontAwesome6 name="xmark" size={16} color={COLORS.muted} />
              </Pressable>
            </View>
            <View style={styles.sheetBody}>
              <Field label={t("baby.name")}>
                <TextInput
                  value={draft.name}
                  onChangeText={(name) => updateDraft({ name })}
                  placeholder={t("baby.namePlaceholder")}
                  placeholderTextColor={COLORS.placeholder}
                  style={styles.input}
                />
              </Field>
              <Field label={t("baby.dob")}>
                <TextInput
                  value={draft.dateOfBirth}
                  onChangeText={handleDobChange}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  style={styles.input}
                />
              </Field>
              <Pressable
                accessibilityRole="button"
                disabled={!draftValid || saving}
                onPress={saveEdit}
                style={({ pressed }) => [
                  styles.saveButton,
                  (!draftValid || saving) && styles.saveDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveText}>{t("common.saveChanges")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={milkOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMilkOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setMilkOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t("baby.dailyMilkRef")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setMilkOpen(false)}
                style={styles.sheetClose}
              >
                <FontAwesome6 name="xmark" size={16} color={COLORS.muted} />
              </Pressable>
            </View>
            <View style={styles.sheetBody}>
              <Field label={t("baby.dailyMilkRefLabel")}>
                <TextInput
                  value={milkDraft}
                  onChangeText={(text) =>
                    setMilkDraft(text.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder={t("baby.dailyMilkRefPlaceholder")}
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </Field>
              <Pressable
                accessibilityRole="button"
                disabled={!milkValid || saving}
                onPress={saveMilkRef}
                style={({ pressed }) => [
                  styles.saveButton,
                  (!milkValid || saving) && styles.saveDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.saveText}>{t("common.saveChanges")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.centerRoot}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setConfirmOpen(false)}
          />
          <View style={styles.dialog}>
            <View style={styles.dialogIcon}>
              <FontAwesome6 name="trash-can" size={20} color={DANGER} />
            </View>
            <Text style={styles.dialogTitle}>{t("baby.deleteTitle")}</Text>
            <Text style={styles.dialogText}>{t("baby.deleteBody")}</Text>
            <View style={styles.dialogRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmOpen(false)}
                style={[styles.dialogButton, styles.dialogCancel]}
              >
                <Text style={styles.dialogCancelText}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={deleteData}
                style={[styles.dialogButton, styles.dialogDelete]}
              >
                <Text style={styles.dialogDeleteText}>
                  {t("common.delete")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    gap: 2,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: COLORS.ink,
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.muted,
  },
  profileCard: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.blue200,
    backgroundColor: COLORS.blue50,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue200,
  },
  avatarText: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.blue800,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.ink,
  },
  profileAge: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.blue700,
  },
  profileBorn: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontFamily: FONTS.display,
    fontSize: 19,
    color: COLORS.ink,
  },
  card: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  detailRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue50,
  },
  detailLabel: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.muted,
  },
  detailValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  weightCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  cardKicker: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: COLORS.muted,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 6,
  },
  weightValue: {
    fontFamily: FONTS.display,
    fontSize: 40,
    color: COLORS.blue700,
  },
  weightUnit: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: COLORS.blue700,
  },
  weightUpdated: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  updateWeightButton: {
    marginTop: 16,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.blue700,
    backgroundColor: "#FFFFFF",
  },
  updateWeightText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.blue700,
  },
  shareButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.blue50,
  },
  shareText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.blue700,
  },
  inviteCard: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
  },
  inviteLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  inviteCode: {
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: 4,
    color: COLORS.ink,
  },
  pressed: {
    opacity: 0.7,
  },
  editButton: {
    height: 36,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.blue300,
    backgroundColor: "#FFFFFF",
  },
  editButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.blue700,
  },
  emptyTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  emptyText: {
    marginTop: 4,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.muted,
  },
  dangerRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  dangerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF1EE",
  },
  dangerText: {
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: DANGER,
  },
  dangerRowSpaced: {
    marginTop: 12,
  },
  langHeader: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  radioRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterOn: {
    borderColor: COLORS.blue700,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.blue700,
  },
  radioLabel: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.ink,
  },
  radioLabelOn: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.blue700,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  centerRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(47, 58, 53, 0.35)",
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 6,
    borderRadius: 3,
    marginBottom: 16,
    backgroundColor: COLORS.line,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.ink,
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cream,
  },
  sheetBody: {
    marginTop: 16,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.ink,
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.ink,
  },
  segGroup: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cream,
  },
  seg: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segSelected: {
    borderWidth: 1,
    borderColor: COLORS.blue300,
    backgroundColor: "#FFFFFF",
  },
  segText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.muted,
  },
  segTextSelected: {
    color: COLORS.blue700,
  },
  saveButton: {
    marginTop: 4,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.blue700,
  },
  saveDisabled: {
    backgroundColor: COLORS.blueDisabled,
  },
  saveText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  dialog: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 330,
    alignItems: "center",
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  dialogIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF1EE",
  },
  dialogTitle: {
    marginTop: 12,
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.ink,
    textAlign: "center",
  },
  dialogText: {
    marginTop: 6,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: "center",
  },
  dialogRow: {
    marginTop: 20,
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  dialogButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogCancel: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  dialogCancelText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.ink,
  },
  dialogDelete: {
    backgroundColor: DANGER,
  },
  dialogDeleteText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  weightItem: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  weightDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  weightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blue200,
  },
  weightDotActive: {
    backgroundColor: COLORS.blue700,
  },
  weightDate: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.muted,
  },
  weightDateActive: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.ink,
  },
  weightKg: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  weightKgActive: {
    color: COLORS.blue700,
  },
});
