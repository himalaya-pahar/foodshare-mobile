import { Spacing } from "@/constants/theme";

/**
 * Visual tokens scoped to the AI Assistant widget — kept here (not in the
 * global theme) so the widget can be lifted out without dragging the rest
 * of the app.
 */
export const AiColors = {
  brand: "#16673E",
  brandSoft: "#E3F3E8",
  brandPressed: "#114F2F",
  text: "#15281D",
  textMuted: "#546A5D",
  border: "#D5E2DA",
  sheetBg: "#F4F7F4",
  cardBg: "#FAFDFB",
  backdrop: "rgba(10, 24, 16, 0.45)",
  shadow: "#0C311C",
  error: "#27362D",
  errorSoft: "#F2F5F3",
  inputBg: "#FFFFFF",
  headerPressed: "#E5EEE8",
  softBubble: "#EDF3EF",
  errorBorder: "#D5E0D8",
  errorButtonPressed: "#E4ECE7",
  sourceChipBg: "#EBF3EE",
  sourceChipBorder: "#CFE0D5",
  promptChipBg: "#FAFDFB",
  promptChipBorder: "#D4E3D9",
} as const;

export const AiSpacing = Spacing;

export const AiRadius = {
  fab: 28,
  bubble: 18,
  sheet: 26,
  input: 16,
} as const;

/** Maximum height of the chat sheet, as a fraction of screen height. */
export const SHEET_MAX_HEIGHT_PCT = "90%" as const;
