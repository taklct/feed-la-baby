import { FontAwesome6 } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment, useCallback, useState, type ComponentProps } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { BottomNav } from "../components/bottom-nav";
import { TYPE_STYLE, type RecordType } from "../constants/records";
import { COLORS, FONTS } from "../constants/theme";
import { loadTrends, type DayStat, type TrendsData } from "../db/trends";
import { formatMonthDay, formatDate } from "../i18n/format";
import { useI18n } from "../i18n/i18n";
import type { Lang, MessageKey } from "../i18n/messages";

type IconName = ComponentProps<typeof FontAwesome6>["name"];
type Period = 7 | 30;
type ViewMode = "chart" | "table";
type MetricKey = "milk" | "feeds" | "pee" | "poop";

const CHART_HEIGHT = 180;
const WEIGHT_CHART_HEIGHT = 200;
const CHART_PAD = 8;
const INK = "#8C948F";

const METRICS: {
  key: MetricKey;
  label: MessageKey;
  type: RecordType;
  icon: IconName;
  decimals: number;
}[] = [
  {
    key: "milk",
    label: "common.milk",
    type: "milk",
    icon: "bottle-water",
    decimals: 0,
  },
  {
    key: "feeds",
    label: "dash.feeds",
    type: "milk",
    icon: "repeat",
    decimals: 1,
  },
  {
    key: "pee",
    label: "common.pee",
    type: "pee",
    icon: "droplet",
    decimals: 1,
  },
  {
    key: "poop",
    label: "common.poop",
    type: "poop",
    icon: "cookie-bite",
    decimals: 1,
  },
];

const valueOf = (day: DayStat, key: MetricKey) => day[key];
const isMissing = (day: DayStat) => day.count === 0 && !day.isToday;

const formatWeight = (kg: number) => kg.toFixed(2);

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

