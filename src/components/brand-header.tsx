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
  tagline,
  showBadge = true,
}: BrandHeaderProps) {
  const isCompact = size === "compact";
  const isLarge = size === "large";

  return (
    <View style={styles.container}>
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
          <Text style={styles.brandDot}> •</Text>
        </Text>

        {showBadge ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Network</Text>
          </View>
        ) : null}
      </View>

      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 3,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  emblemWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#16673E",
    borderWidth: 1.2,
    borderColor: "#228A53",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#114D2E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
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
  brandDot: {
    color: "#27AE60",
    fontSize: 16,
    fontWeight: "900",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: "#E7F4EB",
    borderWidth: 1,
    borderColor: "#C6E4D0",
    marginLeft: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1EA858",
  },
  liveText: {
    color: "#176B43",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tagline: {
    color: "#556B5D",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});
