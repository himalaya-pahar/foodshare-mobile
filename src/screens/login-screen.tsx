import { useRef, useState } from "react";
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
import { useAuth } from "@/providers/auth-provider";

type LoginScreenProps = {
  onSignup: () => void;
};

export default function LoginScreen({ onSignup }: LoginScreenProps) {
  const { signIn, busy } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitting = useRef(false);
  const passwordInput = useRef<TextInput>(null);

  async function handleLogin() {
    if (busy || submitting.current) return;

    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    submitting.current = true;
    Keyboard.dismiss();

    try {
      await signIn(email.trim(), password);
      // Navigation will respond to the updated authentication state.
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to log in. Please try again.",
      );
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
});
