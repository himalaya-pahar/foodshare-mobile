import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { UseAiChat } from "./use-ai-chat";

import { AiChatBubble } from "./ai-chat-bubble";
import { AiChatInput } from "./ai-chat-input";
import { AiTypingIndicator } from "./ai-typing-indicator";
import {
  AiColors,
  AiRadius,
  AiSpacing,
  SHEET_MAX_HEIGHT_PCT,
} from "./ai-theme";

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
  chat: UseAiChat;
}

const SUGGESTED_PROMPTS = [
  "How do I request a pickup as an NGO?",
  "What food donations are accepted?",
  "How do pickup confirmations work?",
];

export function AiChatPanel({ open, onClose, chat }: AiChatPanelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  // Length is the right dep here: the hook only appends, so a new length
  // means there's new content to scroll into view. Tiny delay lets layout
  // settle before scrolling.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [open, chat.messages.length]);

  const { messages, status, error, send, retry, reset } = chat;

  // `error` covers both 422 validation and 5xx/network failures. The
  // inline Retry affordance on the user bubble handles 5xx; the same string
  // is forwarded to the input as the validation message.
  const validationMessage = error;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close AI Assistant"
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={[styles.sheetWrap]}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>FoodShare AI Assistant</Text>
                <Text style={styles.disclaimer}>
                  Informational only — cannot perform actions
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear conversation"
                  hitSlop={8}
                  onPress={reset}
                  style={({ pressed }) => [
                    styles.headerButton,
                    pressed && styles.headerButtonPressed,
                  ]}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.headerButton,
                    pressed && styles.headerButtonPressed,
                  ]}
                >
                  <Ionicons name="close" size={22} color={AiColors.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            <ScrollView
              ref={scrollRef}
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={32}
                      color={AiColors.brand}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    Ask anything about FoodShare
                  </Text>
                  <Text style={styles.emptyHint}>
                    Grounded answers on donation rules, pickup workflows, and platform policies.
                  </Text>
                  <View style={styles.promptsContainer}>
                    <Text style={styles.promptsHeader}>Suggested questions:</Text>
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <Pressable
                        key={prompt}
                        accessibilityRole="button"
                        accessibilityLabel={`Ask: ${prompt}`}
                        onPress={() => void send(prompt)}
                        style={({ pressed }) => [
                          styles.promptChip,
                          pressed && styles.promptChipPressed,
                        ]}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={13}
                          color={AiColors.brand}
                        />
                        <Text style={styles.promptChipText}>{prompt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                messages.map((m) => (
                  <AiChatBubble
                    key={m.id}
                    message={m}
                    onRetry={m.failed ? retry : undefined}
                  />
                ))
              )}

              {status === "sending" ? (
                <View style={styles.typingWrap}>
                  <AiTypingIndicator />
                </View>
              ) : null}

              {status === "error" && error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </ScrollView>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={0}
            >
              <AiChatInput
                disabled={status === "sending"}
                onSend={(text) => void send(text)}
                validationMessage={validationMessage}
              />
            </KeyboardAvoidingView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AiColors.backdrop,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetWrap: {
    width: "100%",
    // Explicit height (not maxHeight) so the inner sheet's `flex: 1` and
    // body's `flex: 1` have a definite parent height to flex against —
    // maxHeight alone leaves the wrap at intrinsic-content height, which
    // collapses the body to 0 (transparent UI symptom).
    height: SHEET_MAX_HEIGHT_PCT,
  },
  // Flex column: header (intrinsic) + body ScrollView (flex:1, fills leftover)
  // + input (intrinsic, pinned to the bottom because it's the last flex child).
  sheet: {
    flex: 1,
    backgroundColor: AiColors.sheetBg,
    borderTopLeftRadius: AiRadius.sheet,
    borderTopRightRadius: AiRadius.sheet,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: AiSpacing.four,
    paddingTop: AiSpacing.three,
    paddingBottom: AiSpacing.two,
  },
  headerLeft: {
    flex: 1,
    paddingRight: AiSpacing.two,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: AiColors.text,
  },
  disclaimer: {
    fontSize: 12,
    color: AiColors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: AiSpacing.one,
  },
  headerButton: {
    paddingHorizontal: AiSpacing.two,
    paddingVertical: AiSpacing.one,
    borderRadius: 8,
  },
  headerButtonPressed: {
    backgroundColor: AiColors.headerPressed,
  },
  clearText: {
    fontSize: 14,
    color: AiColors.textMuted,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: AiColors.border,
  },
  body: {
    flex: 1,
    backgroundColor: AiColors.inputBg,
  },
  bodyContent: {
    paddingVertical: AiSpacing.two,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AiSpacing.four,
    paddingVertical: AiSpacing.six,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: AiColors.text,
    marginTop: AiSpacing.three,
  },
  emptyHint: {
    fontSize: 13,
    color: AiColors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  typingWrap: {
    paddingHorizontal: AiSpacing.three,
    marginTop: AiSpacing.two,
  },
  errorBanner: {
    marginHorizontal: AiSpacing.three,
    marginTop: AiSpacing.two,
    padding: AiSpacing.two,
    borderRadius: AiRadius.bubble,
    backgroundColor: AiColors.errorSoft,
    borderWidth: 1,
    borderColor: AiColors.errorBorder,
  },
  errorText: {
    fontSize: 13,
    color: AiColors.error,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AiColors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: AiSpacing.one,
  },
  promptsContainer: {
    width: "100%",
    marginTop: AiSpacing.four,
    gap: AiSpacing.two,
  },
  promptsHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: AiColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
    alignSelf: "flex-start",
  },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: AiSpacing.two,
    backgroundColor: AiColors.promptChipBg,
    borderWidth: 1,
    borderColor: AiColors.promptChipBorder,
    borderRadius: AiRadius.input,
    paddingHorizontal: AiSpacing.three,
    paddingVertical: 10,
    width: "100%",
  },
  promptChipPressed: {
    backgroundColor: AiColors.brandSoft,
  },
  promptChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: AiColors.text,
    flexShrink: 1,
  },
});