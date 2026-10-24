import type { Lang } from "./messages";

const MONTHS_SHORT = [
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

const MONTHS_LONG = [
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

// "5 Oct 2026" / "2026年10月5日"
export const formatDate = (date: Date, lang: Lang, long = false) =>
  lang === "zh-Hant"
    ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getDate()} ${(long ? MONTHS_LONG : MONTHS_SHORT)[date.getMonth()]} ${date.getFullYear()}`;

// "5 Oct" / "10月5日"
export const formatMonthDay = (date: Date, lang: Lang) =>
  lang === "zh-Hant"
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;

// "3:05 PM" / "下午3:05"
export const formatClock = (hour: number, minute: number, lang: Lang) => {
  const mm = String(minute).padStart(2, "0");
  if (lang === "zh-Hant") {
    return `${hour < 12 ? "上午" : "下午"}${hour % 12 || 12}:${mm}`;
  }
  return `${hour % 12 || 12}:${mm} ${hour < 12 ? "AM" : "PM"}`;
};
