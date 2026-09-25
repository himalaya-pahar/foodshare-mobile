import { useEffect, useRef, useState } from "react";
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
import { resendVerificationEmail } from "@/services/auth";

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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const actionRunning = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleResendEmail() {
    if (!user?.email || resending || resendCooldown > 0 || busy) return;

    setResending(true);
    setResendStatus(null);

    try {
      const res = await resendVerificationEmail(user.email);
      setResendStatus({
        type: "success",
        text:
          res.message ||
          "A new verification email has been sent. Check your spam folder if it doesn't appear.",
      });
      setResendCooldown(60);
    } catch (err) {
      setResendStatus({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not resend verification email. Please try again.",
      });
    } finally {
      setResending(false);
    }
  }

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

  const isUserActive =
    user?.status === "active" ||
    (!user?.status && user?.approval_status === "APPROVED");

  if (status === "signedIn" && isUserActive) {
    return <Redirect href="/" />;
  }

  let title = "Account unavailable";
  let message =
    "We could not confirm your account status. Refresh or log out.";
  let stage:
    | "restoreError"
    | "pending_email"
    | "pending_admin"
    | "rejected"
    | "unknown" = "unknown";

  if (status === "restoreError") {
    stage = "restoreError";
    title = "Could not restore session";
    message =
      sessionError ?? "Please check your connection and try again.";
  } else if (
    user?.email_verified ||
    user?.status === "pending_admin" ||
    user?.approval_status === "PENDING"
  ) {
    stage = "pending_admin";
    title = "Awaiting Admin Review";
    message =
      "Your email is verified. An administrator is reviewing your account.";
  } else if (user?.status === "pending_email") {
    stage = "pending_email";
    title = "Verify Your Email";
    message = `We sent a verification link to ${user.email}. Please tap the link to continue. If you don't see it, check your spam or junk folder.`;
  } else if (
    user?.status === "rejected" ||
    user?.approval_status === "REJECTED"
  ) {
    stage = "rejected";
    title = "Account Not Approved";
    message =
      "Your registration was not approved. Please contact support for assistance.";
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

          {resendStatus ? (
            <View
              style={[
                styles.resendStatusBox,
                resendStatus.type === "success"
                  ? styles.resendStatusSuccess
                  : styles.resendStatusError,
              ]}
            >
              <Text
                style={[
                  styles.resendStatusText,
                  resendStatus.type === "success"
                    ? styles.resendStatusTextSuccess
                    : styles.resendStatusTextError,
                ]}
                accessibilityRole="alert"
              >
                {resendStatus.text}
              </Text>
            </View>
          ) : null}

          {stage === "pending_email" && !user?.email_verified ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Resend Verification Email"
              accessibilityState={{
                disabled: resendCooldown > 0 || resending || busy,
                busy: resending,
              }}
              disabled={resendCooldown > 0 || resending || busy}
              onPress={() => void handleResendEmail()}
              style={({ pressed }) => [
                styles.resendButton,
                pressed &&
                  resendCooldown === 0 &&
                  !resending &&
                  styles.buttonPressed,
                (resendCooldown > 0 || resending || busy) &&
                  styles.resendButtonDisabled,
              ]}
            >
              {resending ? (
                <ActivityIndicator color="#176B43" />
              ) : (
                <Text
                  style={[
                    styles.resendButtonText,
                    resendCooldown > 0 && styles.resendButtonTextDisabled,
                  ]}
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend Verification Email"}
                </Text>
              )}
            </Pressable>
          ) : null}

          {stage !== "rejected" ? (
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
                {stage === "restoreError"
                  ? "Try again"
                  : "Refresh status"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void handleAction(signOut)}
            style={({ pressed }) => [
              stage === "rejected" ? styles.button : styles.logoutButton,
              pressed &&
                (stage === "rejected"
                  ? styles.buttonPressed
                  : styles.logoutPressed),
              busy && styles.dimmed,
            ]}
          >
            <Text
              style={
                stage === "rejected"
                  ? styles.buttonText
                  : styles.logoutText
              }
            >
              Log out
            </Text>
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
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#F2F5F3",
    borderWidth: 1,
    borderColor: "#D5E0D8",
  },
  error: {
    color: "#27362D",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "500",
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
  resendStatusBox: {
    width: "100%",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  resendStatusSuccess: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  resendStatusError: {
    backgroundColor: "#F2F5F3",
    borderWidth: 1,
    borderColor: "#D5E0D8",
  },
  resendStatusText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  resendStatusTextSuccess: {
    color: "#176B43",
    fontWeight: "700",
  },
  resendStatusTextError: {
    color: "#27362D",
    fontWeight: "600",
  },
  resendButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#176B43",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    marginBottom: 12,
  },
  resendButtonDisabled: {
    borderColor: "#D6E2D9",
    backgroundColor: "#F7FAF8",
  },
  resendButtonText: {
    color: "#176B43",
    fontSize: 15,
    fontWeight: "800",
  },
  resendButtonTextDisabled: {
    color: "#84968C",
    fontWeight: "600",
  },
});
