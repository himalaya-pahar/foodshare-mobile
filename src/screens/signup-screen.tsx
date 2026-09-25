import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BrandHeader from "@/components/brand-header";
import PasswordVisibilityToggle from "@/components/password-visibility-toggle";
import { resendVerificationEmail, signup } from "@/services/auth";
import type { SignupRequest } from "@/types/auth";

type SignupScreenProps = {
  onBack: () => void;
};

type FormFieldProps = TextInputProps & {
  label: string;
};

const roleOptions: {
  label: string;
  value: SignupRequest["role"];
}[] = [
  { label: "Restaurant", value: "RESTAURANT" },
  { label: "NGO", value: "NGO" },
];

function FormField({ label, ...props }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#94A399"
        style={styles.input}
      />
    </View>
  );
}

type PasswordFieldProps = TextInputProps & {
  label: string;
  visible: boolean;
  onToggleVisibility: () => void;
};

function PasswordField({
  label,
  visible,
  onToggleVisibility,
  ...props
}: PasswordFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.passwordInputWrapper}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor="#94A399"
          secureTextEntry={!visible}
          style={[styles.input, styles.passwordInput]}
        />
        <PasswordVisibilityToggle
          visible={visible}
          onPress={onToggleVisibility}
        />
      </View>
    </View>
  );
}

