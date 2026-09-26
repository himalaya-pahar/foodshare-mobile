import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface PaginationControlsProps {
  offset: number;
  limit: number;
  total: number;
  loading?: boolean;
  onPageChange: (newOffset: number) => void;
}

function PaginationControls({
  offset,
  limit,
  total,
  loading = false,
  onPageChange,
}: PaginationControlsProps) {
  if (total <= limit) {
    return null;
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = Math.min(offset + limit, total);

  const canGoBack = offset > 0 && !loading;
  const canGoForward = offset + limit < total && !loading;

  function handlePrevious() {
    if (!canGoBack) return;
    const nextOffset = Math.max(0, offset - limit);
    onPageChange(nextOffset);
  }

  function handleNext() {
    if (!canGoForward) return;
    const nextOffset = offset + limit;
    onPageChange(nextOffset);
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        accessibilityState={{ disabled: !canGoBack }}
        disabled={!canGoBack}
        onPress={handlePrevious}
        style={({ pressed }) => [
          styles.navButton,
          !canGoBack && styles.buttonDisabled,
          pressed && canGoBack && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.navButtonText, !canGoBack && styles.textDisabled]}>
          ‹ Previous
        </Text>
      </Pressable>

      <View style={styles.pageInfo}>
        <Text style={styles.pageLabel}>
          Page <Text style={styles.pageHighlight}>{currentPage}</Text> of{" "}
          <Text style={styles.pageHighlight}>{totalPages}</Text>
        </Text>
        <Text style={styles.countLabel}>
          {firstItem}–{lastItem} of {total}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next page"
        accessibilityState={{ disabled: !canGoForward }}
        disabled={!canGoForward}
        onPress={handleNext}
        style={({ pressed }) => [
          styles.navButton,
          !canGoForward && styles.buttonDisabled,
          pressed && canGoForward && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.navButtonText, !canGoForward && styles.textDisabled]}>
          Next ›
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFDFB",
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 12,
    shadowColor: "#0D3B22",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pageInfo: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  pageLabel: {
    color: "#4A5D52",
    fontSize: 13,
    fontWeight: "600",
  },
  pageHighlight: {
    color: "#17251B",
    fontWeight: "800",
  },
  countLabel: {
    color: "#72847B",
    fontSize: 11,
    fontWeight: "600",
  },
  navButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#BEDECB",
    alignItems: "center",
    justifyContent: "center",
  },
  navButtonText: {
    color: "#16673E",
    fontSize: 13,
    fontWeight: "800",
  },
  buttonDisabled: {
    backgroundColor: "#F2F5F3",
    borderColor: "#DCE5DF",
    opacity: 0.45,
  },
  textDisabled: {
    color: "#8FA095",
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
});

export default React.memo(PaginationControls);
