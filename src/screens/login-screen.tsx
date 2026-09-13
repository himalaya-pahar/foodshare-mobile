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
        >
          <View style={styles.form}>
            <Text style={styles.brand}>FoodShare</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Log in to continue sharing food with your community.
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              accessibilityLabel="Email"
              placeholder="you@example.com"
              placeholderTextColor="#6B7280"
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
                placeholderTextColor="#6B7280"
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
              <Text
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void handleLogin()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Log in"
              accessibilityState={{ disabled: busy, busy }}
              style={({ pressed }) => [
                styles.button,
                (pressed || busy) && styles.buttonDimmed,
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
                style={styles.signupLink}
            >
                <Text style={styles.signupText}>
                    Don’t have an account? Sign up
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
    fontSize: 32,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#17251B",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#526057",
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#17251B",
    marginBottom: 8,
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
  buttonDimmed: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  signupLink: {
  minHeight: 48,
  paddingVertical: 16,
  alignItems: "center",
  justifyContent: "center",
},
signupText: {
  color: "#166534",
  fontSize: 15,
  fontWeight: "600",
  textAlign: "center",
},
  
});
