import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";
import { getAdminStats } from "@/services/admin";
import {
  getMyDonations,
  getMyPickupRequests,
} from "@/services/dashboard";
import type { UserRole } from "@/types/auth";

type Metric = {
  label: string;
  value: number;
};

type DashboardData = {
  roleLabel: string;
  title: string;
  description: string;
  nextStep: string;
  metrics: Metric[];
};

async function loadDashboard(role: UserRole): Promise<DashboardData> {
  if (role === "ADMIN") {
    const stats = await getAdminStats();

    return {
      roleLabel: "ADMIN WORKSPACE",
      title: "Community at a glance.",
      description:
        "Review account activity and keep FoodShare moving safely.",
      nextStep: "Open Users to review pending Restaurant and NGO accounts.",
      metrics: [
        { label: "Pending approval", value: stats.pending_users },
        {
          label: "Approved accounts",
          value: stats.approved_users,
        },
        { label: "Total accounts", value: stats.total_users },
      ],
    };
  }

  if (role === "RESTAURANT") {
    const donations = await getMyDonations({ limit: 1 });

    return {
      roleLabel: "RESTAURANT WORKSPACE",
      title: "Your food can do more.",
      description:
        "Track the surplus food you have shared with your community.",
      nextStep: "Create and manage donations from the Donations tab.",
      metrics: [
        {
          label: "Total donations",
          value: donations.total,
        },
      ],
    };
  }

  const pickupRequests = await getMyPickupRequests({ limit: 1 });

  return {
    roleLabel: "NGO WORKSPACE",
    title: "Collections with purpose.",
    description:
      "Keep track of food requests and the collections you coordinate.",
    nextStep: "Browse available donations and manage requests from Pickups.",
    metrics: [
      {
        label: "Total pickup requests",
        value: pickupRequests.total,
      },
    ],
  };
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const role = user?.role;

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (role === undefined) {
        return () => {
          active = false;
        };
      }

      async function fetchDashboard(roleToLoad: UserRole) {
        setLoading(true);
        setError(null);

        try {
          const result = await loadDashboard(roleToLoad);

          if (active) {
            setDashboard(result);
          }
        } catch (requestError) {
          if (active) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Could not load your dashboard.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void fetchDashboard(role);

      return () => {
        active = false;
      };
    }, [reloadKey, role]),
  );

  if (!user) return null;

  const firstName = user.full_name.trim().split(/\s+/)[0] || "there";

  return (
    <SafeAreaView
      style={styles.screen}
      edges={Platform.OS === "android" ? ["top", "left", "right"] : []}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F</Text>
          </View>

          <Text style={styles.brand}>FoodShare</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>
            {dashboard?.roleLabel ?? "YOUR WORKSPACE"}
          </Text>

          <Text style={styles.heroGreeting}>Hello, {firstName}.</Text>

          <Text style={styles.heroText}>
            {dashboard?.description ?? "Loading your FoodShare activity."}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Live activity</Text>
            <Text style={styles.sectionSubtitle}>
              Updated whenever you open this screen.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh dashboard"
            disabled={loading}
            onPress={() => setReloadKey((value) => value + 1)}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && !loading && styles.refreshButtonPressed,
              loading && styles.refreshButtonDisabled,
            ]}
          >
            <Text style={styles.refreshButtonText}>
              {loading ? "Loading" : "Refresh"}
            </Text>
          </Pressable>
        </View>

        {loading && !dashboard ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#176B43" />
            <Text style={styles.loadingText}>Loading live activity…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Dashboard unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setReloadKey((value) => value + 1)}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {dashboard ? (
          <>
            <View style={styles.metrics}>
              {dashboard.metrics.map((metric, index) => (
                <View
                  key={metric.label}
                  style={[
                    styles.metric,
                    index === dashboard.metrics.length - 1 &&
                      styles.metricLast,
                  ]}
                >
                  <Text style={styles.metricValue}>{metric.value}</Text>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.nextCard}>
              <Text style={styles.nextLabel}>NEXT STEP</Text>
              <Text style={styles.nextTitle}>{dashboard.title}</Text>
              <Text style={styles.nextText}>{dashboard.nextStep}</Text>
            </View>
          </>
        ) : null}
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
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 36,
    gap: 24,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#176B43",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },
  brand: {
    color: "#183B2A",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  hero: {
    gap: 12,
    borderRadius: 26,
    padding: 24,
    backgroundColor: "#174B36",
    shadowColor: "#0A2E1C",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroLabel: {
    color: "#B9DFC7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heroGreeting: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroText: {
    color: "#C5E5D0",
    fontSize: 15,
    lineHeight: 23,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  sectionTitle: {
    color: "#173526",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    color: "#728278",
    fontSize: 13,
    marginTop: 4,
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#DFF1E5",
  },
  refreshButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "800",
  },
  loadingBox: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#173526",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  loadingText: {
    color: "#66786D",
    fontSize: 14,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    minHeight: 128,
    flexGrow: 1,
    flexBasis: "46%",
    justifyContent: "space-between",
    borderRadius: 22,
    padding: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#173526",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  metricLast: {
    flexBasis: "100%",
  },
  metricValue: {
    color: "#173526",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  metricLabel: {
    color: "#66786D",
    fontSize: 14,
    fontWeight: "700",
  },
  nextCard: {
    gap: 10,
    borderRadius: 22,
    padding: 22,
    backgroundColor: "#E4F2E8",
    borderWidth: 1,
    borderColor: "#C8E2D0",
  },
  nextLabel: {
    color: "#548468",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  nextTitle: {
    color: "#173526",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  nextText: {
    color: "#496957",
    fontSize: 15,
    lineHeight: 23,
  },
  errorBox: {
    gap: 10,
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#F2F5F3",
    borderWidth: 1,
    borderColor: "#D5E0D8",
  },
  errorTitle: {
    color: "#173526",
    fontSize: 17,
    fontWeight: "800",
  },
  errorText: {
    color: "#5F7367",
    fontSize: 14,
    lineHeight: 21,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#176B43",
  },
  retryButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
