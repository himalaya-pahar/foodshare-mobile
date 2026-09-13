import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LogoutButton from "@/components/logout-button";
import { useAuth } from "@/providers/auth-provider";
import type {
  ApprovalStatus,
  UserRole,
} from "@/types/auth";

type ProfileFieldProps = {
  label: string;
  value?: string | null;
  last?: boolean;
};

function displayRole(role: UserRole): string {
  if (role === "RESTAURANT") return "Restaurant";
  if (role === "NGO") return "NGO";
  return "Administrator";
}

function displayApprovalStatus(status: ApprovalStatus): string {
  if (status === "APPROVED") return "Approved";
  if (status === "PENDING") return "Pending approval";
  return "Rejected";
}

function ProfileField({
  label,
  value,
  last = false,
}: ProfileFieldProps) {
  return (
    <View style={[styles.field, last && styles.fieldLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>
        {value?.trim() || "Not provided"}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useAuth();

  if (!user) return null;

  const initial = user.full_name.trim().charAt(0).toUpperCase() || "F";

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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          <Text style={styles.heroLabel}>YOUR PROFILE</Text>

          <Text style={styles.name}>{user.full_name}</Text>

          <Text style={styles.email}>{user.email}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {displayRole(user.role)}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {displayApprovalStatus(user.approval_status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
          <Text style={styles.sectionTitle}>Your information</Text>
        </View>

        <View style={styles.detailsCard}>
          <ProfileField label="Full name" value={user.full_name} />
          <ProfileField
            label="Organization"
            value={user.organization_name}
          />
          <ProfileField label="Email address" value={user.email} last />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>CONTACT & LOCATION</Text>
          <Text style={styles.sectionTitle}>Where to reach you</Text>
        </View>

        <View style={styles.detailsCard}>
          <ProfileField label="Phone number" value={user.phone} />
          <ProfileField label="Area" value={user.area} />
          <ProfileField label="Address" value={user.address} last />
        </View>

        <View style={styles.logoutSection}>
          <Text style={styles.sectionLabel}>ACCOUNT SECURITY</Text>
          <Text style={styles.logoutHint}>
            Logging out removes your saved session from this device.
          </Text>
          <LogoutButton />
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
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 32,
    gap: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
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
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: "#174B36",
  },
  avatar: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderRadius: 29,
    backgroundColor: "#DFF1E5",
  },
  avatarText: {
    color: "#176B43",
    fontSize: 34,
    fontWeight: "800",
  },
  heroLabel: {
    color: "#B9DFC7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  name: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  email: {
    marginTop: 5,
    color: "#D7E9DC",
    fontSize: 14,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#2A644B",
  },
  roleBadgeText: {
    color: "#E3F2E7",
    fontSize: 12,
    fontWeight: "800",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#E3F2E7",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#176B43",
  },
  statusText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionHeader: {
    gap: 5,
    marginTop: 4,
  },
  sectionLabel: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#173526",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  detailsCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
  },
  field: {
    gap: 5,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E7EEE8",
  },
  fieldLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    color: "#75867C",
    fontSize: 12,
    fontWeight: "800",
  },
  fieldValue: {
    color: "#203B2B",
    fontSize: 16,
    lineHeight: 23,
  },
  logoutSection: {
    gap: 10,
    marginTop: 8,
  },
  logoutHint: {
    color: "#6B7D71",
    fontSize: 14,
    lineHeight: 21,
  },
});