function ViewToggle({
  value,
  onChange,
  t,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
  t: (key: MessageKey) => string;
}) {
  const options: { key: ViewMode; icon: IconName; label: MessageKey }[] = [
    { key: "chart", icon: "chart-column", label: "dash.chart" },
    { key: "table", icon: "table-list", label: "dash.table" },
  ];
  return (
    <View style={styles.toggle} accessibilityRole="tablist">
      {options.map((option) => {
        const on = value === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityLabel={t(option.label)}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.key)}
            style={[styles.toggleItem, on && styles.toggleItemActive]}
          >
            <FontAwesome6
              name={option.icon}
              size={12}
              color={on ? COLORS.blue700 : INK}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function ActivityBars({
  days,
  metric,
  width,
  lang,
  todayLabel,
  showTarget,
}: {
  days: DayStat[];
  metric: (typeof METRICS)[number];
  width: number;
  lang: Lang;
  todayLabel: string;
  showTarget: boolean;
}) {
  const style = TYPE_STYLE[metric.type];
  const max = Math.max(
    1,
    ...days.map((d) => (showTarget ? (d.targetMl ?? 0) : 0)),
    ...days.filter((d) => !isMissing(d)).map((d) => valueOf(d, metric.key)),
  );
  const slot = width / Math.max(days.length, 1);
  const barWidth = Math.max(2, slot * 0.6);
  const labelStep = days.length > 10 ? 5 : 1;
  const plotHeight = CHART_HEIGHT - 24;
  const targetPoints = days
    .map((day, index) => {
      if (!showTarget || day.targetMl === null) return null;
      const x = index * slot + slot / 2;
      const y = plotHeight - (day.targetMl / max) * (plotHeight - CHART_PAD);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {days.map((day, index) => {
        const x = index * slot + (slot - barWidth) / 2;
        const value = valueOf(day, metric.key);
        const barHeight = (value / max) * (plotHeight - CHART_PAD);
        const y = plotHeight - barHeight;
        const showLabel = (days.length - 1 - index) % labelStep === 0;
        return (
          <Fragment key={day.start}>
            {isMissing(day) ? null : (
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={3}
                fill={style.ink}
                opacity={day.isToday ? 0.35 : 1}
              />
            )}
            {showLabel ? (
              <SvgText
                x={x + barWidth / 2}
                y={CHART_HEIGHT - 4}
                fontSize={10}
                fill={COLORS.muted}
                textAnchor="middle"
              >
                {day.isToday
                  ? todayLabel
                  : formatMonthDay(new Date(day.start), lang)}
              </SvgText>
            ) : null}
          </Fragment>
        );
      })}
      {targetPoints ? (
        <Polyline
          points={targetPoints}
          fill="none"
          stroke={style.ink}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}
    </Svg>
  );
}

function WeightChart({
  points,
  width,
}: {
  points: { time: number; kg: number }[];
  width: number;
}) {
  if (points.length === 0 || width === 0) return null;
  const times = points.map((p) => p.time);
  const kgs = points.map((p) => p.kg);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const kgMin = Math.min(...kgs);
  const kgMax = Math.max(...kgs);
  const kgPad = Math.max((kgMax - kgMin) * 0.15, 0.2);
  const yMin = kgMin - kgPad;
  const yMax = kgMax + kgPad;
  const innerW = width - 40;
  const innerH = WEIGHT_CHART_HEIGHT - 28;

  const xOf = (time: number) =>
    tMax === tMin
      ? 40 + innerW / 2
      : 40 + ((time - tMin) / (tMax - tMin)) * innerW;
  const yOf = (kg: number) =>
    6 + innerH - ((kg - yMin) / (yMax - yMin)) * innerH;
  const coords = points.map((p) => ({
    x: xOf(p.time),
    y: yOf(p.kg),
    kg: p.kg,
  }));

  return (
    <Svg width={width} height={WEIGHT_CHART_HEIGHT}>
      <Line
        x1={40}
        x2={width}
        y1={6}
        y2={6}
        stroke={COLORS.line}
        strokeWidth={1}
      />
      <Line
        x1={40}
        x2={width}
        y1={6 + innerH}
        y2={6 + innerH}
        stroke={COLORS.line}
        strokeWidth={1}
      />
      <SvgText x={0} y={12} fontSize={10} fill={COLORS.muted}>
        {yMax.toFixed(2)}
      </SvgText>
      <SvgText x={0} y={6 + innerH} fontSize={10} fill={COLORS.muted}>
        {yMin.toFixed(2)}
      </SvgText>
      {coords.length > 1 ? (
        <Polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke={COLORS.blue700}
          strokeWidth={2}
        />
      ) : null}
      {coords.map((c, index) => (
        <Circle key={index} cx={c.x} cy={c.y} r={4} fill={COLORS.blue700} />
      ))}
    </Svg>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<Period>(7);
  const [data, setData] = useState<TrendsData | null>(null);
  const [metric, setMetric] = useState<MetricKey>("milk");
  const [activityView, setActivityView] = useState<ViewMode>("chart");
  const [growthView, setGrowthView] = useState<ViewMode>("chart");
  const [chartWidth, setChartWidth] = useState(0);
  const [weightWidth, setWeightWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadTrends(period).then(setData);
    }, [period]),
  );

  if (data === null) return null;
  if (data.baby === null) return <Redirect href="/baby-setup" />;

  const days = data.days;
  const complete = days.filter((d) => !isMissing(d) && !d.isToday);
  const selected = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const style = TYPE_STYLE[selected.type];
  const showTarget =
    selected.key === "milk" && days.some((d) => d.targetMl !== null);

  const averageOf = (key: MetricKey) => {
    if (complete.length === 0) return null;
    return (
      complete.reduce((sum, d) => sum + valueOf(d, key), 0) / complete.length
    );
  };

  const weights = data.weights;
  const latestWeight = weights[weights.length - 1];
  const firstWeight = weights[0];
  const weightChange =
    latestWeight && firstWeight && latestWeight !== firstWeight
      ? latestWeight.kg - firstWeight.kg
      : null;
  const weightPoints = weights.map((w) => ({
    time: parseDate(w.date).getTime(),
    kg: w.kg,
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("dash.title")}</Text>
          <Text style={styles.subtitle}>
            {t("dash.subtitle", { name: data.baby.name })}
          </Text>
        </View>

        <View style={styles.periodRow} accessibilityRole="radiogroup">
          {([7, 30] as const).map((value) => {
            const on = period === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setPeriod(value)}
                style={[styles.periodItem, on && styles.periodItemActive]}
              >
                <Text
                  style={[styles.periodText, on && styles.periodTextActive]}
                >
                  {t(value === 7 ? "dash.period7" : "dash.period30")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t("dash.activity")}</Text>
            <ViewToggle value={activityView} onChange={setActivityView} t={t} />
          </View>
          <Text style={styles.cardHint}>{t("dash.activityHint")}</Text>

          <View style={styles.tiles}>
            {METRICS.map((m) => {
              const on = metric === m.key;
              const avg = averageOf(m.key);
              const tileStyle = TYPE_STYLE[m.type];
              const value =
                avg === null
                  ? "—"
                  : m.decimals === 0
                    ? String(Math.round(avg))
                    : avg.toFixed(m.decimals);
              return (
                <Pressable
                  key={m.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${t(m.label)}: ${value}`}
                  onPress={() => setMetric(m.key)}
                  style={[styles.tile, on && styles.tileActive]}
                >
                  <View
                    style={[
                      styles.tileIcon,
                      { backgroundColor: tileStyle.tint },
                    ]}
                  >
                    <FontAwesome6
                      name={m.icon}
                      size={11}
                      color={tileStyle.ink}
                    />
                  </View>
                  <Text
                    style={[styles.tileValue, on && styles.tileValueActive]}
                  >
                    {value}
                  </Text>
                  <Text style={styles.tileLabel} numberOfLines={1}>
                    {t(m.label)} {t("dash.perDay")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activityView === "chart" ? (
            <View
              style={styles.chartArea}
              onLayout={(e: LayoutChangeEvent) =>
                setChartWidth(e.nativeEvent.layout.width)
              }
            >
              {days.every((d) => d.count === 0) ? (
                <Text style={styles.emptyText}>{t("dash.noActivity")}</Text>
              ) : (
                <>
                  {chartWidth > 0 ? (
                    <ActivityBars
                      days={days}
                      metric={selected}
                      width={chartWidth}
                      lang={lang}
                      todayLabel={t("common.today")}
                      showTarget={showTarget}
                    />
                  ) : null}
                  <View style={styles.legend}>
                    <View style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendSwatch,
                          { backgroundColor: style.ink, opacity: 0.35 },
                        ]}
                      />
                      <Text style={styles.legendText}>
                        {t("dash.inProgress")}
                      </Text>
                    </View>
                    <View style={styles.legendItem}>
                      <Text style={styles.legendDash}>—</Text>
                      <Text style={styles.legendText}>
                        {t("dash.noRecords")}
                      </Text>
                    </View>
                    {showTarget ? (
                      <View style={styles.legendItem}>
                        <View
                          style={[
                            styles.legendTarget,
                            { borderColor: style.ink },
                          ]}
                        />
                        <Text style={styles.legendText}>
                          {t("dash.dailyTarget")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.cellDate, styles.headText]}>
                  {t("dash.date")}
                </Text>
                <Text style={[styles.cell, styles.headText]}>
                  {t("common.milk")}
                </Text>
                <Text style={[styles.cell, styles.headText]}>
                  {t("dash.feeds")}
                </Text>
                <Text style={[styles.cell, styles.headText]}>
                  {t("common.pee")}
                </Text>
                <Text style={[styles.cell, styles.headText]}>
                  {t("common.poop")}
                </Text>
              </View>
              {[...days].reverse().map((day, index) => {
                const missing = isMissing(day);
                return (
                  <View
                    key={day.start}
                    style={[styles.tableRow, index > 0 && styles.rowDivider]}
                  >
                    <Text style={[styles.cellDate, styles.dateText]}>
                      {day.isToday
                        ? t("common.today")
                        : formatMonthDay(new Date(day.start), lang)}
                    </Text>
                    {(["milk", "feeds", "pee", "poop"] as const).map((key) => (
                      <Text key={key} style={styles.cell}>
                        {missing ? "—" : valueOf(day, key)}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t("dash.growth")}</Text>
            <ViewToggle value={growthView} onChange={setGrowthView} t={t} />
          </View>
          <Text style={styles.cardHint}>
            {latestWeight
              ? t("dash.lastMeasured", {
                  date: formatDate(parseDate(latestWeight.date), lang, false),
                })
              : t("dash.growthHint")}
          </Text>

          {latestWeight ? (
            <View style={styles.statsStrip}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t("dash.latest")}</Text>
                <Text style={styles.statValue}>
                  {formatWeight(latestWeight.kg)}
                  <Text style={styles.statUnit}> kg</Text>
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t("dash.sinceFirst")}</Text>
                <Text style={styles.statValue}>
                  {weightChange === null
                    ? "—"
                    : `${weightChange >= 0 ? "+" : "−"}${Math.abs(weightChange).toFixed(2)}`}
                  <Text style={styles.statUnit}> kg</Text>
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t("dash.weight")}</Text>
                <Text style={styles.statValue}>{weights.length}</Text>
              </View>
            </View>
          ) : null}

          {growthView === "chart" ? (
            <View
              style={styles.chartArea}
              onLayout={(e: LayoutChangeEvent) =>
                setWeightWidth(e.nativeEvent.layout.width)
              }
            >
              {weights.length === 0 ? (
                <Text style={styles.emptyText}>{t("baby.noWeight")}</Text>
              ) : (
                <WeightChart points={weightPoints} width={weightWidth} />
              )}
            </View>
          ) : (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.cellDate, styles.headText]}>
                  {t("dash.date")}
                </Text>
                <Text style={[styles.cell, styles.headText]}>
                  {t("dash.weight")}
                </Text>
              </View>
              {[...weights].reverse().map((w, index) => (
                <View
                  key={w.id}
                  style={[styles.tableRow, index > 0 && styles.rowDivider]}
                >
                  <Text style={[styles.cellDate, styles.dateText]}>
                    {formatDate(parseDate(w.date), lang, false)}
                  </Text>
                  <Text style={styles.cell}>{formatWeight(w.kg)} kg</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/update-weight")}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
          >
            <FontAwesome6 name="plus" size={12} color={COLORS.blue700} />
            <Text style={styles.addButtonText}>{t("dash.addMeasurement")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav active="dashboard" />

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
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
  periodRow: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.line,
    alignSelf: "flex-start",
  },
  periodItem: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: "center",
  },
  periodItemActive: {
    backgroundColor: COLORS.blue100,
  },
  periodText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: INK,
  },
  periodTextActive: {
    color: COLORS.blue700,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontFamily: FONTS.display,
    fontSize: 19,
    color: COLORS.ink,
  },
  cardHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
  },
  toggle: {
    flexDirection: "row",
    gap: 4,
    padding: 2,
    borderRadius: 8,
    backgroundColor: COLORS.blue50,
  },
  toggleItem: {
    width: 32,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleItemActive: {
    backgroundColor: "#FFFFFF",
  },
  tiles: {
    flexDirection: "row",
    gap: 6,
  },
  tile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 8,
    gap: 4,
  },
  tileActive: {
    borderColor: COLORS.blue600,
    backgroundColor: COLORS.blue50,
  },
  tileIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tileValue: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.ink,
  },
  tileValueActive: {
    color: COLORS.blue700,
  },
  tileLabel: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.muted,
  },
  chartArea: {
    marginTop: 4,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.muted,
    paddingVertical: 24,
    textAlign: "center",
  },
  legend: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendTarget: {
    width: 14,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
  },
  legendDash: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: "#A9B6BE",
  },
  legendText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.muted,
  },
  table: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: "hidden",
    marginTop: 4,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableHead: {
    backgroundColor: COLORS.blue50,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
  },
  headText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: COLORS.blue700,
    textTransform: "uppercase",
  },
  cellDate: {
    flex: 1.4,
  },
  cell: {
    flex: 1,
    textAlign: "right",
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.ink,
  },
  dateText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.ink,
  },
  statsStrip: {
    flexDirection: "row",
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingVertical: 10,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  statValue: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.ink,
  },
  statUnit: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.blue700,
    backgroundColor: "#FFFFFF",
  },
  addButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.blue700,
  },
  pressed: {
    opacity: 0.85,
  },
});
