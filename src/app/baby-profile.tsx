import { FontAwesome6 } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
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
import { COLORS, FONTS } from "../constants/theme";
import {
  type Answer,
  type BabyDetails,
  type BabyProfile,
  deleteBabyData,
  loadBabyProfile,
  inviteCodeFor,
  publishBaby,
  updateBaby,
} from "../db/babies";

type IconName = ComponentProps<typeof FontAwesome6>["name"];

const DANGER = "#B3261E";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OPTIONS: { value: Answer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];
const EMPTY_DRAFT: BabyDetails = {
  name: "",
  dateOfBirth: "",
  premature: null,
  clinicianFeedingPlan: null,
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (value: number) => String(value).padStart(2, "0");

const toDateString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const isValidDate = (value: string) =>
  DATE_PATTERN.test(value) && toDateString(parseDate(value)) === value;

const answerLabel = (answer: Answer | null) =>
  OPTIONS.find((option) => option.value === answer)?.label ?? "Not set";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Answer | null;
  onChange: (value: Answer) => void;
}) {
  return (
    <Field label={label}>
      <View style={styles.segGroup}>
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={[styles.seg, selected && styles.segSelected]}
            >
              <Text
                style={[styles.segText, selected && styles.segTextSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

const dateLabel = (date: Date) =>
  `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

const shortDateLabel = (date: Date) =>
  `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;

const ageLabel = (dob: Date, now: Date) => {
  const days = Math.floor((now.getTime() - dob.getTime()) / 86400000);
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 +
    (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 1) return `${Math.floor(days / 7)} weeks`;
  return `${months} ${months === 1 ? "month" : "months"}`;
};

function NavTab({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={styles.navTab}
    >
      <View style={[styles.navPill, active && styles.navPillActive]}>
        <FontAwesome6
          name={icon}
          size={16}
          color={active ? COLORS.blue700 : "#8C948F"}
        />
      </View>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

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
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<BabyProfile | null | undefined>(
    undefined,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<BabyDetails>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reload = useCallback(() => {
    loadBabyProfile(db).then((loaded) => {
      setProfile(loaded);
      if (loaded) {
        publishBaby(db, loaded.id).catch((e) =>
          console.warn("Could not publish baby", e),
        );
      }
    });
  }, [db]);
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
  const initial = profile.name.charAt(0).toUpperCase();
  const draftValid =
    draft.name.trim().length > 0 &&
    isValidDate(draft.dateOfBirth) &&
    draft.dateOfBirth <= today;

  const openEdit = () => {
    setDraft({
      name: profile.name,
      dateOfBirth: profile.dateOfBirth,
      premature: profile.premature,
      clinicianFeedingPlan: profile.clinicianFeedingPlan,
    });
    setEditOpen(true);
  };

  const updateDraft = (changes: Partial<BabyDetails>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const handleDobChange = (text: string) =>
    updateDraft({
      dateOfBirth: isValidDate(text) && text > today ? today : text,
    });

  const saveEdit = async () => {
    if (!draftValid || saving) return;
    setSaving(true);
    try {
      await updateBaby(db, profile.id, draft);
      setEditOpen(false);
      reload();
    } catch {
      Alert.alert("Could not save", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteData = async () => {
    try {
      await deleteBabyData(db, profile.id);
      setConfirmOpen(false);
      reload();
    } catch {
      Alert.alert("Could not delete", "Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Baby Profile</Text>
          <Text style={styles.subtitle}>Everything about your little one</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.profileAge}>{ageLabel(dob, now)} old</Text>
            <Text style={styles.profileBorn}>Born {dateLabel(dob)}</Text>
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
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Baby Details</Text>
        <View style={styles.card}>
          <DetailRow icon="face-smile" label="Name" value={profile.name} />
          <DetailRow
            icon="calendar"
            label="Date of Birth"
            value={shortDateLabel(dob)}
          />
          <DetailRow
            icon="cake-candles"
            label="Age"
            value={ageLabel(dob, now)}
          />
          <DetailRow
            icon="baby"
            label="Born prematurely"
            value={answerLabel(profile.premature)}
          />
          <DetailRow
            icon="file-medical"
            label="Doctor's feeding plan"
            value={answerLabel(profile.clinicianFeedingPlan)}
          />
        </View>

        <Text style={styles.sectionTitle}>Weight</Text>
        <View style={styles.weightCard}>
          {latest ? (
            <>
              <Text style={styles.cardKicker}>Current Weight</Text>
              <View style={styles.weightRow}>
                <Text style={styles.weightValue}>{latest.kg.toFixed(1)}</Text>
                <Text style={styles.weightUnit}>kg</Text>
              </View>
              <Text style={styles.weightUpdated}>
                Last updated: {dateLabel(latest.date)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No weight added yet</Text>
              <Text style={styles.emptyText}>
                Add {profile.name}&apos;s first weight to start tracking.
              </Text>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/update-weight")}
            style={styles.updateWeightButton}
          >
            <FontAwesome6 name="plus" size={13} color={COLORS.blue700} />
            <Text style={styles.updateWeightText}>Update Weight</Text>
          </Pressable>
        </View>

        {weights.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Weight History</Text>
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
                        {shortDateLabel(w.date)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.weightKg,
                        isLatest && styles.weightKgActive,
                      ]}
                    >
                      {w.kg.toFixed(1)} kg
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Sharing</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/join-baby-profile")}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome6 name="user-plus" size={13} color={COLORS.blue700} />
          <Text style={styles.shareText}>Share Baby Profile</Text>
        </Pressable>

        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>Invitation code</Text>
          <Text style={styles.inviteCode}>{inviteCodeFor(profile.id)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Settings</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmOpen(true)}
          style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
        >
          <View style={styles.dangerIcon}>
            <FontAwesome6 name="trash-can" size={14} color={DANGER} />
          </View>
          <Text style={styles.dangerText}>Delete Baby Data</Text>
          <FontAwesome6 name="chevron-right" size={11} color="#D9B3A9" />
        </Pressable>
      </ScrollView>

      <View style={styles.nav}>
        <NavTab
          icon="house"
          label="Home"
          onPress={() => router.navigate("/home")}
        />
        <NavTab
          icon="clock-rotate-left"
          label="History"
          onPress={() => router.navigate("/history")}
        />
        <NavTab icon="baby" label="Baby" active />
      </View>

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
              <Text style={styles.sheetTitle}>Edit Baby Profile</Text>
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
              <Field label="Name">
                <TextInput
                  value={draft.name}
                  onChangeText={(name) => updateDraft({ name })}
                  placeholder="Baby's name"
                  placeholderTextColor={COLORS.placeholder}
                  style={styles.input}
                />
              </Field>
              <Field label="Date of Birth">
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
              <ChoiceGroup
                label="Born prematurely?"
                value={draft.premature}
                onChange={(premature) => updateDraft({ premature })}
              />
              <ChoiceGroup
                label="Doctor gave a feeding plan?"
                value={draft.clinicianFeedingPlan}
                onChange={(clinicianFeedingPlan) =>
                  updateDraft({ clinicianFeedingPlan })
                }
              />
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
                <Text style={styles.saveText}>Save Changes</Text>
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
            <Text style={styles.dialogTitle}>Delete baby data?</Text>
            <Text style={styles.dialogText}>
              This removes the baby profile, weights and activity records from
              this device. This cannot be undone.
            </Text>
            <View style={styles.dialogRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmOpen(false)}
                style={[styles.dialogButton, styles.dialogCancel]}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={deleteData}
                style={[styles.dialogButton, styles.dialogDelete]}
              >
                <Text style={styles.dialogDeleteText}>Delete</Text>
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
  nav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  navTab: {
    alignItems: "center",
    gap: 4,
  },
  navPill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  navPillActive: {
    backgroundColor: COLORS.blue100,
  },
  navLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: "#8C948F",
  },
  navLabelActive: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.blue700,
  },
});
