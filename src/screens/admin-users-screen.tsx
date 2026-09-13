import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";
import {
  deleteAdminUser,
  getAdminUsers,
  getPendingUsers,
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
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Joined date unavailable";
  }

  return `Joined ${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function UserRow({
  item,
  currentAdminId,
  disabled,
  onApproval,
  onDelete,
}: {
  item: AdminUser;
  currentAdminId: number;
  disabled: boolean;
  onApproval: (user: AdminUser, decision: ApprovalDecision) => void;
  onDelete: (user: AdminUser) => void;
}) {
  const initial = item.full_name.trim().charAt(0).toUpperCase() || "U";
  const isPending = item.approval_status === "PENDING";
  const isApproved = item.approval_status === "APPROVED";

  return (
    <View style={styles.userRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      <View style={styles.userContent}>
        <View style={styles.nameRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.full_name}
          </Text>

          <View
            style={[
              styles.statusBadge,
              isPending && styles.pendingBadge,
              isApproved && styles.approvedBadge,
              !isPending && !isApproved && styles.rejectedBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isPending && styles.pendingText,
                isApproved && styles.approvedText,
                !isPending && !isApproved && styles.rejectedText,
              ]}
            >
              {item.approval_status}
            </Text>
          </View>
        </View>

        <Text style={styles.organization} numberOfLines={1}>
          {item.organization_name || "No organization name"}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {item.email}
        </Text>
        <Text style={styles.meta}>
          {formatRole(item.role)} · {formatJoinedDate(item.created_at)}
        </Text>

        <View style={styles.actions}>
          {isPending ? (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => onApproval(item, "REJECTED")}
                style={({ pressed }) => [
                  styles.rejectButton,
                  pressed && !disabled && styles.buttonPressed,
                  disabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => onApproval(item, "APPROVED")}
                style={({ pressed }) => [
                  styles.approveButton,
                  pressed && !disabled && styles.buttonPressed,
                  disabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.approveButtonText}>Approve</Text>
              </Pressable>
            </>
          ) : null}

          {item.id === currentAdminId ? (
            <Text style={styles.currentAccount}>Your account</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onDelete(item)}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && !disabled && styles.buttonPressed,
                disabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const isAdmin =
    user?.role === "ADMIN" &&
    user.approval_status === "APPROVED";

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
          const result =
            mode === "pending"
              ? await getPendingUsers({
                  limit: PAGE_SIZE,
                  offset,
                  q: query || undefined,
                })
              : await getAdminUsers({
                  limit: PAGE_SIZE,
                  offset,
                  q: query || undefined,
                });

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
      await updateUserApproval(targetUser.id, decision);
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.brand}>FoodShare</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>ADMINISTRATION</Text>
          <Text style={styles.heroTitle}>Manage accounts.</Text>
          <Text style={styles.heroText}>
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
            disabled={loading}
            onPress={() => setReloadKey((value) => value + 1)}
          >
            <Text style={styles.refreshText}>
              {loading ? "Loading…" : "Refresh"}
            </Text>
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
                onApproval={handleApproval}
                onDelete={confirmDelete}
              />
            ))
          : null}

        {total > 0 ? (
          <View style={styles.paginationRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!canGoBack}
              onPress={() => changePage(Math.max(0, offset - PAGE_SIZE))}
              style={[styles.pageButton, !canGoBack && styles.buttonDisabled]}
            >
              <Text style={styles.pageButtonText}>Previous</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={!canGoForward}
              onPress={() => changePage(offset + PAGE_SIZE)}
              style={[
                styles.pageButton,
                styles.pageButtonPrimary,
                !canGoForward && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.pageButtonPrimaryText}>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
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
    paddingBottom: 32,
    gap: 18,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#176B43",
  },
  logoText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  brand: { color: "#183B2A", fontSize: 20, fontWeight: "800" },
  hero: {
    gap: 9,
    borderRadius: 26,
    padding: 24,
    backgroundColor: "#174B36",
  },
  heroLabel: {
    color: "#B9DFC7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroText: { color: "#D7E9DC", fontSize: 15, lineHeight: 23 },
  tabRow: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 15,
    backgroundColor: "#E4ECE6",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  tabButtonActive: { backgroundColor: "#FFFFFF" },
  tabText: { color: "#6A7C70", fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#176B43" },
  searchBox: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 16,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
  },
  searchIcon: { color: "#6D8375", fontSize: 25, lineHeight: 25 },
  searchInput: {
    flex: 1,
    color: "#173526",
    fontSize: 15,
    paddingVertical: 14,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 4,
  },
  listTitle: { color: "#173526", fontSize: 20, fontWeight: "800" },
  rangeText: { color: "#75867C", fontSize: 13, marginTop: 3 },
  refreshText: { color: "#176B43", fontSize: 14, fontWeight: "800" },
  userRow: {
    flexDirection: "row",
    gap: 13,
    borderRadius: 21,
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  avatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#DFF1E5",
  },
  avatarText: { color: "#176B43", fontSize: 17, fontWeight: "800" },
  userContent: { flex: 1, gap: 5 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: {
    flexShrink: 1,
    color: "#173526",
    fontSize: 16,
    fontWeight: "800",
  },
  organization: { color: "#5F7367", fontSize: 14 },
  email: { color: "#75867C", fontSize: 13 },
  meta: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pendingBadge: { backgroundColor: "#FFF0CE" },
  approvedBadge: { backgroundColor: "#DFF1E5" },
  rejectedBadge: { backgroundColor: "#FDE2DE" },
  statusText: { fontSize: 10, fontWeight: "800" },
  pendingText: { color: "#9A6500" },
  approvedText: { color: "#176B43" },
  rejectedText: { color: "#A3382C" },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  approveButton: {
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#176B43",
  },
  approveButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  rejectButton: {
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#FFF0CE",
  },
  rejectButtonText: { color: "#925E00", fontSize: 12, fontWeight: "800" },
  deleteButton: {
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#FDE2DE",
  },
  deleteButtonText: { color: "#A3382C", fontSize: 12, fontWeight: "800" },
  currentAccount: { color: "#75867C", fontSize: 12, fontWeight: "700" },
  paginationRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  pageButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#E4ECE6",
  },
  pageButtonPrimary: { backgroundColor: "#176B43" },
  pageButtonText: { color: "#325342", fontSize: 14, fontWeight: "800" },
  pageButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.48 },
  loadingBox: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
  },
  loadingText: { color: "#66786D", fontSize: 14 },
  errorBox: {
    gap: 9,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFF2F0",
  },
  errorTitle: { color: "#9B2C22", fontSize: 16, fontWeight: "800" },
  errorText: { color: "#7A3D36", fontSize: 14, lineHeight: 21 },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#9B2C22",
  },
  retryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    borderRadius: 22,
    padding: 28,
    backgroundColor: "#FFFFFF",
  },
  emptyTitle: { color: "#173526", fontSize: 17, fontWeight: "800" },
  emptyText: {
    color: "#6D7F73",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  accessDenied: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  accessTitle: { color: "#173526", fontSize: 20, fontWeight: "800" },
  accessText: { color: "#6D7F73", fontSize: 14, textAlign: "center" },
});
