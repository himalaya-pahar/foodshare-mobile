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

import { ApiError } from "@/lib/api";
import {
  formatBangladeshDateTime,
  formatBangladeshTimelineTime,
} from "@/lib/datetime";
import { useAuth } from "@/providers/auth-provider";
import { getRestaurantDonations } from "@/services/donations";
import {
  getDonationFlows,
  getMyDonationHistory,
  getMyPickupHistory,
  getPickupFlows,
} from "@/services/status-history";
import type { DonationFeedItem } from "@/types/donation";
import type { PaginatedResponse } from "@/types/pagination";
import type {
  HistoryFlow,
  JourneyStatus,
  StatusHistoryItem,
  WorkflowStatus,
} from "@/types/status-history";

const PAGE_SIZE = 20;
type HistoryMode = "donations" | "pickups";

const DONATION_STEPS: WorkflowStatus[] = [
  "AVAILABLE",
  "RESERVED",
  "COLLECTED",
  "COMPLETED",
];
const PICKUP_STEPS: WorkflowStatus[] = [
  "PENDING",
  "ACCEPTED",
  "COLLECTED",
  "COMPLETED",
];

function statusLabel(status: JourneyStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function organizationLabel(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function isJourneyStatus(value: string | null): value is JourneyStatus {
  return value !== null && [
    "PENDING", "ACCEPTED", "AVAILABLE", "RESERVED", "COLLECTED", "COMPLETED",
    "CANCELLED", "EXPIRED", "REJECTED", "WITHDRAWN",
  ].includes(value);
}

function isTimelineStep(
  value: JourneyStatus,
  steps: WorkflowStatus[],
): value is WorkflowStatus {
  return steps.some((step) => step === value);
}

function statusTimestamps(
  history: StatusHistoryItem[],
  steps: WorkflowStatus[],
): Partial<Record<JourneyStatus, string>> {
  return history.reduce<Partial<Record<JourneyStatus, string>>>((timestamps, item) => {
    if (
      isJourneyStatus(item.new_status) &&
      isTimelineStep(item.new_status, steps) &&
      !timestamps[item.new_status]
    ) {
      timestamps[item.new_status] = item.created_at;
    }
    return timestamps;
  }, {});
}

function latestStatus(
  history: StatusHistoryItem[],
  steps: WorkflowStatus[],
): JourneyStatus | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const nextStatus = history[index].new_status;
    if (isJourneyStatus(nextStatus)) return nextStatus;
  }
  return null;
}

function legacyDonationFlows(
  history: StatusHistoryItem[],
  donations: DonationFeedItem[],
  donorOrganizationName: string,
): HistoryFlow[] {
  const donationsById = new Map(donations.map((donation) => [donation.id, donation]));
  const grouped = new Map<number, StatusHistoryItem[]>();

  for (const item of history) {
    grouped.set(item.donation_id, [...(grouped.get(item.donation_id) ?? []), item]);
  }

  return [...grouped.entries()].map(([donationId, items]) => {
    const donation = donationsById.get(donationId);
    const donationStatus = donation?.status ?? null;
    const timestamps = statusTimestamps(items, DONATION_STEPS);
    if (!timestamps.AVAILABLE && donation?.created_at) timestamps.AVAILABLE = donation.created_at;

    const currentStatus = latestStatus(items, DONATION_STEPS);
    return {
      donation_id: donationId,
      pickup_request_id: null,
      food_name: donation?.food_name ?? `Donation ID ${donationId}`,
      posted_at: donation?.created_at ?? items[0]?.created_at ?? null,
      donor_organization_name: donorOrganizationName,
      receiver_organization_name: null,
      current_status:
        currentStatus ??
        (isJourneyStatus(donationStatus) ? donationStatus : null),
      status_timestamps: timestamps,
    };
  });
}

function legacyPickupFlows(
  history: StatusHistoryItem[],
  receiverOrganizationName: string,
): HistoryFlow[] {
  const grouped = new Map<number, StatusHistoryItem[]>();

  for (const item of history) {
    const requestId = item.pickup_request_id ?? item.donation_id;
    grouped.set(requestId, [...(grouped.get(requestId) ?? []), item]);
  }

  return [...grouped.entries()].map(([requestId, items]) => {
    const timestamps = statusTimestamps(items, PICKUP_STEPS);
    if (!timestamps.PENDING && items[0]?.created_at) timestamps.PENDING = items[0].created_at;

    return {
      donation_id: items[0]?.donation_id ?? 0,
      pickup_request_id: requestId,
      food_name: null,
      posted_at: items[0]?.created_at ?? null,
      donor_organization_name: null,
      receiver_organization_name: receiverOrganizationName,
      current_status: latestStatus(items, PICKUP_STEPS) ?? "PENDING",
      status_timestamps: timestamps,
    };
  });
}

