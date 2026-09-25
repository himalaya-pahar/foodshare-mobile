import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AiColors, AiRadius, AiSpacing } from "./ai-theme";
import { MAX_MESSAGE_LENGTH } from "./types";

interface AiChatInputProps {
  disabled: boolean;
  onSend: (text: string) => void;
  validationMessage?: string | null;
}

// Counter turns red once the user gets close to the cap; full over-cap
// blocks send via canSend below.
const NEAR_LIMIT_THRESHOLD = 100;
// TextInput maxLength is set slightly above the cap so the counter can still
// render when the user is over the limit, instead of the OS silently truncating.
const INPUT_OVERRUN = 50;

export function AiChatInput({
  disabled,
  onSend,
  validationMessage,
}: AiChatInputProps) {
  const [text, setText] = useState("");
  const trimmedLength = text.trim().length;
  const tooLong = trimmedLength > MAX_MESSAGE_LENGTH;
  const canSend = !disabled && trimmedLength > 0 && !tooLong;

  const handleSend = () => {
    if (!canSend) return;
    const toSend = text.trim();
    setText("");
    onSend(toSend);
  };

  const counterColor =
    tooLong || trimmedLength > MAX_MESSAGE_LENGTH - NEAR_LIMIT_THRESHOLD
      ? AiColors.error
      : AiColors.textMuted;

  return (
    <View style={styles.host}>
      {validationMessage ? (
        <Text style={styles.validation}>{validationMessage}</Text>
      ) : null}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Type your question…"
          placeholderTextColor={AiColors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_MESSAGE_LENGTH + INPUT_OVERRUN}
          editable={!disabled}
          returnKeyType="default"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          hitSlop={8}
          disabled={!canSend}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
            pressed && canSend && styles.sendButtonPressed,
          ]}
        >
          <Ionicons
            name="send"
            size={18}
            color={canSend ? "#FFFFFF" : "#A6B3AB"}
          />
        </Pressable>
      </View>
      <Text style={[styles.counter, { color: counterColor }]}>
        {trimmedLength} / {MAX_MESSAGE_LENGTH}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#FAFDFB",
    borderTopWidth: 1.2,
    borderTopColor: "#DCE6E0",
  },
  validation: {
    fontSize: 12,
    color: "#C0392B",
    marginBottom: 6,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F2F5F3",
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "#D2E0D7",
    fontSize: 15,
    color: "#15281D",
    lineHeight: 20,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#228551",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F4628",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: "#E2EBE5",
    borderColor: "#D4E2D9",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonPressed: {
    backgroundColor: "#114F2F",
    transform: [{ scale: 0.94 }],
  },
  counter: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 6,
    fontWeight: "500",
  },
});