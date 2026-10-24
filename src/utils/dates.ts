import type { MessageKey } from "../i18n/messages";

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

type Translate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

const DAY_MS = 86400000;

// Age as calendar months and remaining days, e.g. "3 months, 12 days" or "12 days".
// Callers add the "old" suffix via the age.old message.
export const ageLabel = (dob: Date, now: Date, t: Translate) => {
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 +
    (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  const anchor = new Date(
    dob.getFullYear(),
    dob.getMonth() + Math.max(months, 0),
    dob.getDate(),
  );
  const days = Math.max(
    0,
    Math.round((now.getTime() - anchor.getTime()) / DAY_MS),
  );
  const dayUnit = t(days === 1 ? "unit.day.one" : "unit.day.other");
  if (months < 1) return t("age.days", { days, dayUnit });
  const monthUnit = t(months === 1 ? "unit.month.one" : "unit.month.other");
  return t("age.monthsDays", { months, monthUnit, days, dayUnit });
};