export default function SignupScreen({ onBack }: SignupScreenProps) {
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [role, setRole] =
    useState<SignupRequest["role"]>("RESTAURANT");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationSentEmail, setVerificationSentEmail] = useState<
    string | null
  >(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const submitting = useRef(false);

  useEffect(() => {
    if (!verificationSentEmail || resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [verificationSentEmail, resendCooldown]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!submitting.current) {
          onBack();
        }

        return true;
      },
    );

    return () => subscription.remove();
  }, [onBack]);

  async function handleResend() {
    if (!verificationSentEmail || resending || resendCooldown > 0) return;

    setResending(true);
    setResendStatus(null);

    try {
      const result = await resendVerificationEmail(verificationSentEmail);
      setResendStatus({
        type: "success",
        text:
          result.message ||
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

  async function handleSignup() {
    if (submitting.current || success || verificationSentEmail) return;

    setError(null);

    const name = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (name.length < 2 || name.length > 100) {
      setError("Full name must contain 2–100 characters.");
      return;
    }

    if (
      normalizedEmail.length < 5 ||
      normalizedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8 || password.length > 128) {
      setError("Password must contain 8–128 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    submitting.current = true;
    setBusy(true);
    Keyboard.dismiss();

    try {
      const user = await signup({
        full_name: name,
        organization_name: organizationName.trim() || null,
        email: normalizedEmail,
        password,
        role,
      });

      setPassword("");
      setConfirmPassword("");

      if (user.status === "active" || user.approval_status === "APPROVED") {
        setSuccess("Your account is approved. You can now log in.");
      } else {
        setVerificationSentEmail(normalizedEmail);
        setResendCooldown(60);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not create your account. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function goBack() {
    if (!submitting.current) {
      onBack();
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
            <View style={styles.brandRow}>
              <BrandHeader size="large" showBadge={false} />
            </View>

            {!verificationSentEmail && !success ? (
              <View style={styles.header}>
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>Join Network</Text>
                </View>
                <Text style={styles.headerTitle}>Create an account</Text>
                <Text style={styles.headerText}>
                  Join as a restaurant or NGO to help share surplus food.
                </Text>
              </View>
            ) : null}

            {verificationSentEmail ? (
              <View style={styles.verificationCard}>
                <View style={styles.verifyIconWrapper}>
                  <Text style={styles.verifyIcon}>✉</Text>
                </View>

                <Text style={styles.title}>Verify Your Email</Text>
                <Text style={styles.message}>
                  We sent a verification link to{" "}
                  <Text style={styles.emailHighlight}>
                    {verificationSentEmail}
                  </Text>
                  . Tap the link in your email to continue.
                </Text>

                <View style={styles.spamNoticeBox}>
                  <Text style={styles.spamNoticeText}>
                    Can't find the email? Please check your spam or junk folder.
                  </Text>
                </View>

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

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Resend Verification Email"
                  accessibilityState={{
                    disabled: resendCooldown > 0 || resending,
                    busy: resending,
                  }}
                  disabled={resendCooldown > 0 || resending}
                  onPress={() => void handleResend()}
                  style={({ pressed }) => [
                    styles.resendButton,
                    pressed &&
                      resendCooldown === 0 &&
                      !resending &&
                      styles.buttonPressed,
                    (resendCooldown > 0 || resending) &&
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

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to Login"
                  onPress={goBack}
                  style={({ pressed }) => [
                    styles.button,
                    styles.fullWidthButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.buttonText}>Back to Login</Text>
                </Pressable>
              </View>
            ) : success ? (
              <View style={styles.verificationCard}>
                <Text style={styles.title}>Account created</Text>
                <Text
                  style={styles.message}
                  accessibilityLiveRegion="polite"
                >
                  {success}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to Login"
                  onPress={goBack}
                  style={({ pressed }) => [
                    styles.button,
                    styles.fullWidthButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.buttonText}>Back to Login</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Account type</Text>

                <View
                  style={styles.roleRow}
                  accessibilityRole="radiogroup"
                >
                  {roleOptions.map((option) => {
                    const selected = role === option.value;

                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityLabel={option.label}
                        accessibilityState={{
                          checked: selected,
                          disabled: busy,
                        }}
                        disabled={busy}
                        onPress={() => setRole(option.value)}
                        style={[
                          styles.roleButton,
                          selected && styles.roleSelected,
                          busy && styles.dimmed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleText,
                            selected && styles.roleTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <FormField
                  label="Full name"
                  placeholder="Your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  maxLength={100}
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!busy}
                />

                <FormField
                  label="Organization name (optional)"
                  placeholder="Restaurant or NGO name"
                  value={organizationName}
                  onChangeText={setOrganizationName}
                  maxLength={150}
                  autoCapitalize="words"
                  editable={!busy}
                />

                <FormField
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  maxLength={255}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!busy}
                />

                <PasswordField
                  label="Password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChangeText={setPassword}
                  maxLength={128}
                  visible={showPassword}
                  onToggleVisibility={() =>
                    setShowPassword((value) => !value)
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  editable={!busy}
                />

                <PasswordField
                  label="Confirm password"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  maxLength={128}
                  visible={showConfirmPassword}
                  onToggleVisibility={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={() => void handleSignup()}
                  editable={!busy}
                />

                {error ? (
                  <View style={styles.errorBox}>
                    <Text
                      style={styles.error}
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                    >
                      {error}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create account"
                  accessibilityState={{ disabled: busy, busy }}
                  disabled={busy}
                  onPress={() => void handleSignup()}
                  style={({ pressed }) => [
                    styles.button,
                    pressed && !busy && styles.buttonPressed,
                    busy && styles.dimmed,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Create account
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={goBack}
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.backPressed,
                    busy && styles.dimmed,
                  ]}
                >
                  <Text style={styles.backText}>
                    Already have an account?{" "}
                    <Text style={styles.backBold}>Log in</Text>
                  </Text>
                </Pressable>
              </>
            )}
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
  brandRow: {
    marginBottom: 16,
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    color: "#183B2A",
    letterSpacing: -0.4,
  },
  header: {
    marginBottom: 24,
    gap: 8,
  },
  headerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E4F2E8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C6E4D1",
  },
  headerBadgeText: {
    color: "#176B43",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#17251B",
    letterSpacing: -0.7,
  },
  headerText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#526057",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#17251B",
    marginBottom: 8,
    letterSpacing: -0.6,
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
    color: "#526057",
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3A5244",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  field: {
    marginBottom: 18,
  },
  input: {
    backgroundColor: "#FAFDFB",
    borderWidth: 1.5,
    borderColor: "#D2DFD6",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: "#17251B",
  },
  passwordInputWrapper: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 56,
  },
  roleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    minHeight: 52,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#D2DFD6",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFDFB",
  },
  roleSelected: {
    borderColor: "#176B43",
    backgroundColor: "#E4F7EC",
  },
  roleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#526057",
  },
  roleTextSelected: {
    color: "#176B43",
    fontWeight: "800",
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
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#1E8250",
    borderRadius: 16,
    minHeight: 56,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.22,
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
  backButton: {
    minHeight: 52,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  backPressed: {
    opacity: 0.7,
  },
  backText: {
    color: "#526057",
    fontSize: 15,
    textAlign: "center",
  },
  backBold: {
    color: "#176B43",
    fontWeight: "800",
  },
  dimmed: {
    opacity: 0.6,
  },
  verificationCard: {
    backgroundColor: "#FAFDFB",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 16,
  },
  verifyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#E4F7EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  verifyIcon: {
    fontSize: 28,
    color: "#176B43",
  },
  emailHighlight: {
    fontWeight: "800",
    color: "#17251B",
  },
  spamNoticeBox: {
    borderRadius: 12,
    backgroundColor: "#EFF5F1",
    borderWidth: 1,
    borderColor: "#D6E4DB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    width: "100%",
  },
  spamNoticeText: {
    color: "#52655A",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
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
    borderColor: "#16673E",
    backgroundColor: "#FAFDFB",
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
  fullWidthButton: {
    width: "100%",
  },
});

