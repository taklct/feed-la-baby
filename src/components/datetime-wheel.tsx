import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/theme";

const ITEM_H = 40;
const VISIBLE = 5;
const DAYS_BACK = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Props = {
  value: Date;
  maximum: Date;
  onChange: (date: Date) => void;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

const dayLabel = (date: Date, today: Date) => {
  const days = Math.round((startOfDay(today) - startOfDay(date)) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

const hourLabel = (hour: number) => String(hour).padStart(2, "0");

const minuteLabel = (minute: number) => String(minute).padStart(2, "0");

export function DateTimeWheel({ value, maximum, onChange }: Props) {
  const days = Array.from({ length: DAYS_BACK + 1 }, (_, i) => {
    const offset = DAYS_BACK - i;
    return new Date(
      maximum.getFullYear(),
      maximum.getMonth(),
      maximum.getDate() - offset,
    );
  });
  const dayIndex = clamp(
    DAYS_BACK - Math.round((startOfDay(maximum) - startOfDay(value)) / DAY_MS),
    DAYS_BACK,
  );

  const withDay = (dayDate: Date) =>
    onChange(
      new Date(
        dayDate.getFullYear(),
        dayDate.getMonth(),
        dayDate.getDate(),
        value.getHours(),
        value.getMinutes(),
      ),
    );
  const withHour = (hour: number) =>
    onChange(
      new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        hour,
        value.getMinutes(),
      ),
    );
  const withMinute = (minute: number) =>
    onChange(
      new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        value.getHours(),
        minute,
      ),
    );

  return (
    <View style={styles.wheels}>
      <Column
        labels={days.map((d) => dayLabel(d, maximum))}
        index={dayIndex}
        onSelect={(i) => withDay(days[i])}
      />
      <Column
        labels={Array.from({ length: 24 }, (_, h) => hourLabel(h))}
        index={value.getHours()}
        onSelect={withHour}
      />
      <Column
        labels={Array.from({ length: 60 }, (_, m) => minuteLabel(m))}
        index={value.getMinutes()}
        onSelect={withMinute}
      />
      <View style={styles.band} pointerEvents="none" />
    </View>
  );
}

type ColumnProps = {
  labels: string[];
  index: number;
  onSelect: (index: number) => void;
};

function Column({ labels, index, onSelect }: ColumnProps) {
  const ref = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const settle = (y: number) => {
    const next = clamp(Math.round(y / ITEM_H), labels.length - 1);
    ref.current?.scrollTo({ y: next * ITEM_H, animated: true });
    if (next !== index) onSelect(next);
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.column}
      contentContainerStyle={styles.columnPadding}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={(event) => {
        const y = event.nativeEvent.contentOffset.y;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => settle(y), 120);
      }}
    >
      {labels.map((label, i) => (
        <View key={label + i} style={styles.item}>
          <Text style={[styles.itemText, i === index && styles.itemOn]}>
            {label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wheels: {
    height: ITEM_H * VISIBLE,
    flexDirection: "row",
    overflow: "hidden",
  },
  column: {
    flex: 1,
  },
  columnPadding: {
    paddingVertical: ITEM_H * Math.floor(VISIBLE / 2),
  },
  item: {
    height: ITEM_H,
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    fontSize: 16,
    color: COLORS.ink,
    opacity: 0.4,
  },
  itemOn: {
    opacity: 1,
    fontWeight: "600",
  },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ITEM_H * Math.floor(VISIBLE / 2),
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.blue600,
  },
});
