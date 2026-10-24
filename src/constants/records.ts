import { COLORS } from "./theme";

export type RecordType = "milk" | "pee" | "poop" | "bath";

export const TYPE_STYLE: Record<
  RecordType,
  { label: string; tint: string; ink: string }
> = {
  milk: { label: "Milk", tint: COLORS.blue100, ink: COLORS.blue700 },
  pee: { label: "Pee", tint: COLORS.skySoft, ink: COLORS.skyInk },
  poop: { label: "Poop", tint: COLORS.sandSoft, ink: COLORS.sandInk },
  bath: { label: "Bath", tint: COLORS.lilacSoft, ink: COLORS.lilacInk },
};
