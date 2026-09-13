import { Link } from "expo-router";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/types/auth";

type HomeContent = {
  label: string;
  title: string;
  description: string;
  nextStep: string;
};

const roleContent: Record<UserRole, HomeContent> = {
  RESTAURANT: {
    label: "Restaurant",
    title: "Share more. Waste less.",
    description:
      "Turn safe surplus food into meaningful support for your community.",
    nextStep: "Your donation activity and pickup updates will appear in Dashboard.",
  },
  NGO: {
    label: "NGO",
    title: "Food can reach further.",
    description:
      "Find available food and coordinate collections for the people you serve.",
    nextStep: "Your requests and collection updates will appear in Dashboard.",
  },
  ADMIN: {
    label: "Administrator",
    title: "Keep the community moving.",
    description:
      "Support trusted Restaurants and NGOs as FoodShare grows.",
    nextStep: "Account reviews and platform activity will appear in Dashboard.",
  },
};

function AccountDetail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value?.trim() || "Not provided"}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();

  if (!user) return null;

  const content = roleContent[user.role];
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
          <Text style={styles.eyebrow}>COMMUNITY FOOD NETWORK</Text>

          <Text style={styles.greeting}>Good to see you, {firstName}.</Text>

          <Text style={styles.heroDescription}>{content.description}</Text>

          <View style={styles.roleBadge}>
            <View style={styles.roleDot} />
            <Text style={styles.roleText}>{content.label}</Text>
          </View>
        </View>

        <View style={styles.focusSection}>
          <Text style={styles.sectionLabel}>YOUR FOODSHARE SPACE</Text>
          <Text style={styles.sectionTitle}>{content.title}</Text>
          <Text style={styles.sectionDescription}>{content.nextStep}</Text>
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.cardTitle}>Account</Text>

          <AccountDetail
            label="Organization"
            value={user.organization_name}
          />
          <AccountDetail label="Email" value={user.email} />
          <AccountDetail label="Area" value={user.area} />
        </View>

        <Link href="/profile" asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.profileButton,
              pressed && styles.profileButtonPressed,
            ]}
          >
            <Text style={styles.profileButtonText}>View profile</Text>
            <Text style={styles.profileButtonArrow}>→</Text>
          </Pressable>
        </Link>
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
    paddingBottom: 32,
    gap: 26,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#176B43",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  brand: {
    color: "#183B2A",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  hero: {
    gap: 13,
    paddingTop: 12,
  },
  eyebrow: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  greeting: {
    color: "#173526",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 38,
  },
  heroDescription: {
    color: "#587063",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 460,
  },
  roleBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#DFF1E5",
  },
  roleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#176B43",
  },
  roleText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "700",
  },
  focusSection: {
    paddingVertical: 6,
    gap: 8,
  },
  sectionLabel: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#173526",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  sectionDescription: {
    color: "#587063",
    fontSize: 15,
    lineHeight: 23,
  },
  accountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: "#173526",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTitle: {
    color: "#173526",
    fontSize: 17,
    fontWeight: "800",
    paddingTop: 12,
    paddingBottom: 4,
  },
  detailRow: {
    gap: 4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E8EEE9",
  },
  detailLabel: {
    color: "#7B8C81",
    fontSize: 12,
    fontWeight: "700",
  },
  detailValue: {
    color: "#2B4436",
    fontSize: 15,
    lineHeight: 21,
  },
  profileButton: {
    minHeight: 56,
    borderRadius: 17,
    paddingHorizontal: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#176B43",
  },
  profileButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  profileButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  profileButtonArrow: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "500",
  },
});