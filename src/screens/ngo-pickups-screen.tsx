import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatBangladeshDateTime } from "@/lib/datetime";
import { useAuth } from "@/providers/auth-provider";
import {
  collectPickupRequest,
  getMyPickupRequests,
  withdrawPickupRequest,
} from "@/services/donations";
import type { PickupRequest } from "@/types/donation";
import type { PaginatedResponse } from "@/types/pagination";

const PAGE_SIZE = 20;

function PickupRequestCard({
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
        <Text style={styles.requestTitle}>Donation ID {request.donation_id}</Text>
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
            <ActivityIndicator color={canWithdraw ? "#A43C31" : "#FFFFFF"} />
          ) : (
            <Text style={canWithdraw ? styles.withdrawText : styles.collectText}>
              {canWithdraw ? "Withdraw request" : "Mark as collected"}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export default function NGOPickupsScreen() {
  const { user } = useAuth();
  const isNgo = user?.role === "NGO" && user.approval_status === "APPROVED";
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
        setLoading(true);
        setError(null);

        try {
          const result = await getMyPickupRequests({ limit: PAGE_SIZE, offset });
          if (active) setPage(result);
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

  return (
    <SafeAreaView style={styles.screen} edges={Platform.OS === "android" ? ["top", "left", "right"] : []}>
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>F</Text></View>
          <Text style={styles.brand}>FoodShare</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>NGO WORKSPACE</Text>
          <Text style={styles.heroTitle}>Your pickup requests.</Text>
          <Text style={styles.heroText}>Browse food from Home, then track every request and collection here.</Text>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionLabel}>MY PICKUP REQUESTS</Text>
            <Text style={styles.sectionTitle}>{total === 1 ? "1 request" : `${total} requests`}</Text>
          </View>
          <Pressable onPress={() => setRefreshKey((value) => value + 1)} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? <View style={styles.stateBox}><ActivityIndicator color="#176B43" /><Text style={styles.stateText}>Loading requests…</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => setRefreshKey((value) => value + 1)}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!loading && !error && requests.length === 0 ? <View style={styles.emptyBox}><Text style={styles.emptyTitle}>No pickup requests yet</Text><Text style={styles.emptyText}>Open Home, search by area, and request an available donation.</Text></View> : null}
        {!loading && !error ? requests.map((request) => <PickupRequestCard key={request.id} request={request} busy={busyRequestId === request.id} onWithdraw={() => confirmWithdraw(request)} onCollect={() => confirmCollected(request)} />) : null}

        {total > PAGE_SIZE ? (
          <View style={styles.paginationRow}>
            <Pressable disabled={!canGoBack} onPress={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} style={[styles.pageButton, !canGoBack && styles.disabled]}><Text style={styles.pageText}>Previous</Text></Pressable>
            <Pressable disabled={!canGoForward} onPress={() => setOffset((value) => value + PAGE_SIZE)} style={[styles.pageButton, !canGoForward && styles.disabled]}><Text style={styles.pageText}>Next</Text></Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F3" },
  container: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 36, gap: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#176B43" },
  logoText: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  brand: { color: "#183B2A", fontSize: 21, fontWeight: "800" },
  hero: { gap: 10, borderRadius: 26, padding: 24, backgroundColor: "#174B36", shadowColor: "#0A2E1C", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroLabel: { color: "#B9DFC7", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 29, fontWeight: "800", letterSpacing: -0.8 },
  heroText: { color: "#C5E5D0", fontSize: 15, lineHeight: 23 },
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 15, marginTop: 4 },
  sectionLabel: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  sectionTitle: { marginTop: 4, color: "#173526", fontSize: 23, fontWeight: "800" },
  refreshButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#E1F0E5" },
  refreshText: { color: "#176B43", fontSize: 13, fontWeight: "800" },
  stateBox: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 24, backgroundColor: "#FFFFFF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  stateText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 10, borderRadius: 20, padding: 18, backgroundColor: "#FFF0EE" },
  errorText: { color: "#8A342A", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#9B2C22", fontSize: 14, fontWeight: "800" },
  emptyBox: { alignItems: "center", borderRadius: 24, paddingHorizontal: 32, paddingVertical: 40, backgroundColor: "#FFFFFF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  emptyTitle: { color: "#173526", fontSize: 19, fontWeight: "800" },
  emptyText: { marginTop: 8, color: "#66786D", fontSize: 14, lineHeight: 22, textAlign: "center" },
  card: { gap: 10, borderRadius: 22, padding: 18, backgroundColor: "#FFFFFF", shadowColor: "#173526", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  requestTitle: { color: "#173526", fontSize: 18, fontWeight: "800" },
  requestBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "#E6F1E9" },
  requestBadgeText: { color: "#176B43", fontSize: 11, fontWeight: "800" },
  detail: { color: "#496957", fontSize: 14, lineHeight: 20 },
  muted: { color: "#87968C", fontSize: 12 },
  requestMessage: { color: "#496957", fontSize: 14, lineHeight: 20 },
  withdrawButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 4, borderRadius: 13, backgroundColor: "#FFF0EE" },
  withdrawText: { color: "#A43C31", fontSize: 14, fontWeight: "800" },
  collectButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 4, borderRadius: 13, backgroundColor: "#176B43", shadowColor: "#0D3B22", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  collectText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  paginationRow: { flexDirection: "row", gap: 12 },
  pageButton: { flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 14, backgroundColor: "#E1F0E5" },
  pageText: { color: "#176B43", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  accessBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  accessTitle: { color: "#173526", fontSize: 22, fontWeight: "800" },
  accessText: { marginTop: 8, color: "#66786D", fontSize: 15, textAlign: "center" },
});
