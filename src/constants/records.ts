import type { MessageKey } from "../i18n/messages";
import { COLORS } from "./theme";

export type RecordType = "milk" | "pee" | "poop" | "bath";

// label is a message key; resolve it with t(style.label).
export const TYPE_STYLE: Record<
  RecordType,
  { label: MessageKey; tint: string; ink: string }
> = {
  milk: { label: "common.milk", tint: COLORS.blue100, ink: COLORS.blue700 },
  pee: { label: "common.pee", tint: COLORS.skySoft, ink: COLORS.skyInk },
  poop: { label: "common.poop", tint: COLORS.sandSoft, ink: COLORS.sandInk },
  bath: { label: "common.bath", tint: COLORS.lilacSoft, ink: COLORS.lilacInk },
};
