import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Spacing } from "@/constants/theme";

import { AiColors, AiRadius } from "./ai-theme";

interface AiFabProps {
  onPress: () => void;
}

const FAB_SIZE = 56;
const PRESS_SCALE = 0.94;
const PULSE_PEAK = 1.15;
const PULSE_DURATION_MS = 600;

/**
 * Floating Action Button that opens the AI Assistant chat panel.
 *
 * The parent conditionally mounts this component (rather than passing a
 * `visible` prop) so it can't intercept taps that pass through the chat
 * panel's transparent Modal backdrop on Android.
 */
export function AiFab({ onPress }: AiFabProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(scale, {
        toValue: PULSE_PEAK,
        duration: PULSE_DURATION_MS / 2,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: PULSE_DURATION_MS / 2,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [scale]);

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View style={[styles.shadowWrap, { transform: [{ scale }] }]}>
        <Pressable
          accessibilityLabel="Open FoodShare AI Assistant"
          accessibilityRole="button"
          onPress={onPress}
          onPressIn={() => {
            Animated.spring(scale, {
              toValue: PRESS_SCALE,
              useNativeDriver: true,
              speed: 30,
              bounciness: 6,
            }).start();
          }}
          onPressOut={() => {
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
              speed: 20,
              bounciness: 8,
            }).start();
          }}
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons name="sparkles" size={24} color="#FFFFFF" />
          <View style={styles.aiTag}>
            <Text style={styles.aiTagText}>AI</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: Platform.select({ web: "fixed", default: "absolute" }) as any,
    right: Spacing.four,
    bottom: Spacing.four,
    zIndex: 9999,
  },
  shadowWrap: {
    borderRadius: AiRadius.fab,
    shadowColor: "#0D3E21",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 8,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: AiRadius.fab,
    backgroundColor: "#16673E",
    borderWidth: 1.5,
    borderColor: "#238B52",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  fabPressed: {
    backgroundColor: "#114F2F",
    transform: [{ scale: 0.96 }],
  },
  aiTag: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#1EA858",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  aiTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
