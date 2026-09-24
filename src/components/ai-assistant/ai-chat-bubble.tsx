import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AiColors, AiRadius, AiSpacing } from "./ai-theme";
import type { ChatMessage } from "./types";

type AnswerBlock =
  | { kind: "bullet"; text: string }
  | { kind: "paragraph"; text: string };

const BULLET_RE = /^(?:[-*•]|\d+\.)\s+(.+)$/;
// Trailing sources block: the backend sometimes inlines sources at the end of the
// `answer` field in one of two shapes. We strip it from the prose so sources
// render cleanly via structured sources chips instead.
const TRAILING_SOURCES_RE =
  /\n\s*[*\-•]?\s*sources?\s*:\s*(?:\r?\n)+(?:[ \t]*\r?\n)*(?:[ \t]*(?:[*\-•]?\s*source:|.*,\s*section\b).*(?:\r?\n|$))+.*$/i;

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
      text: paragraphBuffer.join(" ").trim(),
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
      blocks.push({ kind: "bullet", text: bulletMatch[1] });
      continue;
    }
    paragraphBuffer.push(trimmed);
  }
  flushParagraph();
  return blocks;
}

function renderFormattedText(text: string, baseStyle: object) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={index} style={[baseStyle, styles.boldText]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text key={index} style={[baseStyle, styles.codeText]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text key={index} style={baseStyle}>
        {part}
      </Text>
    );
  });
}

interface AiChatBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

function AiChatBubbleImpl({ message, onRetry }: AiChatBubbleProps) {
  const isUser = message.role === "user";
  // Subtle tint for refusals / safe-fallbacks
  const isSoft =
    !isUser &&
    (message.scope === "out_of_domain" || message.scope === "no_evidence");
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
          <>
            {blocks!.map((block, i) =>
              block.kind === "bullet" ? (
                <View key={i} style={styles.bulletRow}>
                  <Text
                    style={[
                      styles.text,
                      styles.textAssistant,
                      styles.bulletMarker,
                    ]}
                  >
                    •
                  </Text>
                  <Text
                    style={[styles.text, styles.textAssistant, styles.bulletText]}
                  >
                    {renderFormattedText(block.text, [
                      styles.text,
                      styles.textAssistant,
                    ])}
                  </Text>
                </View>
              ) : (
                <Text
                  key={i}
                  style={[
                    styles.text,
                    styles.textAssistant,
                    styles.paragraphText,
                  ]}
                >
                  {renderFormattedText(block.text, [
                    styles.text,
                    styles.textAssistant,
                  ])}
                </Text>
              ),
            )}

            {message.sources && message.sources.length > 0 ? (
              <View style={styles.sourcesContainer}>
                <View style={styles.sourcesHeader}>
                  <Ionicons
                    name="book-outline"
                    size={12}
                    color={AiColors.textMuted}
                  />
                  <Text style={styles.sourcesTitle}>Verified Sources</Text>
                </View>
                <View style={styles.sourcesList}>
                  {message.sources.map((src, idx) => (
                    <View key={idx} style={styles.sourceChip}>
                      <Ionicons
                        name="document-text-outline"
                        size={12}
                        color={AiColors.brand}
                      />
                      <Text style={styles.sourceChipText} numberOfLines={1}>
                        {src.document}
                        {src.section ? ` · ${src.section}` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}

        {message.failed && onRetry ? (
          <View style={styles.retryRow}>
            <Text style={styles.retryHint}>
              AI assistant is temporarily unavailable.
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
  boldText: {
    fontWeight: "700",
    color: AiColors.text,
  },
  codeText: {
    fontFamily: "monospace",
    backgroundColor: AiColors.softBubble,
    fontSize: 13,
  },
  sourcesContainer: {
    marginTop: AiSpacing.two,
    paddingTop: AiSpacing.two,
    borderTopWidth: 1,
    borderTopColor: AiColors.border,
  },
  sourcesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: AiSpacing.one,
  },
  sourcesTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: AiColors.textMuted,
  },
  sourcesList: {
    flexDirection: "column",
    gap: 4,
  },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AiColors.sourceChipBg,
    borderWidth: 1,
    borderColor: AiColors.sourceChipBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  sourceChipText: {
    fontSize: 11,
    color: AiColors.text,
    flexShrink: 1,
  },
});