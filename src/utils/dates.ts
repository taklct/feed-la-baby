const pad = (value: number) => String(value).padStart(2, "0");

export const toDateString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const ageLabel = (dob: Date, now: Date) => {
  const days = Math.floor((now.getTime() - dob.getTime()) / 86400000);
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 +
    (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 1) return `${Math.floor(days / 7)} weeks`;
  return `${months} ${months === 1 ? "month" : "months"}`;
};
