import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface BrandHeaderProps {
  size?: "compact" | "regular" | "large";
  tagline?: string;
  showBadge?: boolean;
}

export default function BrandHeader({
  size = "regular",
}: BrandHeaderProps) {
  const isCompact = size === "compact";
  const isLarge = size === "large";

  return (
    <View style={styles.brandRow}>
      <View
        style={[
          styles.emblemWrap,
          isCompact && styles.emblemWrapCompact,
          isLarge && styles.emblemWrapLarge,
        ]}
      >
        <Ionicons
          name="leaf"
          size={isCompact ? 14 : isLarge ? 22 : 18}
          color="#FFFFFF"
        />
      </View>

      <Text
        style={[
          styles.brandText,
          isCompact && styles.brandTextCompact,
          isLarge && styles.brandTextLarge,
        ]}
      >
        <Text style={styles.brandFood}>Food</Text>
        <Text style={styles.brandShare}>Share</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emblemWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#16673E",
    borderWidth: 1.2,
    borderColor: "#228A53",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#114D2E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  emblemWrapCompact: {
    width: 28,
    height: 28,
    borderRadius: 9,
  },
  emblemWrapLarge: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  brandText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  brandTextCompact: {
    fontSize: 18,
    letterSpacing: -0.4,
  },
  brandTextLarge: {
    fontSize: 30,
    letterSpacing: -0.8,
  },
  brandFood: {
    color: "#13281B",
    fontWeight: "900",
  },
  brandShare: {
    color: "#1E824C",
    fontWeight: "900",
  },
});
