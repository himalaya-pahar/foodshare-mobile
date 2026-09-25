import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BrandHeader from "@/components/brand-header";
import { useAuth } from "@/providers/auth-provider";
import { verifyEmail } from "@/services/auth";

type VerifyState = "verifying" | "success" | "already_verified" | "invalid";

export default function VerifyEmailRoute() {
  const { retryRestore } = useAuth();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  const [state, setState] = useState<VerifyState>("verifying");
  const [message, setMessage] = useState<string>("");
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setMessage("No verification token was found in the link.");
      return;
    }

    if (verifiedRef.current) return;
    verifiedRef.current = true;

    let active = true;

    async function verify() {
      try {
        const response = await verifyEmail(token);
        if (!active) return;

        setState("success");
        setMessage(
          response.message ||
            "Your email has been verified. Your account is now awaiting administrator approval.",
        );

        // Refresh auth state in the background so local session immediately reflects email_verified
        void retryRestore();
      } catch (err) {
        if (!active) return;

        const errorMsg = err instanceof Error ? err.message : "";
        const isAlreadyVerified =
          /already verified|already active|already been verified|already used/i.test(
            errorMsg,
          );

        if (isAlreadyVerified) {
          setState("already_verified");
          setMessage(
            "Your email has already been verified. Your account is awaiting administrator approval.",
          );
          void retryRestore();
        } else {
          setState("invalid");
          setMessage(
            errorMsg ||
              "This verification link is invalid or has expired. Please log in to request a new link if needed.",
          );
        }
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, [token, retryRestore]);

  function handleContinue() {
    router.replace("/(auth)");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <BrandHeader size="large" />
        </View>

        <View style={styles.card}>
          {state === "verifying" ? (
            <View style={styles.content}>
              <View style={styles.iconCircle}>
                <ActivityIndicator size="small" color="#176B43" />
              </View>
              <Text style={styles.title}>Verifying email…</Text>
              <Text style={styles.subtitle}>
                Confirming your verification link with the server.
              </Text>
            </View>
          ) : null}

          {state === "success" || state === "already_verified" ? (
            <View style={styles.content}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconText}>✓</Text>
              </View>
              <Text style={styles.title}>
                {state === "already_verified"
                  ? "Email Already Verified"
                  : "Email Verified"}
              </Text>
              <Text style={styles.message}>{message}</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue to Login"
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>Continue to Login</Text>
              </Pressable>
            </View>
          ) : null}

          {state === "invalid" ? (
            <View style={styles.content}>
              <View style={[styles.iconCircle, styles.iconCircleMuted]}>
                <Text style={styles.iconTextMuted}>ℹ</Text>
              </View>
              <Text style={styles.title}>Link Expired</Text>
              <Text style={styles.message}>{message}</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to Login"
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>Back to Login</Text>
              </Pressable>
            </View>
          ) : null}
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
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  brandRow: {
    marginBottom: 20,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 24,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    padding: 28,
    shadowColor: "#0D3B22",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#E4F7EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconCircleMuted: {
    backgroundColor: "#EBF0ED",
  },
  iconText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#16673E",
  },
  iconTextMuted: {
    fontSize: 24,
    fontWeight: "800",
    color: "#4A5D52",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#17251B",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#68776D",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4F6055",
    textAlign: "center",
    marginBottom: 8,
  },
  button: {
    width: "100%",
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#1E8250",
    borderRadius: 16,
    minHeight: 52,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
});
