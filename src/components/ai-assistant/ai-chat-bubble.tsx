import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AiColors, AiRadius, AiSpacing } from "./ai-theme";
import type { ChatMessage } from "./types";

type AnswerBlock =
  | { kind: "bullet"; text: string }
  | { kind: "paragraph"; text: string };

// Compiled once at module load — formatAnswer() may be called many times
// per assistant bubble as the chat re-renders.
const INLINE_BOLD_RE = /\*\*([^*]+)\*\*/g;
const INLINE_ITALIC_RE = /(^|[^*])\*([^*]+)\*/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const BULLET_RE = /^(?:[-*•]|\d+\.)\s+(.+)$/;
// Trailing sources block: the backend inlines sources at the end of the
// `answer` field in one of two shapes:
//
//   Shape A (bulleted list):
//     <prose answer>
//
//     Sources:
//
//     • Source: doc.md, section 'Foo'
//     • Source: doc.md, section "Bar"
//
//   Shape B (heading + continuation):
//     <prose answer>
//
//     Source:
//     doc.md, section 'Foo'
//
// We strip both shapes before markdown parsing. Each source entry is
// recognized as either a line starting with "Source:" OR a line containing
// ", section" — the latter is the giveaway for Shape B's continuation line,
// which has no "Source:" prefix.
//   - Anchored at end of string
//   - Case-insensitive on the header word
//   - Stops at the first non-matching, non-blank line so we never eat real prose
const TRAILING_SOURCES_RE =
  /\n\s*[*\-•]?\s*sources?\s*:\s*(?:\r?\n)+(?:[ \t]*\r?\n)*(?:[ \t]*(?:[*\-•]?\s*source:|.*,\s*section\b).*(?:\r?\n|$))+.*$/i;

function stripInlineMarkdown(input: string): string {
  let out = input.replace(INLINE_BOLD_RE, "$1");
  out = out.replace(INLINE_ITALIC_RE, "$1$2");
  out = out.replace(INLINE_CODE_RE, "$1");
  return out;
}

// Backend often appends a sources list to the assistant's `answer` field.
// Drop it so the user only sees the prose reply.
function stripTrailingSources(raw: string): string {
  return raw.replace(TRAILING_SOURCES_RE, "").trimEnd();
}

function formatAnswer(raw: string): AnswerBlock[] {
  const cleaned = stripTrailingSources(raw);
  const lines = cleaned.replace(/\r\n/g, "\n").split("\n");
  const blocks: AnswerBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    blocks.push({
      kind: "paragraph",
      text: stripInlineMarkdown(paragraphBuffer.join(" ").trim()),
    });
    paragraphBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flushParagraph();
      continue;
    }
    const bulletMatch = BULLET_RE.exec(trimmed);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({ kind: "bullet", text: stripInlineMarkdown(bulletMatch[1]) });
      continue;
    }
    paragraphBuffer.push(trimmed);
  }
  flushParagraph();
  return blocks;
}

interface AiChatBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

function AiChatBubbleImpl({ message, onRetry }: AiChatBubbleProps) {
  const isUser = message.role === "user";
  // Subtle grey tint for refusals / safe-fallbacks so the user can tell at a
  // glance that the assistant didn't actually answer.
  const isSoft =
    !isUser && (message.scope === "out_of_domain" || message.scope === "no_evidence");
  const blocks = useMemo(
    () => (isUser ? null : formatAnswer(message.text)),
    [isUser, message.text],
  );

  return (
    <View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          isSoft && styles.bubbleSoft,
          message.failed && styles.bubbleFailed,
        ]}
      >
        {isUser ? (
          <Text style={[styles.text, styles.textUser]}>{message.text}</Text>
        ) : (
          blocks!.map((block, i) =>
            block.kind === "bullet" ? (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.text, styles.textAssistant, styles.bulletMarker]}>
                  •
                </Text>
                <Text
                  style={[styles.text, styles.textAssistant, styles.bulletText]}
                >
                  {block.text}
                </Text>
              </View>
            ) : (
              <Text
                key={i}
                style={[styles.text, styles.textAssistant, styles.paragraphText]}
              >
                {block.text}
              </Text>
            ),
          )
        )}

        {message.failed && onRetry ? (
          <View style={styles.retryRow}>
            <Text style={styles.retryHint}>
              Couldn’t reach the AI.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry last message"
              hitSlop={8}
              onPress={onRetry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const AiChatBubble = memo(AiChatBubbleImpl);

const styles = StyleSheet.create({
  row: {
    marginVertical: AiSpacing.one,
    paddingHorizontal: AiSpacing.three,
    maxWidth: "100%",
  },
  rowUser: {
    alignItems: "flex-end",
  },
  rowAssistant: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: AiRadius.bubble,
    paddingHorizontal: AiSpacing.three,
    paddingVertical: AiSpacing.two + 2,
  },
  bubbleUser: {
    backgroundColor: AiColors.brandSoft,
    borderTopRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: AiColors.sheetBg,
    borderWidth: 1,
    borderColor: AiColors.border,
    borderTopLeftRadius: 4,
  },
  bubbleSoft: {
    backgroundColor: AiColors.softBubble,
  },
  bubbleFailed: {
    backgroundColor: AiColors.errorSoft,
    borderWidth: 1,
    borderColor: AiColors.errorBorder,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textUser: {
    color: AiColors.text,
  },
  textAssistant: {
    color: AiColors.text,
  },
  paragraphText: {
    marginBottom: AiSpacing.two,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: AiSpacing.one,
  },
  bulletMarker: {
    width: 14,
    lineHeight: 21,
  },
  bulletText: {
    flexShrink: 1,
  },
  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: AiSpacing.two,
    flexWrap: "wrap",
  },
  retryHint: {
    fontSize: 12,
    color: AiColors.error,
    marginRight: AiSpacing.two,
  },
  retryButton: {
    paddingHorizontal: AiSpacing.two,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AiColors.error,
  },
  retryButtonPressed: {
    backgroundColor: AiColors.errorButtonPressed,
  },
  retryButtonText: {
    fontSize: 12,
    color: AiColors.error,
    fontWeight: "600",
  },
});