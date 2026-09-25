import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BrandHeader from "@/components/brand-header";
import { useAuth } from "@/providers/auth-provider";
import PaginationControls from "@/components/pagination-controls";
import { formatBangladeshDate, formatBangladeshDateTime } from "@/lib/datetime";
import {
  approveAdminUser,
  deleteAdminUser,
  getAdminUsers,
  getPendingUsers,
  rejectAdminUser,
  updateUserApproval,
} from "@/services/admin";
import type { AdminUser, ApprovalDecision } from "@/types/admin";
import type { PaginatedResponse } from "@/types/pagination";

const PAGE_SIZE = 20;

type ListMode = "pending" | "all";

function formatRole(role: AdminUser["role"]): string {
  if (role === "RESTAURANT") return "Restaurant";
  if (role === "NGO") return "NGO";
  return "Administrator";
}

function formatJoinedDate(createdAt: string): string {
  return `Joined ${formatBangladeshDate(createdAt)}`;
}

function getStatusBadgeConfig(item: AdminUser): {
  label: string;
  badgeStyle: object;
  textStyle: object;
  isPendingEmail: boolean;
  isPendingReview: boolean;
} {
  const status = item.status;

  if (status === "pending_email") {
    return {
      label: "Pending Email",
      badgeStyle: styles.pendingEmailBadge,
      textStyle: styles.pendingEmailText,
      isPendingEmail: true,
      isPendingReview: true,
    };
  }

  if (status === "pending_admin") {
    return {
      label: "Pending Admin",
      badgeStyle: styles.pendingBadge,
      textStyle: styles.pendingText,
      isPendingEmail: false,
      isPendingReview: true,
    };
  }

  if (status === "active") {
    return {
      label: "Active",
      badgeStyle: styles.approvedBadge,
      textStyle: styles.approvedText,
      isPendingEmail: false,
      isPendingReview: false,
    };
  }

  if (status === "rejected") {
    return {
      label: "Rejected",
      badgeStyle: styles.rejectedBadge,
      textStyle: styles.rejectedText,
      isPendingEmail: false,
      isPendingReview: false,
    };
  }

  // Fallback to approval_status
  const isPending = item.approval_status === "PENDING";
  const isApproved = item.approval_status === "APPROVED";

  return {
    label: item.approval_status || "Pending",
    badgeStyle: isPending
      ? styles.pendingBadge
      : isApproved
        ? styles.approvedBadge
        : styles.rejectedBadge,
    textStyle: isPending
      ? styles.pendingText
      : isApproved
        ? styles.approvedText
        : styles.rejectedText,
    isPendingEmail: false,
    isPendingReview: isPending,
  };
}

