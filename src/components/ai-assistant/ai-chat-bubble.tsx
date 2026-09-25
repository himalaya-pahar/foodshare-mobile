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
      {!isUser ? (
        <View style={styles.assistantAvatar}>
          <Ionicons name="sparkles" size={12} color="#16673E" />
        </View>
      ) : null}
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
    marginVertical: 6,
    paddingHorizontal: AiSpacing.three,
    maxWidth: "100%",
  },
  rowUser: {
    alignItems: "flex-end",
  },
  rowAssistant: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  assistantAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#E2F2E7",
    borderWidth: 1,
    borderColor: "#C4E2D0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleUser: {
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#1E8250",
    borderBottomRightRadius: 4,
    shadowColor: "#0F4628",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleAssistant: {
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#D8E5DC",
    borderBottomLeftRadius: 4,
    shadowColor: "#0B2B18",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  bubbleSoft: {
    backgroundColor: "#EDF3EF",
  },
  bubbleFailed: {
    backgroundColor: AiColors.errorSoft,
    borderWidth: 1,
    borderColor: AiColors.errorBorder,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  textUser: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  textAssistant: {
    color: "#15281D",
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