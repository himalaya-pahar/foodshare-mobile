import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { resendVerificationEmail, verifyEmail } from "@/services/auth";

type VerifyState = "verifying" | "success" | "error" | "missing_token";

export default function VerifyEmailRoute() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  const [state, setState] = useState<VerifyState>(token ? "verifying" : "missing_token");
  const [message, setMessage] = useState<string>("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendFeedback, setResendFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const verificationAttempted = useRef<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!token) {
      setState("missing_token");
      setMessage("No verification token was found in the link. Please check your email or request a new link.");
      return;
    }

    if (verificationAttempted.current === token) {
      return;
    }

    verificationAttempted.current = token;
    setState("verifying");

    let isMounted = true;

    async function performVerification() {
      try {
        const response = await verifyEmail(token);
        if (!isMounted) return;

        setState("success");
        setMessage(
          response.message ||
            "Your email has been verified! Your account is now submitted for administrator approval.",
        );
      } catch (error) {
        if (!isMounted) return;

        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "The email verification link is invalid or has expired. Please request a new verification link.",
        );
      }
    }

    void performVerification();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleResend() {
    const trimmed = resendEmail.trim().toLowerCase();
    if (!trimmed || resending || resendCooldown > 0) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResendFeedback({
        type: "error",
        text: "Please enter a valid email address.",
      });
      return;
    }

    setResending(true);
    setResendFeedback(null);
    Keyboard.dismiss();

    try {
      const res = await resendVerificationEmail(trimmed);
      setResendFeedback({
        type: "success",
        text: res.message || "A new verification email has been sent.",
      });
      setResendCooldown(60);
    } catch (err) {
      setResendFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not send verification email. Please try again.",
      });
    } finally {
      setResending(false);
    }
  }

  function handleGoToLogin() {
    router.replace("/(auth)");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>F</Text>
            </View>
            <Text style={styles.brand}>FoodShare</Text>
          </View>

          <View style={styles.card}>
            {state === "verifying" ? (
              <View style={styles.stateContent}>
                <View style={[styles.iconWrapper, styles.loadingIconWrapper]}>
                  <ActivityIndicator size="large" color="#176B43" />
                </View>
                <Text style={styles.title}>Verifying your email…</Text>
                <Text style={styles.subtitle}>
                  Please wait while we confirm your email address with the server.
                </Text>
              </View>
            ) : null}

            {state === "success" ? (
              <View style={styles.stateContent}>
                <View style={[styles.iconWrapper, styles.successIconWrapper]}>
                  <Text style={styles.successIcon}>✓</Text>
                </View>
                <Text style={styles.title}>Email Verified!</Text>
                <Text style={styles.message}>
                  {message ||
                    "Your email has been verified! Your account is now submitted for administrator approval."}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go to Login"
                  onPress={handleGoToLogin}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Go to Login</Text>
                </Pressable>
              </View>
            ) : null}

            {state === "error" || state === "missing_token" ? (
              <View style={styles.stateContent}>
                <View style={[styles.iconWrapper, styles.errorIconWrapper]}>
                  <Text style={styles.errorIcon}>!</Text>
                </View>
                <Text style={styles.title}>
                  {state === "missing_token"
                    ? "Missing Token"
                    : "Verification Failed"}
                </Text>

                <Text style={styles.message}>{message}</Text>

                <View style={styles.resendSection}>
                  <Text style={styles.resendSectionTitle}>
                    Need a new verification link?
                  </Text>
                  <TextInput
                    style={styles.input}
                    accessibilityLabel="Email address"
                    placeholder="Enter your email"
                    placeholderTextColor="#94A399"
                    value={resendEmail}
                    onChangeText={setResendEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    editable={!resending}
                  />

                  {resendFeedback ? (
                    <View
                      style={[
                        styles.feedbackBox,
                        resendFeedback.type === "success"
                          ? styles.feedbackSuccess
                          : styles.feedbackError,
                      ]}
                    >
                      <Text
                        style={[
                          styles.feedbackText,
                          resendFeedback.type === "success"
                            ? styles.feedbackTextSuccess
                            : styles.feedbackTextError,
                        ]}
                        accessibilityRole="alert"
                      >
                        {resendFeedback.text}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Resend Verification Link"
                    accessibilityState={{
                      disabled:
                        resendCooldown > 0 || resending || !resendEmail.trim(),
                      busy: resending,
                    }}
                    disabled={
                      resendCooldown > 0 || resending || !resendEmail.trim()
                    }
                    onPress={() => void handleResend()}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed &&
                        resendCooldown === 0 &&
                        !resending &&
                        styles.buttonPressed,
                      (resendCooldown > 0 ||
                        resending ||
                        !resendEmail.trim()) &&
                        styles.buttonDisabled,
                    ]}
                  >
                    {resending ? (
                      <ActivityIndicator size="small" color="#176B43" />
                    ) : (
                      <Text
                        style={[
                          styles.secondaryButtonText,
                          (resendCooldown > 0 || !resendEmail.trim()) &&
                            styles.secondaryButtonTextDisabled,
                        ]}
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend Verification Link"}
                      </Text>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go to Login"
                  onPress={handleGoToLogin}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Go to Login</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: "#F4F7F3",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  logo: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#176B43",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  brand: {
    color: "#183B2A",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 28,
    shadowColor: "#0D3B22",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  stateContent: {
    alignItems: "center",
    gap: 14,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  loadingIconWrapper: {
    backgroundColor: "#EAF5EE",
  },
  successIconWrapper: {
    backgroundColor: "#DFF1E5",
  },
  successIcon: {
    fontSize: 32,
    fontWeight: "800",
    color: "#176B43",
  },
  errorIconWrapper: {
    backgroundColor: "#FDE2DE",
  },
  errorIcon: {
    fontSize: 32,
    fontWeight: "800",
    color: "#B42318",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17251B",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#68776D",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    color: "#526057",
    textAlign: "center",
    marginBottom: 6,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#176B43",
    borderRadius: 16,
    minHeight: 54,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resendSection: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: "#E2ECE5",
    padding: 16,
    gap: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  resendSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2C4033",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D6E2D9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#17251B",
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#176B43",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButtonTextDisabled: {
    color: "#8FA095",
  },
  feedbackBox: {
    borderRadius: 10,
    padding: 10,
  },
  feedbackSuccess: {
    backgroundColor: "#E8F5E9",
  },
  feedbackError: {
    backgroundColor: "#FFF0EE",
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  feedbackTextSuccess: {
    color: "#176B43",
    fontWeight: "700",
  },
  feedbackTextError: {
    color: "#B42318",
  },
});