function AdminUserDetailModal({
  user,
  currentAdminId,
  disabled,
  onClose,
  onApproval,
  onDelete,
}: {
  user: AdminUser;
  currentAdminId: number;
  disabled: boolean;
  onClose: () => void;
  onApproval: (user: AdminUser, decision: ApprovalDecision) => void;
  onDelete: (user: AdminUser) => void;
}) {
  const initial = user.full_name.trim().charAt(0).toUpperCase() || "U";
  const statusConfig = getStatusBadgeConfig(user);
  const isCurrentAdmin = user.id === currentAdminId;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>ACCOUNT DETAILS</Text>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {user.full_name}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close details"
              onPress={onClose}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.buttonPressed]}
            >
              <Ionicons name="close" size={22} color="#16673E" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Top User Hero Card */}
            <View style={styles.modalHeroCard}>
              <View style={styles.modalHeroAvatar}>
                <Text style={styles.modalHeroAvatarText}>{initial}</Text>
              </View>
              <View style={styles.modalHeroInfo}>
                <Text style={styles.modalHeroName}>{user.full_name}</Text>
                <Text style={styles.modalHeroRole}>{formatRole(user.role)}</Text>
                <View style={styles.modalHeroBadges}>
                  <View style={[styles.statusBadge, statusConfig.badgeStyle]}>
                    <Text style={[styles.statusText, statusConfig.textStyle]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                  <View style={[styles.verifiedChip, user.email_verified ? styles.verifiedChipGreen : styles.verifiedChipAmber]}>
                    <Ionicons
                      name={user.email_verified ? "checkmark-circle" : "alert-circle-outline"}
                      size={12}
                      color={user.email_verified ? "#16673E" : "#B25E00"}
                    />
                    <Text style={[styles.verifiedChipText, user.email_verified ? styles.verifiedChipTextGreen : styles.verifiedChipTextAmber]}>
                      {user.email_verified ? "Email Verified" : "Email Pending"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Organization & Identification Card */}
            <View style={styles.modalSectionCard}>
              <View style={styles.modalDetailRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="business-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalDetailInfo}>
                  <Text style={styles.modalDetailLabel}>ORGANIZATION</Text>
                  <Text style={styles.modalDetailValue}>
                    {user.organization_name || "No organization name provided"}
                  </Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="mail-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalDetailInfo}>
                  <Text style={styles.modalDetailLabel}>EMAIL ADDRESS</Text>
                  <Text style={styles.modalDetailValue}>{user.email}</Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="call-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalDetailInfo}>
                  <Text style={styles.modalDetailLabel}>PHONE NUMBER</Text>
                  <Text style={styles.modalDetailValue}>
                    {user.phone || "Not provided"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Physical Location Card */}
            <View style={styles.modalSectionCard}>
              <View style={styles.modalDetailRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="location-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalDetailInfo}>
                  <Text style={styles.modalDetailLabel}>PHYSICAL ADDRESS</Text>
                  <Text style={styles.modalDetailValue}>
                    {user.address || "No street address registered"}
                  </Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="map-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalDetailInfo}>
                  <Text style={styles.modalDetailLabel}>OPERATING AREA / CITY</Text>
                  <Text style={styles.modalDetailValue}>
                    {user.area || "Area not specified"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Registration & Audit Timeline */}
            <View style={styles.modalSectionCard}>
              <View style={styles.modalDetailRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalDetailInfo}>
                  <Text style={styles.modalDetailLabel}>REGISTERED DATE</Text>
                  <Text style={styles.modalDetailValue}>
                    {formatBangladeshDateTime(user.created_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <View style={styles.modalDetailRow}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalDetailInfo}>
                  <Text style={styles.modalDetailLabel}>ADMIN APPROVAL DECISION</Text>
                  <Text style={styles.modalDetailValue}>
                    {statusConfig.isPendingReview
                      ? "Awaiting Administrator Review"
                      : user.status === "active" || user.approval_status === "APPROVED"
                        ? "Account Approved & Active"
                        : "Account Rejected"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Decision Actions for Admins */}
            {statusConfig.isPendingReview ? (
              <View style={styles.modalActionsCard}>
                <Text style={styles.modalActionsTitle}>Review Decision</Text>
                <Text style={styles.modalActionsSubtitle}>
                  {statusConfig.isPendingEmail
                    ? "User must verify their email before they can be approved."
                    : "Approve this user to grant access to the FoodShare network."}
                </Text>

                <View style={styles.modalDecisionRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => onApproval(user, "REJECTED")}
                    style={({ pressed }) => [
                      styles.modalRejectButton,
                      pressed && !disabled && styles.buttonPressed,
                      disabled && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.modalRejectButtonText}>Reject</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={disabled || statusConfig.isPendingEmail}
                    onPress={() => onApproval(user, "APPROVED")}
                    style={({ pressed }) => [
                      styles.modalApproveButton,
                      statusConfig.isPendingEmail && styles.approveButtonDisabled,
                      pressed && !disabled && !statusConfig.isPendingEmail && styles.buttonPressed,
                      (disabled || statusConfig.isPendingEmail) && styles.buttonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modalApproveButtonText,
                        statusConfig.isPendingEmail && styles.approveButtonTextDisabled,
                      ]}
                    >
                      Approve Account
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Danger / Deletion Zone */}
            {!isCurrentAdmin ? (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => onDelete(user)}
                style={({ pressed }) => [
                  styles.modalDeleteButton,
                  pressed && !disabled && styles.buttonPressed,
                  disabled && styles.buttonDisabled,
                ]}
              >
                <Ionicons name="trash-outline" size={16} color="#BA1A1A" />
                <Text style={styles.modalDeleteButtonText}>Delete User Account</Text>
              </Pressable>
            ) : null}

            {/* Done Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onClose}
              style={({ pressed }) => [styles.modalDoneButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function UserRow({
  item,
  currentAdminId,
  disabled,
  onSelect,
  onApproval,
}: {
  item: AdminUser;
  currentAdminId: number;
  disabled: boolean;
  onSelect: (user: AdminUser) => void;
  onApproval: (user: AdminUser, decision: ApprovalDecision) => void;
}) {
  const initial = item.full_name.trim().charAt(0).toUpperCase() || "U";
  const statusConfig = getStatusBadgeConfig(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View account details for ${item.full_name}`}
      onPress={() => onSelect(item)}
      style={({ pressed }) => [styles.userRow, pressed && styles.cardPressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      <View style={styles.userContent}>
        <View style={styles.nameRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.full_name}
          </Text>

          <View style={[styles.statusBadge, statusConfig.badgeStyle]}>
            <Text style={[styles.statusText, statusConfig.textStyle]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <Text style={styles.organization} numberOfLines={1}>
          {item.organization_name || "No organization name"}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {item.email}
        </Text>

        {item.area || item.address ? (
          <View style={styles.locationSnippetRow}>
            <Ionicons name="location-outline" size={12} color="#456351" />
            <Text style={styles.locationSnippetText} numberOfLines={1}>
              {item.area ? `${item.area}${item.address ? ` · ${item.address}` : ""}` : item.address}
            </Text>
          </View>
        ) : null}

        <Text style={styles.meta}>
          {formatRole(item.role)} · {formatJoinedDate(item.created_at)}
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${item.full_name}`}
            onPress={(e) => {
              e.stopPropagation?.();
              onSelect(item);
            }}
            style={({ pressed }) => [
              styles.viewDetailsButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.viewDetailsButtonText}>View Details</Text>
            <Ionicons name="chevron-forward" size={14} color="#16673E" />
          </Pressable>



          {item.id === currentAdminId ? (
            <Text style={styles.currentAccount}>Your account</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const isUserApproved =
    user?.status === "active" ||
    (!user?.status && user?.approval_status === "APPROVED");
  const isAdmin = user?.role === "ADMIN" && isUserApproved;

  const [mode, setMode] = useState<ListMode>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<PaginatedResponse<AdminUser> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      setQuery(searchInput.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!isAdmin) {
        return () => {
          active = false;
        };
      }

      async function loadUsers() {
        setLoading(true);
        setError(null);

        try {
          let result: PaginatedResponse<AdminUser>;

          if (mode === "pending") {
            result = await getPendingUsers({
              limit: PAGE_SIZE,
              offset,
              q: query || undefined,
            });
          } else {
            const raw = await getAdminUsers({
              limit: PAGE_SIZE,
              offset,
              q: query || undefined,
            });

            // Filter out pending users from the "all" tab — they belong in the "pending" tab
            const nonPending = raw.items.filter((u) => {
              if (u.status === "pending_email" || u.status === "pending_admin") return false;
              if (!u.status && u.approval_status === "PENDING") return false;
              return true;
            });

            result = { ...raw, items: nonPending, total: raw.total - (raw.items.length - nonPending.length) };
          }

          if (!active) return;

          if (result.items.length === 0 && result.total > 0 && offset > 0) {
            const lastPageOffset =
              Math.floor((result.total - 1) / PAGE_SIZE) * PAGE_SIZE;
            setOffset(lastPageOffset);
            return;
          }

          setPage(result);
        } catch (requestError) {
          if (active) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Could not load users.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadUsers();

      return () => {
        active = false;
      };
    }, [isAdmin, mode, offset, query, reloadKey]),
  );

  function changeMode(nextMode: ListMode) {
    if (nextMode === mode) return;

    setMode(nextMode);
    setOffset(0);
    setPage(null);
  }

  function changePage(nextOffset: number) {
    setOffset(nextOffset);
    setPage(null);
  }

  async function handleApproval(
    targetUser: AdminUser,
    decision: ApprovalDecision,
  ) {
    if (busyUserId !== null) return;

    setBusyUserId(targetUser.id);

    try {
      if (decision === "APPROVED") {
        await approveAdminUser(targetUser.id);
      } else {
        await rejectAdminUser(targetUser.id);
      }
      setSelectedUser(null);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      Alert.alert(
        "Could not update account",
        requestError instanceof Error
          ? requestError.message
          : "Please try again.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function deleteUser(targetUser: AdminUser) {
    if (busyUserId !== null) return;

    setBusyUserId(targetUser.id);

    try {
      await deleteAdminUser(targetUser.id);
      setSelectedUser(null);
      setReloadKey((value) => value + 1);
    } catch (requestError) {
      Alert.alert(
        "Could not delete account",
        requestError instanceof Error
          ? requestError.message
          : "Please try again.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  function confirmDelete(targetUser: AdminUser) {
    Alert.alert(
      "Delete this account?",
      `${targetUser.full_name} will permanently lose access to FoodShare.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteUser(targetUser);
          },
        },
      ],
    );
  }

  if (!isAdmin || !user) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessTitle}>Admin access required</Text>
          <Text style={styles.accessText}>
            This screen is available only to approved administrators.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const rows = page?.items ?? [];
  const total = page?.total ?? 0;
  const firstItem = rows.length === 0 ? 0 : offset + 1;
  const lastItem = Math.min(offset + rows.length, total);
  const canGoBack = offset > 0 && !loading;
  const canGoForward = offset + rows.length < total && !loading;

  return (
    <SafeAreaView
      style={styles.screen}
      edges={Platform.OS === "android" ? ["top", "left", "right"] : []}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={loading && Boolean(page)}
            onRefresh={() => setReloadKey((value) => value + 1)}
            tintColor="#16673E"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />

        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Administration</Text>
          </View>
          <Text style={styles.headerTitle}>Manage Accounts</Text>
          <Text style={styles.headerText}>
            Review registrations and maintain a trusted FoodShare community.
          </Text>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => changeMode("pending")}
            style={[
              styles.tabButton,
              mode === "pending" && styles.tabButtonActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                mode === "pending" && styles.tabTextActive,
              ]}
            >
              Pending
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => changeMode("all")}
            style={[
              styles.tabButton,
              mode === "all" && styles.tabButtonActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                mode === "all" && styles.tabTextActive,
              ]}
            >
              All users
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search name, email, organization…"
            placeholderTextColor="#87968C"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.listTitle}>
              {mode === "pending" ? "Awaiting review" : "All accounts"}
            </Text>
            <Text style={styles.rangeText}>
              {total > 0
                ? `Showing ${firstItem}–${lastItem} of ${total}`
                : "No accounts found"}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh accounts"
            disabled={loading}
            onPress={() => setReloadKey((value) => value + 1)}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && !loading && styles.refreshButtonPressed,
              loading && styles.refreshButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#16673E" />
            ) : (
              <Text style={styles.refreshText}>Refresh</Text>
            )}
          </Pressable>
        </View>

        {loading && !page ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#176B43" />
            <Text style={styles.loadingText}>Loading accounts…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load users</Text>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setReloadKey((value) => value + 1)}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {query ? "No matching accounts" : "No accounts here"}
            </Text>
            <Text style={styles.emptyText}>
              {query
                ? "Try a different name, email, or organization."
                : "New account registrations will appear here."}
            </Text>
          </View>
        ) : null}

        {!error
          ? rows.map((item) => (
              <UserRow
                key={item.id}
                item={item}
                currentAdminId={user.id}
                disabled={busyUserId !== null}
                onSelect={(target) => setSelectedUser(target)}
                onApproval={handleApproval}
              />
            ))
          : null}

        <PaginationControls
          offset={offset}
          limit={PAGE_SIZE}
          total={total}
          loading={loading}
          onPageChange={changePage}
        />
      </ScrollView>

      {selectedUser ? (
        <AdminUserDetailModal
          user={selectedUser}
          currentAdminId={user.id}
          disabled={busyUserId !== null}
          onClose={() => setSelectedUser(null)}
          onApproval={(targetUser, decision) => {
            setSelectedUser(null);
            handleApproval(targetUser, decision);
          }}
          onDelete={(targetUser) => {
            setSelectedUser(null);
            confirmDelete(targetUser);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F3" },
  container: {
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 36,
    gap: 18,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  brand: { color: "#183B2A", fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  header: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  headerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E4F2E8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C6E4D1",
  },
  headerBadgeText: {
    color: "#176B43",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#17251B",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  headerText: {
    color: "#526057",
    fontSize: 15,
    lineHeight: 22,
  },
  tabRow: {
    flexDirection: "row",
    padding: 5,
    gap: 5,
    borderRadius: 16,
    backgroundColor: "#E4ECE6",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tabButtonActive: {
    backgroundColor: "#FAFDFB",
    borderWidth: 1,
    borderColor: "#DCE7E0",
    shadowColor: "#173526",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tabText: { color: "#6A7C70", fontSize: 14, fontWeight: "800" },
  tabTextActive: { color: "#176B43" },
  searchBox: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE6DF",
    shadowColor: "#173526",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  searchIcon: { color: "#6D8375", fontSize: 24, lineHeight: 24 },
  searchInput: {
    flex: 1,
    color: "#173526",
    fontSize: 16,
    paddingVertical: 16,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 6,
  },
  listTitle: { color: "#173526", fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  rangeText: { color: "#75867C", fontSize: 14, marginTop: 4 },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#BEDECB",
    minHeight: 38,
  },
  refreshButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  refreshButtonDisabled: {
    opacity: 0.65,
  },
  refreshText: { color: "#16673E", fontSize: 13, fontWeight: "800" },
  userRow: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE6DF",
    shadowColor: "#173526",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#DFF1E5",
  },
  avatarText: { color: "#176B43", fontSize: 18, fontWeight: "800" },
  userContent: { flex: 1, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  userName: {
    flexShrink: 1,
    color: "#173526",
    fontSize: 17,
    fontWeight: "800",
  },
  organization: { color: "#5F7367", fontSize: 14, lineHeight: 20 },
  email: { color: "#75867C", fontSize: 14, lineHeight: 20 },
  meta: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pendingBadge: { backgroundColor: "#FFF0CE" },
  pendingEmailBadge: {
    backgroundColor: "#FFF4DC",
    borderWidth: 1,
    borderColor: "#FFE2A8",
  },
  approvedBadge: { backgroundColor: "#DFF1E5" },
  rejectedBadge: { backgroundColor: "#ECEFF1" },
  statusText: { fontSize: 11, fontWeight: "800" },
  pendingText: { color: "#9A6500" },
  pendingEmailText: { color: "#B56F00" },
  approvedText: { color: "#176B43" },
  rejectedText: { color: "#546E7A" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  approveButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#1E8250",
  },
  approveButtonDisabled: {
    backgroundColor: "#D7E3DC",
  },
  approveButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  approveButtonTextDisabled: { color: "#7B8E83" },
  unverifiedNote: {
    color: "#B56F00",
    fontSize: 12,
    fontWeight: "700",
    alignSelf: "center",
    marginLeft: 2,
  },
  rejectButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF0CE",
  },
  rejectButtonText: { color: "#925E00", fontSize: 13, fontWeight: "800" },
  deleteButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ECEFF1",
  },
  deleteButtonText: { color: "#546E7A", fontSize: 13, fontWeight: "800" },
  currentAccount: { color: "#75867C", fontSize: 13, fontWeight: "700" },
  paginationRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  pageButton: {
    minHeight: 52,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#E4ECE6",
  },
  pageButtonPrimary: { backgroundColor: "#176B43", shadowColor: "#0D3B22", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  pageButtonText: { color: "#325342", fontSize: 15, fontWeight: "800" },
  pageButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.48 },
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
  loadingText: { color: "#66786D", fontSize: 14 },
  errorBox: {
    gap: 10,
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#F2F5F3",
    borderWidth: 1,
    borderColor: "#D5E0D8",
  },
  errorTitle: { color: "#173526", fontSize: 17, fontWeight: "800" },
  errorText: { color: "#5F7367", fontSize: 14, lineHeight: 21 },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#176B43",
  },
  retryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  emptyBox: {
    alignItems: "center",
    gap: 10,
    borderRadius: 24,
    padding: 32,
    backgroundColor: "#FFFFFF",
    shadowColor: "#173526",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  emptyTitle: { color: "#173526", fontSize: 19, fontWeight: "800" },
  emptyText: {
    color: "#6D7F73",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  accessDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 30,
  },
  accessTitle: { color: "#173526", fontSize: 22, fontWeight: "800" },
  accessText: { color: "#6D7F73", fontSize: 15, textAlign: "center" },

  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  locationSnippetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationSnippetText: {
    color: "#456351",
    fontSize: 12,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#BEDECB",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  viewDetailsButtonText: {
    color: "#16673E",
    fontSize: 13,
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(13, 36, 24, 0.5)",
  },
  modalCard: {
    maxHeight: "90%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F4F7F3",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#DCE7E0",
    backgroundColor: "#FAFDFB",
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  modalEyebrow: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  modalTitle: {
    color: "#173526",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#E6F1E9",
    borderWidth: 1,
    borderColor: "#CFE3D5",
  },
  modalBody: {
    padding: 20,
    gap: 16,
    paddingBottom: 36,
  },
  modalHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
  },
  modalHeroAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#16673E",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeroAvatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  modalHeroInfo: {
    flex: 1,
    gap: 3,
  },
  modalHeroName: {
    color: "#173526",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalHeroRole: {
    color: "#456351",
    fontSize: 13,
    fontWeight: "700",
  },
  modalHeroBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  verifiedChipGreen: {
    backgroundColor: "#EAF5EE",
    borderColor: "#BEDECB",
  },
  verifiedChipAmber: {
    backgroundColor: "#FFF8E1",
    borderColor: "#FFE082",
  },
  verifiedChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  verifiedChipTextGreen: {
    color: "#16673E",
  },
  verifiedChipTextAmber: {
    color: "#B25E00",
  },
  modalSectionCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    gap: 12,
  },
  modalDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#BEDECB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  modalDetailInfo: {
    flex: 1,
    gap: 3,
  },
  modalDetailLabel: {
    color: "#75867C",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modalDetailValue: {
    color: "#173526",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#E6EFE9",
  },
  modalActionsCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    gap: 6,
  },
  modalActionsTitle: {
    color: "#173526",
    fontSize: 15,
    fontWeight: "800",
  },
  modalActionsSubtitle: {
    color: "#556A5D",
    fontSize: 12,
    lineHeight: 18,
  },
  modalDecisionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalRejectButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#FCEEEE",
    borderWidth: 1,
    borderColor: "#F2B8B5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalRejectButtonText: {
    color: "#BA1A1A",
    fontSize: 14,
    fontWeight: "800",
  },
  modalApproveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#1E8250",
    alignItems: "center",
    justifyContent: "center",
  },
  modalApproveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  modalDeleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#FCEEEE",
    borderWidth: 1,
    borderColor: "#F2B8B5",
  },
  modalDeleteButtonText: {
    color: "#BA1A1A",
    fontSize: 13,
    fontWeight: "800",
  },
  modalDoneButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#1E8250",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginTop: 4,
  },
  modalDoneButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