function FlowCard({
  flow,
  mode,
  showOrganizationIds,
}: {
  flow: HistoryFlow;
  mode: HistoryMode;
  showOrganizationIds: boolean;
}) {
  const steps = mode === "donations" ? DONATION_STEPS : PICKUP_STEPS;
  const currentStep = flow.current_status && isTimelineStep(flow.current_status, steps)
    ? flow.current_status
    : null;
  const currentIndex = currentStep
    ? steps.indexOf(currentStep)
    : -1;
  const isTerminalOutcome = flow.current_status === "CANCELLED" ||
    flow.current_status === "EXPIRED" ||
    flow.current_status === "REJECTED" ||
    flow.current_status === "WITHDRAWN";
  const hasReceived = flow.current_status === "COLLECTED" || flow.current_status === "COMPLETED";
  const receiverLabel = mode === "donations"
    ? hasReceived
      ? "RECEIVED BY"
      : flow.current_status === "RESERVED"
        ? "PICKUP ASSIGNED TO"
        : "RECEIVER"
    : hasReceived
      ? "RECEIVED BY"
      : flow.current_status === "ACCEPTED"
        ? "PICKUP ASSIGNED TO"
        : "REQUESTED BY";
  const receiverFallback = isTerminalOutcome
    ? "No collection completed"
    : hasReceived
      ? "Receiver organization unavailable"
      : "Awaiting collection";

  return (
    <View style={styles.flowCard}>
      <View style={styles.flowHeader}>
        <View style={styles.flowHeaderCopy}>
          <Text style={styles.foodName} numberOfLines={2}>
            {flow.food_name?.trim() || `Donation ID ${flow.donation_id}`}
          </Text>
          {flow.posted_at ? (
            <Text style={styles.postedAt}>Posted {formatBangladeshDateTime(flow.posted_at)}</Text>
          ) : null}
        </View>
        {flow.current_status ? (
          <View style={[styles.statusBadge, isTerminalOutcome && styles.statusBadgeTerminal]}>
            <Text style={[styles.statusBadgeText, isTerminalOutcome && styles.statusBadgeTextTerminal]}>
              {statusLabel(flow.current_status)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.organizationBox}>
        <View style={styles.organizationColumn}>
          <Text style={styles.organizationLabel}>DONATED BY</Text>
          <Text style={styles.organizationName} numberOfLines={2}>
            {organizationLabel(
              flow.donor_organization_name,
              flow.donor_user_id
                ? `Organization account ID ${flow.donor_user_id}`
                : "Donor organization unavailable",
            )}
          </Text>
          {showOrganizationIds && flow.donor_user_id ? (
            <Text style={styles.organizationId}>Account ID {flow.donor_user_id}</Text>
          ) : null}
        </View>
        <View style={styles.organizationDivider} />
        <View style={styles.organizationColumn}>
          <Text style={styles.organizationLabel}>{receiverLabel}</Text>
          <Text style={styles.organizationName} numberOfLines={2}>
            {organizationLabel(
              flow.receiver_organization_name,
              flow.receiver_user_id
                ? `Organization account ID ${flow.receiver_user_id}`
                : receiverFallback,
            )}
          </Text>
          {showOrganizationIds && flow.receiver_user_id ? (
            <Text style={styles.organizationId}>Account ID {flow.receiver_user_id}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.timeline}>
        {steps.map((step, index) => {
          const reached = currentIndex >= index || Boolean(flow.status_timestamps[step]);
          const isCurrent = flow.current_status === step;
          const timestamp = flow.status_timestamps[step];

          return (
            <View key={step} style={styles.timelineStep}>
              <View style={styles.timelineVisual}>
                <View style={[styles.dot, reached && styles.dotReached, isCurrent && styles.dotCurrent]}>
                  {reached ? <Text style={styles.check}>✓</Text> : null}
                </View>
                {index < steps.length - 1 ? (
                  <View style={[styles.line, currentIndex > index && styles.lineReached]} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, reached && styles.stepLabelReached]}>
                {statusLabel(step)}
              </Text>
              {timestamp ? (
                <Text numberOfLines={2} style={styles.stepTime}>
                  {formatBangladeshTimelineTime(timestamp)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function StatusHistoryScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const defaultMode: HistoryMode = user?.role === "NGO" ? "pickups" : "donations";
  const [mode, setMode] = useState<HistoryMode>(defaultMode);
  const [page, setPage] = useState<PaginatedResponse<HistoryFlow> | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadHistory() {
        setLoading(true);
        setError(null);

        try {
          const nextPage = mode === "donations"
            ? await getDonationFlows({ limit: PAGE_SIZE, offset })
            : await getPickupFlows({ limit: PAGE_SIZE, offset });
          if (active) setPage(nextPage);
        } catch (requestError) {
          // The deployed API has legacy event logs. Use them until the two flow
          // endpoints described below are added, then automatically use the richer data.
          if (!(requestError instanceof ApiError) || requestError.status !== 404) {
            if (active) setError(requestError instanceof Error ? requestError.message : "Could not load history.");
            return;
          }

          try {
            let flows: HistoryFlow[];
            if (mode === "donations") {
              const [history, donations] = await Promise.all([
                getMyDonationHistory(),
                getRestaurantDonations({ limit: 100, offset: 0 }),
              ]);
              flows = legacyDonationFlows(
                history,
                donations.items,
                organizationLabel(user?.organization_name, user?.full_name ?? "Your organization"),
              );
            } else {
              const history = await getMyPickupHistory({ limit: 100, offset: 0 });
              flows = legacyPickupFlows(
                history.items,
                organizationLabel(user?.organization_name, user?.full_name ?? "Your organization"),
              );
            }

            flows.sort((first, second) => {
              const firstTime = first.posted_at ? new Date(first.posted_at).getTime() : 0;
              const secondTime = second.posted_at ? new Date(second.posted_at).getTime() : 0;
              return secondTime - firstTime;
            });

            if (active) {
              setPage({
                items: flows.slice(offset, offset + PAGE_SIZE),
                total: flows.length,
                limit: PAGE_SIZE,
                offset,
              });
            }
          } catch (legacyError) {
            if (active) setError(legacyError instanceof Error ? legacyError.message : "Could not load history.");
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadHistory();
      return () => { active = false; };
    }, [mode, offset, refreshKey, user]),
  );

  function switchMode(nextMode: HistoryMode) {
    if (mode === nextMode) return;
    setMode(nextMode);
    setOffset(0);
    setPage(null);
  }

  const flows = page?.items ?? [];
  const total = page?.total ?? 0;
  const canGoBack = offset > 0 && !loading;
  const canGoForward = offset + flows.length < total && !loading;

  return (
    <SafeAreaView style={styles.screen} edges={Platform.OS === "android" ? ["top", "left", "right"] : []}>
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>F</Text></View>
          <Text style={styles.brand}>FoodShare</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>ACTIVITY HISTORY</Text>
          <Text style={styles.heroTitle}>From food to community.</Text>
          <Text style={styles.heroText}>Each card follows one handover journey and the organizations involved.</Text>
        </View>

        {isAdmin ? (
          <View style={styles.segmentedControl}>
            <Pressable onPress={() => switchMode("donations")} style={[styles.segment, mode === "donations" && styles.segmentActive]}>
              <Text style={[styles.segmentText, mode === "donations" && styles.segmentTextActive]}>Donations</Text>
            </Pressable>
            <Pressable onPress={() => switchMode("pickups")} style={[styles.segment, mode === "pickups" && styles.segmentActive]}>
              <Text style={[styles.segmentText, mode === "pickups" && styles.segmentTextActive]}>Pickups</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionLabel}>{mode === "donations" ? "DONATION HISTORY" : "PICKUP HISTORY"}</Text>
            <Text style={styles.sectionTitle}>{mode === "donations" ? "Donation journeys" : "Pickup journeys"}</Text>
          </View>
          <Pressable onPress={() => setRefreshKey((value) => value + 1)} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? <View style={styles.stateBox}><ActivityIndicator color="#176B43" /><Text style={styles.stateText}>Loading history…</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => setRefreshKey((value) => value + 1)}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!loading && !error && flows.length === 0 ? <View style={styles.emptyBox}><Text style={styles.emptyTitle}>No history yet</Text><Text style={styles.emptyText}>Food journeys will appear here as donations and pickups progress.</Text></View> : null}
        {!loading && !error ? flows.map((flow) => <FlowCard key={`${flow.donation_id}-${flow.pickup_request_id ?? "donation"}`} flow={flow} mode={mode} showOrganizationIds={isAdmin} />) : null}

        {total > PAGE_SIZE ? (
          <View style={styles.paginationRow}>
            <Pressable disabled={!canGoBack} onPress={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))} style={[styles.pageButton, !canGoBack && styles.disabled]}><Text style={styles.pageText}>Previous</Text></Pressable>
            <Text style={styles.pageNumber}>{Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}</Text>
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
  brand: { color: "#183B2A", fontSize: 21, fontWeight: "800", letterSpacing: -0.4 },
  hero: { gap: 10, borderRadius: 26, padding: 24, backgroundColor: "#174B36", shadowColor: "#0A2E1C", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroLabel: { color: "#B9DFC7", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  heroText: { color: "#C5E5D0", fontSize: 15, lineHeight: 23 },
  segmentedControl: { flexDirection: "row", padding: 5, borderRadius: 16, backgroundColor: "#E1EDE4" },
  segment: { flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12 },
  segmentActive: { backgroundColor: "#FFFFFF", shadowColor: "#173526", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  segmentText: { color: "#607567", fontSize: 14, fontWeight: "800" },
  segmentTextActive: { color: "#176B43" },
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  sectionLabel: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  sectionTitle: { marginTop: 4, color: "#173526", fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  refreshButton: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#E1F0E5" },
  refreshText: { color: "#176B43", fontSize: 14, fontWeight: "800" },
  stateBox: { minHeight: 165, alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 24, backgroundColor: "#FFFFFF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  stateText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 10, borderRadius: 20, padding: 18, backgroundColor: "#FFF0EE" },
  errorText: { color: "#8A342A", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#9B2C22", fontSize: 14, fontWeight: "800" },
  emptyBox: { alignItems: "center", borderRadius: 24, paddingHorizontal: 32, paddingVertical: 40, backgroundColor: "#FFFFFF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  emptyTitle: { color: "#173526", fontSize: 19, fontWeight: "800" },
  emptyText: { marginTop: 8, color: "#66786D", fontSize: 14, lineHeight: 22, textAlign: "center" },
  flowCard: { gap: 18, borderRadius: 24, padding: 20, backgroundColor: "#FFFFFF", shadowColor: "#173526", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  flowHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  flowHeaderCopy: { flex: 1, gap: 6 },
  foodName: { color: "#173526", fontSize: 20, fontWeight: "800", lineHeight: 26, letterSpacing: -0.3 },
  postedAt: { color: "#6E8275", fontSize: 13, lineHeight: 19 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#E2F4E8" },
  statusBadgeText: { color: "#176B43", fontSize: 12, fontWeight: "800" },
  statusBadgeTerminal: { backgroundColor: "#FFF0EE" },
  statusBadgeTextTerminal: { color: "#A43C31" },
  organizationBox: { flexDirection: "row", borderRadius: 16, padding: 14, backgroundColor: "#F1F6F2" },
  organizationColumn: { flex: 1, gap: 5 },
  organizationDivider: { width: 1, marginHorizontal: 12, backgroundColor: "#D8E6DB" },
  organizationLabel: { color: "#6E8275", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  organizationName: { color: "#284937", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  organizationId: { color: "#6E8275", fontSize: 11, fontWeight: "700" },
  timeline: { flexDirection: "row", alignItems: "flex-start" },
  timelineStep: { flex: 1, alignItems: "center", minWidth: 0 },
  timelineVisual: { width: "100%", flexDirection: "row", alignItems: "center" },
  dot: { zIndex: 1, width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#CBD9CE", borderRadius: 12, backgroundColor: "#FFFFFF" },
  dotReached: { borderColor: "#176B43", backgroundColor: "#176B43" },
  dotCurrent: { backgroundColor: "#2B8455" },
  check: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  line: { height: 2, flex: 1, backgroundColor: "#D9E4DC" },
  lineReached: { backgroundColor: "#3D8D61" },
  stepLabel: { marginTop: 8, color: "#8A9A8E", fontSize: 11, fontWeight: "800", textAlign: "center" },
  stepLabelReached: { color: "#176B43" },
  stepTime: { marginTop: 4, color: "#7A8C80", fontSize: 10, lineHeight: 14, textAlign: "center" },
  paginationRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pageButton: { flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 14, backgroundColor: "#E1F0E5" },
  pageText: { color: "#176B43", fontSize: 15, fontWeight: "800" },
  pageNumber: { minWidth: 68, color: "#607568", fontSize: 13, fontWeight: "700", textAlign: "center" },
  disabled: { opacity: 0.45 },
});
