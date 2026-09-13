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
        placeholderTextColor="#6B7280"
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
          placeholderTextColor="#6B7280"
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
        >
          <View style={styles.form}>
            <Text style={styles.brand}>FoodShare</Text>

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
                  <Text
                    style={styles.error}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create account"
                  accessibilityState={{ disabled: busy, busy }}
                  disabled={busy}
                  onPress={() => void handleSignup()}
                  style={({ pressed }) => [
                    styles.button,
                    (pressed || busy) && styles.dimmed,
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
                (pressed || busy) && styles.dimmed,
              ]}
            >
              <Text style={styles.backText}>
                {success
                  ? "Back to login"
                  : "Already have an account? Log in"}
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
    backgroundColor: "#F7FAF7",
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
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#17251B",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: "#526057",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#17251B",
    marginBottom: 8,
  },
  field: {
    marginBottom: 18,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5CE",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: "#CBD5CE",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  roleSelected: {
    borderColor: "#166534",
    backgroundColor: "#DCFCE7",
  },
  roleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#526057",
  },
  roleTextSelected: {
    color: "#166534",
  },
  error: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
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
  backButton: {
    minHeight: 48,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  backText: {
    color: "#166534",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  dimmed: {
    opacity: 0.65,
  },
});         
