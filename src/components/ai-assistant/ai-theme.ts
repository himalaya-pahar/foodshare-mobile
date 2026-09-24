import { Spacing } from "@/constants/theme";

/**
 * Visual tokens scoped to the AI Assistant widget — kept here (not in the
 * global theme) so the widget can be lifted out without dragging the rest
 * of the app.
 */
export const AiColors = {
  brand: "#176B43",
  brandSoft: "#DDF3E4",
  brandPressed: "#12593A",
  text: "#17251B",
  textMuted: "#526057",
  border: "#E5EBE7",
  sheetBg: "#FFFFFF",
  backdrop: "rgba(0, 0, 0, 0.4)",
  shadow: "#0D3B22",
  error: "#B42318",
  errorSoft: "#FFF0EE",
  inputBg: "#F4F7F3",
  headerPressed: "#EEF1EF",
  softBubble: "#F2F4F2",
  errorBorder: "#F5C5BF",
  errorButtonPressed: "#FBE3DF",
  sourceChipBg: "#F0F5F2",
  sourceChipBorder: "#D5E3DA",
  promptChipBg: "#F3F7F4",
  promptChipBorder: "#DEE7E1",
} as const;

export const AiSpacing = Spacing;

export const AiRadius = {
  fab: 28,
  bubble: 16,
  sheet: 24,
  input: 14,
} as const;

/** Maximum height of the chat sheet, as a fraction of screen height. */
export const SHEET_MAX_HEIGHT_PCT = "88%" as const;
