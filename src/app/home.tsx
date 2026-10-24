import { FontAwesome6 } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { syncOutbox } from "../db/sync";
import { useSQLiteContext } from "expo-sqlite";
import { RecordIcon } from "../components/record-icon";
import { TYPE_STYLE, type RecordType } from "../constants/records";
import { COLORS, FONTS } from "../constants/theme";
import {
  loadDashboard,
  type DashboardData,
  type LogRecord,
} from "../db/dashboard";

type IconName = ComponentProps<typeof FontAwesome6>["name"];

const AVATAR_URI =
  "https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_49e74a202d_f11d635521932c72.png";

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_INTERVAL_MS = 30 * 1000;

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatTime = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(m / 60);
  const minute = String(m % 60).padStart(2, "0");
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
};

const dayLabel = (minutes: number) => {
  if (minutes >= 0) return "Today";
  if (minutes >= -1440) return "Yesterday";
  return `${Math.ceil(-minutes / 1440)} days ago`;
};

const ageLabel = (ageDays: number) => {
  const months = Math.floor(ageDays / 30.4);
  if (months < 1) return `${Math.floor(ageDays / 7)} weeks old`;
  return `${months} ${months === 1 ? "month" : "months"} old`;
};

const greetingFor = (
  hour: number,
): { text: string; icon: IconName; color: string } => {
  if (hour < 12) return { text: "Good morning", icon: "sun", color: "#E0A63B" };
  if (hour < 18)
    return { text: "Good afternoon", icon: "cloud-sun", color: "#E0A63B" };
  return { text: "Good evening", icon: "moon", color: "#8B87B5" };
};

// 100–150 ml per kg, capped at 1000 ml, rounded to 10 ml.
const milkReference = (weightKg: number) => {
  const at = (mlPerKg: number) =>
    Math.round(Math.min(weightKg * mlPerKg, 1000) / 10) * 10;
  return { min: at(100), max: at(150) };
};

// Average gap between the four most recent milk feeds, rounded to 15 min.
const nextFeed = (records: LogRecord[], ageDays: number, name: string) => {
  if (ageDays < 28) {
    return {
      time: "Feed on cue",
      detail: "Next-feed estimates start once your baby is 4 weeks old.",
      compact: true,
    };
  }
  const feeds = records
    .filter((r) => r.type === "milk")
    .sort((a, b) => b.t - a.t);
  if (feeds.length < 3) {
    return {
      time: "Not enough feeding history yet",
      detail: "Log a few more feeds to see an estimate.",
      compact: true,
    };
  }
  const recent = feeds.slice(0, 4);
  const gaps = recent.slice(0, -1).map((feed, i) => feed.t - recent[i + 1].t);
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const next = Math.round((recent[0].t + average) / 15) * 15;
  return {
    time: `Around ${formatTime(next)}`,
    detail: `Last fed at ${formatTime(recent[0].t)} · Based on ${name}'s recent feeding pattern.`,
    compact: false,
  };
};

function StatCard({
  tint,
  icon,
  children,
}: {
  tint: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statBadge, { backgroundColor: tint }]}>{icon}</View>
      {children}
    </View>
  );
}

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

const TABLE_COLUMNS: { type: RecordType; label: string }[] = [
  { type: "milk", label: "Milk" },
  { type: "pee", label: "Pee" },
  { type: "poop", label: "Poop" },
  { type: "bath", label: "Bath" },
];

