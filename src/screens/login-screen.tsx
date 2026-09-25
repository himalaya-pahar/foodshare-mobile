import { useEffect, useRef, useState } from "react";
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

import PasswordVisibilityToggle from "@/components/password-visibility-toggle";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { resendVerificationEmail } from "@/services/auth";

type LoginScreenProps = {
  onSignup: () => void;
};

export default function LoginScreen({ onSignup }: LoginScreenProps) {
  const { signIn, busy } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const submitting = useRef(false);
  const passwordInput = useRef<TextInput>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleResend() {
    if (!unverifiedEmail || resending || resendCooldown > 0) return;

    setResending(true);
    setResendStatus(null);

    try {
      const res = await resendVerificationEmail(unverifiedEmail);
      setResendStatus({
        type: "success",
        text:
          res.message ||
          "A new verification link has been sent. Check your spam folder if it doesn't appear.",
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

  async function handleLogin() {
    if (busy || submitting.current) return;

    setError(null);
    setUnverifiedEmail(null);
    setResendStatus(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    submitting.current = true;
    Keyboard.dismiss();

    try {
      await signIn(trimmedEmail, password);
      // Navigation will respond to the updated authentication state.
    } catch (loginError) {
      const errorMessage =
        loginError instanceof Error
          ? loginError.message
          : "Unable to log in. Please try again.";

      const isUnverified =
        !/already verified|pending|admin|approval|review|rejected/i.test(
          errorMessage,
        ) &&
        /not verified|verify your email|email verification required|email is not verified/i.test(
          errorMessage,
        );

      if (isUnverified) {
        setUnverifiedEmail(trimmedEmail);
      } else {
        setUnverifiedEmail(null);
      }

      setError(errorMessage);
    } finally {
      submitting.current = false;
    }
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
          <View style={styles.form}>
            <View style={styles.heroBanner}>
              <View style={styles.logoRow}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoLetter}>F</Text>
                </View>
                <Text style={styles.brand}>FoodShare</Text>
              </View>
              <Text style={styles.heroTagline}>
                Connecting surplus food{"\n"}with communities that need it.
              </Text>
            </View>

            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Log in to continue sharing food with your community.
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel="Email"
              placeholder="you@example.com"
              placeholderTextColor="#94A399"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
              editable={!busy}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordField}>
              <TextInput
                ref={passwordInput}
                style={[styles.input, styles.passwordInput]}
                accessibilityLabel="Password"
                placeholder="Enter your password"
                placeholderTextColor="#94A399"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={() => void handleLogin()}
                editable={!busy}
              />
              <PasswordVisibilityToggle
                visible={showPassword}
                onPress={() => setShowPassword((value) => !value)}
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text
                  style={styles.error}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {error}
                </Text>

                {unverifiedEmail ? (
                  <View style={styles.unverifiedActionBox}>
                    <Text style={styles.unverifiedSpamHint}>
                      Can't find the email? Check your spam or junk folder.
                    </Text>
                    {resendStatus ? (
                      <Text
                        style={[
                          styles.unverifiedFeedback,
                          resendStatus.type === "success"
                            ? styles.unverifiedSuccessText
                            : styles.unverifiedErrorText,
                        ]}
                        accessibilityRole="alert"
                      >
                        {resendStatus.text}
                      </Text>
                    ) : null}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Resend Verification Link"
                      accessibilityState={{
                        disabled: resendCooldown > 0 || resending || busy,
                        busy: resending,
                      }}
                      disabled={resendCooldown > 0 || resending || busy}
                      onPress={() => void handleResend()}
                      style={({ pressed }) => [
                        styles.inlineResendButton,
                        pressed &&
                          resendCooldown === 0 &&
                          !resending &&
                          styles.buttonPressed,
                        (resendCooldown > 0 || resending || busy) &&
                          styles.inlineResendButtonDisabled,
                      ]}
                    >
                      {resending ? (
                        <ActivityIndicator size="small" color="#176B43" />
                      ) : (
                        <Text
                          style={[
                            styles.inlineResendButtonText,
                            resendCooldown > 0 &&
                              styles.inlineResendButtonTextDisabled,
                          ]}
                        >
                          {resendCooldown > 0
                            ? `Resend in ${resendCooldown}s`
                            : "Resend Verification Link"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={() => void handleLogin()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Log in"
              accessibilityState={{ disabled: busy, busy }}
              style={({ pressed }) => [
                styles.button,
                pressed && !busy && styles.buttonPressed,
                busy && styles.buttonDimmed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Log in</Text>
              )}
            </Pressable>
            <Pressable
                onPress={onSignup}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                style={({ pressed }) => [
                  styles.signupLink,
                  pressed && styles.signupPressed,
                ]}
            >
                <Text style={styles.signupText}>
                    Don't have an account?{" "}
                    <Text style={styles.signupBold}>Sign up</Text>
                </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#F4F7F3",
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  form: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  heroBanner: {
    gap: 14,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    backgroundColor: "#174B36",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  logoLetter: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  brand: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  heroTagline: {
    color: "#C5E5D0",
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#17251B",
    marginBottom: 8,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#526057",
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3A5244",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D6E2D9",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: "#17251B",
    marginBottom: 20,
  },
  passwordField: {
    position: "relative",
    marginBottom: 20,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 56,
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
  buttonDimmed: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  signupLink: {
    minHeight: 52,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  signupPressed: {
    opacity: 0.7,
  },
  signupText: {
    color: "#526057",
    fontSize: 15,
    textAlign: "center",
  },
  signupBold: {
    color: "#176B43",
    fontWeight: "800",
  },
  unverifiedActionBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#D5E0D8",
    gap: 8,
  },
  unverifiedSpamHint: {
    color: "#52655A",
    fontSize: 13,
    lineHeight: 18,
  },
  unverifiedFeedback: {
    fontSize: 13,
    lineHeight: 18,
  },
  unverifiedSuccessText: {
    color: "#176B43",
    fontWeight: "700",
  },
  unverifiedErrorText: {
    color: "#3D4F42",
    fontWeight: "600",
  },
  inlineResendButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#176B43",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  inlineResendButtonDisabled: {
    borderColor: "#D6E2D9",
    backgroundColor: "#F7FAF8",
  },
  inlineResendButtonText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "800",
  },
  inlineResendButtonTextDisabled: {
    color: "#84968C",
    fontWeight: "600",
  },
});
