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

import PasswordVisibilityToggle from "@/components/password-visibility-toggle";
import { signup } from "@/services/auth";
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

  const submitting = useRef(false);

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

  async function handleSignup() {
    if (submitting.current || success) return;

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

      if (user.approval_status === "APPROVED") {
        setSuccess("Your account is approved. You can now log in.");
      } else if (user.approval_status === "REJECTED") {
        setSuccess(
          "Your account was created but is not approved. Please contact the FoodShare administrator.",
        );
      } else {
        setSuccess(
          "Your account was created successfully. An administrator must approve it before you can use FoodShare.",
        );
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
            <View style={styles.heroBanner}>
              <View style={styles.logoRow}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoLetter}>F</Text>
                </View>
                <Text style={styles.brandName}>FoodShare</Text>
              </View>
              <Text style={styles.heroTagline}>
                Join our community to reduce{"\n"}food waste and feed those in need.
              </Text>
            </View>

            <Text style={styles.title}>
              {success ? "Account created" : "Create an account"}
            </Text>

            {success ? (
              <Text
                style={styles.message}
                accessibilityLiveRegion="polite"
              >
                {success}
              </Text>
            ) : (
              <>
                <Text style={styles.message}>
                  Join as a restaurant or NGO to help share surplus food.
                </Text>

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
              </>
            )}

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
                {success
                  ? "Back to login"
                  : "Already have an account? "}
                {!success ? <Text style={styles.backBold}>Log in</Text> : null}
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
  brandName: {
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D6E2D9",
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
    borderWidth: 2,
    borderColor: "#D6E2D9",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
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
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#FFF0EE",
  },
  error: {
    color: "#B42318",
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
});

