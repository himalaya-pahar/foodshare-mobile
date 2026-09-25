import { useRef } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";

import { useAuth } from "@/providers/auth-provider";

export default function LogoutButton() {
  const { busy, signOut } = useAuth();
  const submitting = useRef(false);

  async function handleLogout() {
    if (busy || submitting.current) return;

    submitting.current = true;

    try {
      await signOut();
    } catch (error) {
      Alert.alert(
        "Could not log out",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      submitting.current = false;
    }
  }

  function confirmLogout() {
    if (busy || submitting.current) return;

    Alert.alert(
      "Log out of FoodShare?",
      "You will need your email and password to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => {
            void handleLogout();
          },
        },
      ],
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log out"
      disabled={busy}
      onPress={confirmLogout}
      style={({ pressed }) => [
        styles.button,
        pressed && !busy && styles.pressed,
        busy && styles.disabled,
      ]}
    >
      <Text style={styles.buttonText}>
        {busy ? "Logging out…" : "Log out"}
      </Text>
      <Text style={styles.arrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    shadowColor: "#0D331D",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  buttonText: {
    color: "#2C3E33",
    fontSize: 16,
    fontWeight: "700",
  },
  arrow: {
    color: "#16673E",
    fontSize: 20,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.55,
  },
});