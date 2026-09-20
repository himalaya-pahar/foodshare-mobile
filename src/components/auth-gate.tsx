import { useRef, useState } from "react";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";
import LoginScreen from "@/screens/login-screen";
import SignupScreen from "@/screens/signup-screen";

export default function AuthGate() {
  const {
    user,
    status,
    busy,
    sessionError,
    retryRestore,
    signOut,
  } = useAuth();

  const [showSignup, setShowSignup] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const actionRunning = useRef(false);

  async function handleAction(action: () => Promise<void>) {
    if (busy || actionRunning.current) return;

    actionRunning.current = true;
    setActionError(null);

    try {
      await action();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      actionRunning.current = false;
    }
  }

  if (status === "restoring") {
    return (
      <SafeAreaView style={styles.loading}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetter}>F</Text>
        </View>
        <ActivityIndicator size="large" color="#176B43" />

        <Text style={styles.message}>
          Checking your session...
        </Text>
      </SafeAreaView>
    );
  }

  if (status === "signedOut") {
    if (showSignup) {
      return (
        <SignupScreen
          onBack={() => setShowSignup(false)}
        />
      );
    }

    return (
      <LoginScreen
        onSignup={() => setShowSignup(true)}
      />
    );
  }

  if (
    status === "signedIn" &&
    user?.approval_status === "APPROVED"
  ) {
    return <Redirect href="/" />;
  }

  let title = "Account unavailable";
  let message =
    "We could not confirm your account status. Refresh or log out.";

  if (status === "restoreError") {
    title = "Could not restore your session";
    message =
      sessionError ?? "Please check your connection and try again.";
  } else if (user?.approval_status === "PENDING") {
    title = "Waiting for approval";
    message =
      "Your account needs administrator approval. Refresh your status after approval.";
  } else if (user?.approval_status === "REJECTED") {
    title = "Account not approved";
    message =
      "Your registration was rejected. Please contact the FoodShare administrator.";
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoMarkLarge}>
          <Text style={styles.logoLetterLarge}>F</Text>
        </View>

        <View style={styles.messageCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {actionError ? (
            <View style={styles.errorBox}>
              <Text
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {actionError}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void handleAction(retryRestore)}
            style={({ pressed }) => [
              styles.button,
              pressed && !busy && styles.buttonPressed,
              busy && styles.dimmed,
            ]}
          >
            <Text style={styles.buttonText}>
              {status === "restoreError"
                ? "Try again"
                : "Refresh status"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void handleAction(signOut)}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutPressed,
              busy && styles.dimmed,
            ]}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7F3",
  },
  loading: {
    flex: 1,
    backgroundColor: "#F4F7F3",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 20,
  },
  logoMark: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#176B43",
  },
  logoLetter: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  logoMarkLarge: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderRadius: 18,
    marginBottom: 24,
    backgroundColor: "#176B43",
  },
  logoLetterLarge: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  messageCard: {
    borderRadius: 24,
    padding: 28,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17251B",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    color: "#526057",
    textAlign: "center",
    marginBottom: 24,
  },
  errorBox: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#FFF0EE",
  },
  error: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#176B43",
    borderRadius: 16,
    minHeight: 56,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  logoutButton: {
    minHeight: 48,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  logoutPressed: {
    opacity: 0.7,
  },
  logoutText: {
    color: "#176B43",
    fontSize: 16,
    fontWeight: "700",
  },
  dimmed: {
    opacity: 0.6,
  },
});
