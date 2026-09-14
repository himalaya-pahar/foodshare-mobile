import { useRef, useState } from "react";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
        <ActivityIndicator size="large" color="#166534" />

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
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        {actionError ? (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {actionError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => void handleAction(retryRestore)}
          style={({ pressed }) => [
            styles.button,
            (pressed || busy) && styles.dimmed,
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
            (pressed || busy) && styles.dimmed,
          ]}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAF7",
  },
  loading: {
    flex: 1,
    backgroundColor: "#F7FAF7",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#17251B",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: "#526057",
    textAlign: "center",
    marginBottom: 24,
  },
  error: {
    color: "#B42318",
    textAlign: "center",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#166534",
    borderRadius: 12,
    minHeight: 52,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  logoutButton: {
    minHeight: 48,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  logoutText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "600",
  },
  dimmed: {
    opacity: 0.65,
  },
});
