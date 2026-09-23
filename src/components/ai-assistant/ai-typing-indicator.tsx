import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { AiColors } from "./ai-theme";

const DOT_SIZE = 6;
const STAGGER_MS = 160;

/**
 * Three animated dots shown while the AI is generating a reply.
 * Staggered opacity fade, looping.
 */
export function AiTypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const makeAnim = (value: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = makeAnim(dot1);
    const a2 = Animated.sequence([
      Animated.delay(STAGGER_MS),
      makeAnim(dot2),
    ]);
    const a3 = Animated.sequence([
      Animated.delay(STAGGER_MS * 2),
      makeAnim(dot3),
    ]);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.dot, { opacity: dot1 }]} />
      <Animated.View style={[styles.dot, { opacity: dot2 }]} />
      <Animated.View style={[styles.dot, { opacity: dot3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: AiColors.sheetBg,
    borderWidth: 1,
    borderColor: AiColors.border,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: AiColors.textMuted,
    marginHorizontal: 3,
  },
});
