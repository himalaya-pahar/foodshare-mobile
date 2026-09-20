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
    backgroundColor: "#FDE2DE",
    shadowColor: "#A3382C",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  buttonText: {
    color: "#A3382C",
    fontSize: 16,
    fontWeight: "800",
  },
  arrow: {
    color: "#A3382C",
    fontSize: 22,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.55,
  },
});