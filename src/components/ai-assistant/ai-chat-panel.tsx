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

interface SuggestedQuestion {
  id: string;
  category: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  prompt: string;
}

const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    id: "food-safety",
    category: "Food Safety",
    icon: "restaurant",
    title: "Safe Surplus Food Donations",
    subtitle: "What cooked and packaged food items restaurants can donate",
    prompt: "What types of surplus food can restaurants donate safely on FoodShare, and what items are restricted?",
  },
  {
    id: "storage-rules",
    category: "Storage & Safety",
    icon: "thermometer-outline",
    title: "Temperature & Packing Standards",
    subtitle: "Hygiene standards and packing required before NGO handover",
    prompt: "What are the temperature control and packaging rules for food donations before pickup?",
  },
  {
    id: "ngo-flow",
    category: "NGO Logistics",
    icon: "car-outline",
    title: "Claiming & Scheduling Pickups",
    subtitle: "Step-by-step claiming process and arrival window coordination",
    prompt: "How does an NGO claim available food surplus and schedule a verified pickup window?",
  },
  {
    id: "verification",
    category: "Verification",
    icon: "shield-checkmark-outline",
    title: "Handover Verification & Safety",
    subtitle: "How verification codes work between restaurant and driver",
    prompt: "How does the pickup verification code work during food handover at the restaurant?",
  },
  {
    id: "delays",
    category: "Policies & Delays",
    icon: "time-outline",
    title: "Handling Delays & Expiry Windows",
    subtitle: "What to do when pickup deadline passes or driver is delayed",
    prompt: "What should be done if an NGO pickup is delayed or the food deadline passes?",
  },
];

export function AiChatPanel({ open, onClose, chat }: AiChatPanelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [open, chat.messages.length]);

  const { messages, status, error, send, retry, reset } = chat;
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.root}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close AI Assistant"
          style={styles.backdrop}
          onPress={onClose}
        />

        <View style={styles.sheetWrap}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.headerIconWrap}>
                    <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                  </View>
                  <Text style={styles.title}>FoodShare AI</Text>
                  <View style={styles.headerBadge}>
                    <View style={styles.headerBadgeDot} />
                    <Text style={styles.headerBadgeText}>Live</Text>
                  </View>
                </View>
                <Text style={styles.disclaimer}>
                  Instant guidance for donors, NGOs & food safety
                </Text>
              </View>

              <View style={styles.headerActions}>
                {messages.length > 0 ? (
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
                    <Ionicons name="trash-outline" size={16} color="#5A7163" />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={8}
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.closeButton,
                    pressed && styles.closeButtonPressed,
                  ]}
                >
                  <Ionicons name="close" size={18} color="#233B2C" />
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
                  <View style={styles.heroCard}>
                    <View style={styles.emptyIconWrap}>
                      <Ionicons name="sparkles" size={24} color="#16673E" />
                    </View>
                    <Text style={styles.emptyTitle}>
                      FoodShare Intelligence
                    </Text>
                    <Text style={styles.emptyHint}>
                      Ask questions about food safety guidelines, NGO pickup workflows, packaging standards, and community policies.
                    </Text>
                  </View>

                  <View style={styles.promptsContainer}>
                    <View style={styles.promptsHeaderRow}>
                      <Ionicons name="bulb-outline" size={14} color="#16673E" />
                      <Text style={styles.promptsHeader}>Meaningful suggested questions</Text>
                    </View>

                    {SUGGESTED_QUESTIONS.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Ask: ${item.title}`}
                        onPress={() => void send(item.prompt)}
                        style={({ pressed }) => [
                          styles.promptCard,
                          pressed && styles.promptCardPressed,
                        ]}
                      >
                        <View style={styles.promptIconWrap}>
                          <Ionicons
                            name={item.icon}
                            size={16}
                            color="#16673E"
                          />
                        </View>
                        <View style={styles.promptTextWrap}>
                          <View style={styles.promptMetaRow}>
                            <Text style={styles.promptCategory}>{item.category}</Text>
                          </View>
                          <Text style={styles.promptTitle}>{item.title}</Text>
                          <Text style={styles.promptSubtitle}>{item.subtitle}</Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#7B9284"
                        />
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

            <AiChatInput
              disabled={status === "sending"}
              onSend={(text) => void send(text)}
              validationMessage={validationMessage}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    height: SHEET_MAX_HEIGHT_PCT,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#F4F7F4",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: "#FAFDFB",
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBDAD0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#FAFDFB",
  },
  headerLeft: {
    flex: 1,
    gap: 3,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#16673E",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#13281B",
    letterSpacing: -0.3,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E3F4EA",
    borderWidth: 1,
    borderColor: "#C5E5D1",
  },
  headerBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#1EA858",
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#16673E",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  disclaimer: {
    fontSize: 12,
    color: "#5C7164",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#EAEFEA",
  },
  headerButtonPressed: {
    backgroundColor: "#DCE5DC",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EAEFEA",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    backgroundColor: "#DCE5DC",
  },
  divider: {
    height: 1,
    backgroundColor: "#DDE7E1",
  },
  body: {
    flex: 1,
    backgroundColor: "#F3F6F3",
  },
  bodyContent: {
    paddingVertical: 14,
    flexGrow: 1,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  heroCard: {
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE6DF",
    shadowColor: "#0D2E1B",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    gap: 8,
  },
  emptyIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#E2F3E7",
    borderWidth: 1.5,
    borderColor: "#C5E6D1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#13281B",
    letterSpacing: -0.3,
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#5C7164",
    textAlign: "center",
  },
  promptsContainer: {
    width: "100%",
    gap: 9,
  },
  promptsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  promptsHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5C7164",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE6E0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#0D2C1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  promptCardPressed: {
    backgroundColor: "#EEF6F1",
    borderColor: "#C4E2D0",
    transform: [{ scale: 0.985 }],
  },
  promptIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E2F2E7",
    alignItems: "center",
    justifyContent: "center",
  },
  promptTextWrap: {
    flex: 1,
    gap: 2,
  },
  promptMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  promptCategory: {
    fontSize: 10,
    fontWeight: "800",
    color: "#16673E",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  promptTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15281D",
  },
  promptSubtitle: {
    fontSize: 12,
    color: "#596E61",
    lineHeight: 16,
  },
  typingWrap: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F2F5F3",
    borderWidth: 1,
    borderColor: "#D5E0D8",
  },
  errorText: {
    fontSize: 13,
    color: "#27362D",
    lineHeight: 18,
  },
});