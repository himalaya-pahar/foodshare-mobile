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
    paddingHorizontal: AiSpacing.three,
    paddingTop: AiSpacing.two,
    paddingBottom: AiSpacing.three,
    backgroundColor: AiColors.sheetBg,
    borderTopWidth: 1,
    borderTopColor: AiColors.border,
  },
  validation: {
    fontSize: 12,
    color: AiColors.error,
    marginBottom: AiSpacing.one,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: AiSpacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: AiSpacing.three,
    paddingVertical: AiSpacing.two,
    backgroundColor: AiColors.inputBg,
    borderRadius: AiRadius.input,
    borderWidth: 1,
    borderColor: AiColors.border,
    fontSize: 15,
    color: AiColors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AiColors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: AiColors.border,
  },
  sendButtonPressed: {
    backgroundColor: AiColors.brandPressed,
  },
  counter: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
});