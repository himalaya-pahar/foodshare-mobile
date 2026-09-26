import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BrandHeader from "@/components/brand-header";
import { getCachedData, invalidateCache, setCachedData } from "@/lib/cache";
import { asDate, formatBangladeshDateTime } from "@/lib/datetime";
import PaginationControls from "@/components/pagination-controls";
import { useAuth } from "@/providers/auth-provider";
import {
  collectPickupRequest,
  getMyPickupRequests,
  withdrawPickupRequest,
} from "@/services/donations";
import type { PickupRequest } from "@/types/donation";
import type { PaginatedResponse } from "@/types/pagination";

const PAGE_SIZE = 20;

const PickupRequestCard = React.memo(function PickupRequestCard({
  request,
  busy,
  onWithdraw,
  onCollect,
}: {
  request: PickupRequest;
  busy: boolean;
  onWithdraw: () => void;
  onCollect: () => void;
}) {
  const canWithdraw = request.status === "PENDING";
  const canCollect = request.status === "ACCEPTED";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.requestTitle}>Surplus Pickup Request</Text>
        <View style={styles.requestBadge}>
          <Text style={styles.requestBadgeText}>{request.status}</Text>
        </View>
      </View>
      <Text style={styles.detail}>Estimated pickup: {formatBangladeshDateTime(request.estimated_pickup_at)}</Text>
      <Text style={styles.muted}>Requested: {formatBangladeshDateTime(request.requested_at)}</Text>
      {request.message ? <Text style={styles.requestMessage}>{request.message}</Text> : null}
      {canWithdraw || canCollect ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={canWithdraw ? onWithdraw : onCollect}
          style={({ pressed }) => [
            canWithdraw ? styles.withdrawButton : styles.collectButton,
            (pressed || busy) && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={canWithdraw ? "#455A64" : "#FFFFFF"} />
          ) : (
            <Text style={canWithdraw ? styles.withdrawText : styles.collectText}>
              {canWithdraw ? "Withdraw request" : "Mark as collected"}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
});

export default function NGOPickupsScreen() {
  const { user } = useAuth();
  const isApproved =
    user?.status === "active" ||
    (!user?.status && user?.approval_status === "APPROVED");
  const isNgo = user?.role === "NGO" && isApproved;
  const [page, setPage] = useState<PaginatedResponse<PickupRequest> | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!isNgo) {
        setLoading(false);
        return () => {
          active = false;
        };
      }

      async function loadRequests() {
        const cacheKey = `ngo_pickups_${offset}`;
        const cached = getCachedData<PaginatedResponse<PickupRequest>>(cacheKey);
        if (cached) {
          setPage(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }
        setError(null);

        try {
          const result = await getMyPickupRequests({ limit: PAGE_SIZE, offset });
          if (!active) return;
          const maxSafeOffset = Math.max(
            0,
            Math.floor((result.total - 1) / PAGE_SIZE) * PAGE_SIZE,
          );
          if (offset > maxSafeOffset && result.total > 0) {
            setOffset(maxSafeOffset);
            return;
          }
          const sortedItems = [...result.items].sort((a, b) => {
            const timeA = asDate(a.requested_at)?.getTime() ?? 0;
            const timeB = asDate(b.requested_at)?.getTime() ?? 0;
            return timeB - timeA;
          });
          const newPage = { ...result, items: sortedItems };
          setPage(newPage);
          setCachedData(cacheKey, newPage, 45_000);
        } catch (requestError) {
          if (active) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Could not load your pickup requests.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadRequests();
      return () => {
        active = false;
      };
    }, [isNgo, offset, refreshKey]),
  );

  function confirmWithdraw(request: PickupRequest) {
    Alert.alert(
      "Withdraw this request?",
      "The restaurant will no longer consider your organization for this donation.",
      [
        { text: "Keep request", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: () => void runRequestAction(request.id, () => withdrawPickupRequest(request.id)),
        },
      ],
    );
  }

  function confirmCollected(request: PickupRequest) {
    Alert.alert(
      "Mark as collected?",
      "Use this only after your organization has collected the food.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Mark collected",
          onPress: () => void runRequestAction(request.id, () => collectPickupRequest(request.id)),
        },
      ],
    );
  }

  async function runRequestAction(
    requestId: number,
    action: () => Promise<PickupRequest>,
  ) {
    if (busyRequestId !== null) return;

    setBusyRequestId(requestId);
    try {
      await action();
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      Alert.alert(
        "Could not update pickup request",
        requestError instanceof Error ? requestError.message : "Please try again.",
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  if (!isNgo) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.accessBox}>
          <Text style={styles.accessTitle}>NGO access required</Text>
          <Text style={styles.accessText}>Only approved NGO accounts can manage pickup requests.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const requests = page?.items ?? [];
  const total = page?.total ?? 0;
  const canGoBack = offset > 0 && !loading;
  const canGoForward = offset + requests.length < total && !loading;

  const handleRefresh = useCallback(() => {
    invalidateCache("ngo_pickups_");
    invalidateCache("feed_");
    setRefreshKey((value) => value + 1);
  }, []);

  const renderPickupItem = useCallback(
    ({ item }: { item: PickupRequest }) => (
      <PickupRequestCard
        request={item}
        busy={busyRequestId === item.id}
        onWithdraw={() => confirmWithdraw(item)}
        onCollect={() => confirmCollected(item)}
      />
    ),
    [busyRequestId],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerStack}>
        <BrandHeader />

        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>NGO Workspace</Text>
          </View>
          <Text style={styles.headerTitle}>Your pickup requests</Text>
          <Text style={styles.headerText}>
            Browse food from Home, then track every request and collection here.
          </Text>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionLabel}>MY PICKUP REQUESTS</Text>
            <Text style={styles.sectionTitle}>{total === 1 ? "1 request" : `${total} requests`}</Text>
          </View>
          <Pressable onPress={handleRefresh} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#176B43" />
            <Text style={styles.stateText}>Loading requests…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={handleRefresh}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [error, handleRefresh, loading, total],
  );

  const listEmpty = useMemo(() => {
    if (loading || error) return null;
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>No pickup requests yet</Text>
        <Text style={styles.emptyText}>Open Home, search by area, and request an available donation.</Text>
      </View>
    );
  }, [error, loading]);

  const listFooter = useMemo(
    () => (
      <PaginationControls
        offset={offset}
        limit={PAGE_SIZE}
        total={total}
        loading={loading}
        onPageChange={setOffset}
      />
    ),
    [loading, offset, total],
  );

  return (
    <SafeAreaView style={styles.screen} edges={Platform.OS === "android" ? ["top", "left", "right"] : []}>
      <FlatList
        data={!loading && !error ? requests : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPickupItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={<RefreshControl refreshing={loading && requests.length > 0} onRefresh={handleRefresh} tintColor="#176B43" />}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F3" },
  container: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 36 },
  headerStack: { gap: 18, marginBottom: 18 },
  itemSeparator: { height: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  brand: { color: "#183B2A", fontSize: 21, fontWeight: "800" },
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
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 15, marginTop: 4 },
  sectionLabel: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  sectionTitle: { marginTop: 4, color: "#173526", fontSize: 23, fontWeight: "800" },
  refreshButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#E4F2E8", borderWidth: 1, borderColor: "#C6E4D1" },
  refreshText: { color: "#16673E", fontSize: 13, fontWeight: "800" },
  stateBox: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 22, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  stateText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 10, borderRadius: 20, padding: 18, backgroundColor: "#F2F5F3", borderWidth: 1, borderColor: "#D5E0D8" },
  errorText: { color: "#27362D", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#16673E", fontSize: 14, fontWeight: "800" },
  emptyBox: { alignItems: "center", borderRadius: 22, paddingHorizontal: 32, paddingVertical: 40, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  emptyTitle: { color: "#173526", fontSize: 19, fontWeight: "800" },
  emptyText: { marginTop: 8, color: "#66786D", fontSize: 14, lineHeight: 22, textAlign: "center" },
  card: { gap: 12, borderRadius: 22, padding: 18, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  requestTitle: { color: "#173526", fontSize: 18, fontWeight: "800" },
  requestBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#E6F1E9", borderWidth: 1, borderColor: "#D1E3D7" },
  requestBadgeText: { color: "#16673E", fontSize: 11, fontWeight: "800" },
  detail: { color: "#496957", fontSize: 14, lineHeight: 20 },
  muted: { color: "#87968C", fontSize: 12 },
  requestMessage: { color: "#496957", fontSize: 14, lineHeight: 20 },
  withdrawButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 4, borderRadius: 14, backgroundColor: "#F4F7F4", borderWidth: 1.2, borderColor: "#D2E0D6" },
  withdrawText: { color: "#475569", fontSize: 14, fontWeight: "700" },
  collectButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 4, borderRadius: 14, backgroundColor: "#16673E", borderWidth: 1, borderColor: "#1E8250", shadowColor: "#0D3B22", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  collectText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  accessBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  accessTitle: { color: "#173526", fontSize: 22, fontWeight: "800" },
  accessText: { marginTop: 8, color: "#66786D", fontSize: 15, textAlign: "center" },
});
