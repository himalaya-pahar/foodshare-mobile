import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";

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
          <Ionicons name="chatbubbles" size={26} color="#FFFFFF" />
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
    shadowColor: AiColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: AiRadius.fab,
    backgroundColor: AiColors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPressed: {
    backgroundColor: AiColors.brandPressed,
  },
});