function LevelBadge({ type, value }: { type: RecordType; value: number }) {
  const style = TYPE_STYLE[type];
  return (
    <View style={[styles.levelBadge, { backgroundColor: style.tint }]}>
      <Text style={[styles.levelText, { color: style.ink }]}>{value}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [data, setData] = useState<DashboardData | null>(null);

  useFocusEffect(
    useCallback(() => {
      const refresh = () =>
        syncOutbox(db)
          .then(() => loadDashboard(db))
          .then(setData);
      refresh();
      const timer = setInterval(refresh, SYNC_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [db]),
  );

  if (data === null) return null;
  if (data.baby === null) return <Redirect href="/baby-setup" />;

  const BABY = data.baby;
  const RECORDS = data.records;
  const now = new Date();
  const ageDays = Math.floor(
    (now.getTime() - parseDate(BABY.dob).getTime()) / DAY_MS,
  );
  const greeting = greetingFor(now.getHours());
  const eligible =
    BABY.premature === "no" && BABY.doctorPlan === "no" && BABY.weightKg > 0;
  const feed = nextFeed(RECORDS, ageDays, BABY.name);
  const milkRef = milkReference(BABY.weightKg);

  const guide = eligible
    ? {
        label: "Daily Milk Reference",
        value: `~${milkRef.min}–${milkRef.max}`,
        unit: "ml/day",
        text: `General formula reference based on ${BABY.name}'s age and weight.`,
      }
    : {
        label: "General Feeding Guidance",
        value: "Every 2–4 hrs",
        unit: "",
        text:
          BABY.doctorPlan === "yes"
            ? `Follow the feeding plan from ${BABY.name}'s doctor.`
            : `Typical rhythm at this age. Add ${BABY.name}'s weight in her profile for a personalized reference.`,
      };

  const today = RECORDS.filter((r) => r.t >= 0);
  const milk = today.filter((r) => r.type === "milk");
  const milkTotal = milk.reduce((sum, r) => sum + (r.ml ?? 0), 0);
  const countToday = (type: RecordType) =>
    today.filter((r) => r.type === type).length;
  const lastBath = RECORDS.filter((r) => r.type === "bath").sort(
    (a, b) => b.t - a.t,
  )[0];
  const latest = data.recent;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.glow} pointerEvents="none" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>{greeting.text}</Text>
              <FontAwesome6
                name={greeting.icon}
                size={13}
                color={greeting.color}
              />
            </View>
            <Text style={styles.name}>{BABY.name}</Text>
            <Text style={styles.meta}>
              {BABY.weightKg > 0
                ? `${ageLabel(ageDays)} · ${BABY.weightKg.toFixed(1)} kg`
                : ageLabel(ageDays)}
            </Text>
          </View>
          <View style={styles.avatarRing}>
            <Image
              source={{ uri: AVATAR_URI }}
              style={styles.avatar}
              contentFit="cover"
              accessibilityLabel={`${BABY.name}'s photo`}
            />
          </View>
        </View>

        <View style={styles.guide}>
          <View style={styles.guideGlow} />
          <View style={styles.guideHeader}>
            <View style={styles.guideBadge}>
              <RecordIcon type="milk" color={COLORS.blue700} size={18} />
            </View>
            <Text style={styles.guideTitle}>
              {`${BABY.name}'s Feeding Guide`}
            </Text>
          </View>
          <Text style={styles.guideLabel}>{guide.label}</Text>
          <View style={styles.guideValueRow}>
            <Text
              style={[styles.guideValue, !eligible && styles.guideValueCompact]}
            >
              {guide.value}
            </Text>
            {guide.unit ? (
              <Text style={styles.guideUnit}>{guide.unit}</Text>
            ) : null}
          </View>
          <Text style={styles.guideText}>{guide.text}</Text>
          <View style={styles.guideNote}>
            <FontAwesome6 name="heart" size={11} color={COLORS.blue600} />
            <Text style={styles.guideNoteText}>
              Follow your baby's hunger and fullness cues.
            </Text>
          </View>
        </View>

        <View style={styles.nextFeed}>
          <View style={styles.nextIcon}>
            <FontAwesome6 name="clock" size={20} color={COLORS.blue700} />
          </View>
          <View style={styles.nextBody}>
            <Text style={styles.nextLabel}>Expected Next Feed</Text>
            <Text
              style={[styles.nextTime, feed.compact && styles.nextTimeCompact]}
            >
              {feed.time}
            </Text>
            <Text style={styles.nextDetail}>{feed.detail}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
          Today's Overview
        </Text>
        <View style={styles.grid}>
          <StatCard
            tint={TYPE_STYLE.milk.tint}
            icon={
              <RecordIcon type="milk" color={TYPE_STYLE.milk.ink} size={15} />
            }
          >
            <Text style={styles.statValue}>
              {milkTotal}
              <Text style={styles.statUnit}> ml</Text>
            </Text>
            <Text style={styles.statLabel}>
              Milk Consumed <Text style={styles.statDot}>·</Text>{" "}
              <Text
                style={[styles.statHighlight, { color: TYPE_STYLE.milk.ink }]}
              >
                {`${milk.length} ${milk.length === 1 ? "feed" : "feeds"}`}
              </Text>
            </Text>
          </StatCard>

          <StatCard
            tint={TYPE_STYLE.pee.tint}
            icon={
              <RecordIcon type="pee" color={TYPE_STYLE.pee.ink} size={15} />
            }
          >
            <Text style={styles.statValue}>{countToday("pee")}</Text>
            <Text style={styles.statLabel}>Pee</Text>
          </StatCard>

          <StatCard
            tint={TYPE_STYLE.poop.tint}
            icon={
              <RecordIcon type="poop" color={TYPE_STYLE.poop.ink} size={15} />
            }
          >
            <Text style={styles.statValue}>{countToday("poop")}</Text>
            <Text style={styles.statLabel}>Poop</Text>
          </StatCard>

          <StatCard
            tint={TYPE_STYLE.bath.tint}
            icon={
              <RecordIcon type="bath" color={TYPE_STYLE.bath.ink} size={15} />
            }
          >
            <Text style={styles.statValueSmall}>
              {lastBath ? dayLabel(lastBath.t) : "None yet"}
            </Text>
            <Text style={styles.statLabel}>
              Last Bath <Text style={styles.statDot}>·</Text>{" "}
              <Text
                style={[styles.statHighlight, { color: TYPE_STYLE.bath.ink }]}
              >
                {lastBath ? formatTime(lastBath.t) : "—"}
              </Text>
            </Text>
          </StatCard>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add record"
          onPress={() => router.push("/add-record")}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome6 name="plus" size={15} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Add Record</Text>
        </Pressable>

        <View style={[styles.sectionHeader, styles.sectionSpacing]}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <Pressable accessibilityRole="button" style={styles.viewAll}>
            <Text style={styles.viewAllText}>View All</Text>
            <FontAwesome6 name="arrow-right" size={11} color={COLORS.blue700} />
          </Pressable>
        </View>

        {latest.length > 0 ? (
          <View style={styles.list}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <View style={styles.timeCell}>
                <Text style={styles.headText}>Time</Text>
              </View>
              {TABLE_COLUMNS.map((column) => (
                <View key={column.type} style={styles.cell}>
                  <Text
                    style={[
                      styles.headText,
                      { color: TYPE_STYLE[column.type].ink },
                    ]}
                  >
                    {column.label}
                  </Text>
                </View>
              ))}
            </View>
            {latest.map((row, index) => (
              <View
                key={`${row.t}-${index}`}
                style={[styles.tableRow, index > 0 && styles.rowDivider]}
              >
                <View style={styles.timeCell}>
                  <Text style={styles.timeText}>
                    {`${row.t < 0 ? "Yesterday, " : ""}${formatTime(row.t)}`}
                  </Text>
                </View>
                <View style={styles.cell}>
                  {row.milk !== null ? (
                    <Text style={styles.milkText}>{`${row.milk} ml`}</Text>
                  ) : (
                    <Text style={styles.dash}>—</Text>
                  )}
                </View>
                <View style={styles.cell}>
                  {row.pee !== null ? (
                    <LevelBadge type="pee" value={row.pee} />
                  ) : (
                    <Text style={styles.dash}>—</Text>
                  )}
                </View>
                <View style={styles.cell}>
                  {row.poop !== null ? (
                    <LevelBadge type="poop" value={row.poop} />
                  ) : (
                    <Text style={styles.dash}>—</Text>
                  )}
                </View>
                <View style={styles.cell}>
                  {row.bath ? (
                    <View
                      style={[
                        styles.levelBadge,
                        { backgroundColor: TYPE_STYLE.bath.tint },
                      ]}
                    >
                      <FontAwesome6
                        name="check"
                        size={11}
                        color={TYPE_STYLE.bath.ink}
                      />
                    </View>
                  ) : (
                    <Text style={styles.dash}>—</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <FontAwesome6 name="heart" size={18} color={COLORS.blue700} />
            </View>
            <Text
              style={styles.emptyTitle}
            >{`A fresh new day with ${BABY.name}`}</Text>
            <Text style={styles.emptyText}>
              Tap Add Record to log her first feed, diaper or bath.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.nav}>
        <NavTab icon="house" label="Home" active />
        <NavTab
          icon="clock-rotate-left"
          label="History"
          onPress={() => router.navigate("/history")}
        />
        <NavTab
          icon="baby"
          label="Baby"
          onPress={() => router.navigate("/baby-profile")}
        />
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
  glow: {
    position: "absolute",
    top: -128,
    left: -96,
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greeting: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.muted,
  },
  name: {
    marginTop: 2,
    fontFamily: FONTS.display,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.56,
    color: COLORS.ink,
  },
  meta: {
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.blue200,
    backgroundColor: "#FFFFFF",
    shadowColor: COLORS.blue700,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
    backgroundColor: COLORS.blue50,
  },
  guide: {
    marginTop: 16,
    overflow: "hidden",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.blue200,
    backgroundColor: COLORS.blue50,
    shadowColor: COLORS.blue700,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  guideGlow: {
    position: "absolute",
    top: -56,
    right: -48,
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: "rgba(167, 199, 231, 0.15)",
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  guideBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  guideTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.blue700,
  },
  guideLabel: {
    marginTop: 14,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: COLORS.muted,
  },
  guideValueRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  guideValue: {
    fontFamily: FONTS.display,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -0.76,
    color: COLORS.blue700,
  },
  guideValueCompact: {
    fontSize: 30,
    lineHeight: 34,
  },
  guideUnit: {
    marginBottom: 6,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.blue700,
  },
  guideText: {
    marginTop: 8,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(47, 58, 53, 0.8)",
  },
  guideNote: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  guideNoteText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  nextFeed: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
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
  nextIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.blue50,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBody: {
    flex: 1,
  },
  nextLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.muted,
  },
  nextTime: {
    marginTop: 2,
    fontFamily: FONTS.display,
    fontSize: 22,
    lineHeight: 26,
    color: COLORS.blue700,
  },
  nextTimeCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  nextDetail: {
    marginTop: 2,
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 19,
    lineHeight: 23,
    color: COLORS.ink,
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  statCard: {
    width: "48%",
    minHeight: 96,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  statBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily: FONTS.display,
    fontSize: 22,
    lineHeight: 26,
    color: COLORS.ink,
  },
  statValueSmall: {
    fontFamily: FONTS.display,
    fontSize: 19,
    lineHeight: 22,
    color: COLORS.ink,
  },
  statUnit: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.muted,
  },
  statLabel: {
    marginTop: 6,
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  statDot: {
    color: COLORS.blue300,
  },
  statHighlight: {
    fontFamily: FONTS.bodySemiBold,
  },
  primaryButton: {
    marginTop: 14,
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
  primaryButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.blue700,
  },
  list: {
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: "#FFFFFF",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  rowBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.ink,
  },
  rowMeta: {
    fontFamily: FONTS.body,
    color: COLORS.muted,
  },
  rowTime: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
  },
  tableHead: {
    backgroundColor: COLORS.blue50,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeCell: {
    flex: 1.6,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLORS.blue700,
  },
  timeText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
  },
  milkText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.blue700,
  },
  levelBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
  dash: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: "#C9CCC8",
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
