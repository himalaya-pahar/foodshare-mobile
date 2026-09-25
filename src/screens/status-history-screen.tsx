import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import BrandHeader from "@/components/brand-header";
import PaginationControls from "@/components/pagination-controls";
import {
  getDonationById,
  getRestaurantDonations,
} from "@/services/donations";
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
      food_name: donation?.food_name ?? "Food Surplus Donation",
      posted_at: donation?.created_at ?? items[0]?.created_at ?? null,
      donor_organization_name: donorOrganizationName,
      receiver_organization_name: null,
      current_status:
        currentStatus ??
        (isJourneyStatus(donationStatus) ? donationStatus : null),
      status_timestamps: timestamps,
      quantity: donation?.quantity ?? null,
      unit: donation?.unit ?? null,
      pickup_address: donation?.pickup_address ?? null,
      pickup_area: donation?.pickup_area ?? null,
      pickup_deadline: donation?.pickup_deadline ?? null,
      prepared_at: donation?.prepared_at ?? null,
      storage_notes: donation?.storage_notes ?? null,
      allergen_info: donation?.allergen_info ?? null,
      description: donation?.description ?? null,
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

function FlowDetailModal({
  flow,
  mode,
  onClose,
}: {
  flow: HistoryFlow;
  mode: HistoryMode;
  onClose: () => void;
}) {
  const [extraDonation, setExtraDonation] = useState<DonationFeedItem | null>(null);

  useEffect(() => {
    let active = true;
    if (flow.donation_id && (!flow.pickup_address || flow.quantity === undefined || flow.quantity === null)) {
      getDonationById(flow.donation_id)
        .then((data) => {
          if (active) setExtraDonation(data);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [flow.donation_id, flow.pickup_address, flow.quantity]);

  const quantity = flow.quantity ?? extraDonation?.quantity ?? null;
  const unit = flow.unit ?? extraDonation?.unit ?? null;
  const pickupAddress = flow.pickup_address ?? extraDonation?.pickup_address ?? null;
  const pickupArea = flow.pickup_area ?? extraDonation?.pickup_area ?? null;
  const pickupDeadline = flow.pickup_deadline ?? extraDonation?.pickup_deadline ?? null;
  const preparedAt = flow.prepared_at ?? extraDonation?.prepared_at ?? null;
  const storageNotes = flow.storage_notes ?? extraDonation?.storage_notes ?? null;
  const allergenInfo = flow.allergen_info ?? extraDonation?.allergen_info ?? null;
  const description = flow.description ?? extraDonation?.description ?? null;
  const foodName = flow.food_name?.trim() || extraDonation?.food_name?.trim() || "Food Surplus Donation";

  const steps = mode === "donations" ? DONATION_STEPS : PICKUP_STEPS;
  const currentStep = flow.current_status && isTimelineStep(flow.current_status, steps)
    ? flow.current_status
    : null;
  const currentIndex = currentStep ? steps.indexOf(currentStep) : -1;
  const isTerminalOutcome =
    flow.current_status === "CANCELLED" ||
    flow.current_status === "EXPIRED" ||
    flow.current_status === "REJECTED" ||
    flow.current_status === "WITHDRAWN";
  const hasReceived =
    flow.current_status === "COLLECTED" || flow.current_status === "COMPLETED";
  const receiverLabel =
    mode === "donations"
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

  function getStepDescription(step: WorkflowStatus): string {
    switch (step) {
      case "AVAILABLE":
        return "Donation published and active on the FoodShare network.";
      case "PENDING":
        return "Pickup request created and awaiting restaurant confirmation.";
      case "RESERVED":
      case "ACCEPTED":
        return "Pickup confirmed and reserved for partner organization.";
      case "COLLECTED":
        return "Food inspected and safely collected from partner kitchen.";
      case "COMPLETED":
        return "Handover successfully completed and community impact recorded.";
      default:
        return "Status milestone in handover lifecycle.";
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>JOURNEY DETAILS</Text>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {foodName}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close details"
              onPress={onClose}
              style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color="#16673E" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalStatusBanner}>
              <View style={styles.modalStatusHeader}>
                <View style={[styles.statusBadge, isTerminalOutcome && styles.statusBadgeTerminal]}>
                  <Text style={[styles.statusBadgeText, isTerminalOutcome && styles.statusBadgeTextTerminal]}>
                    {flow.current_status ? statusLabel(flow.current_status) : "Unknown"}
                  </Text>
                </View>
                {flow.posted_at ? (
                  <Text style={styles.modalPostedAt}>
                    Posted {formatBangladeshDateTime(flow.posted_at)}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Quantity and Portion Details */}
            {(quantity !== null && quantity !== undefined) || pickupDeadline || preparedAt ? (
              <View style={styles.modalMetaCard}>
                {quantity !== null && quantity !== undefined ? (
                  <View style={styles.modalMetaRow}>
                    <View style={styles.modalMetaIconWrap}>
                      <Ionicons name="cube-outline" size={18} color="#16673E" />
                    </View>
                    <View style={styles.modalMetaInfo}>
                      <Text style={styles.modalMetaLabel}>PORTION & QUANTITY</Text>
                      <Text style={styles.modalMetaValue}>
                        {quantity} {unit || "servings"}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {pickupDeadline ? (
                  <>
                    {quantity !== null && quantity !== undefined ? (
                      <View style={styles.modalMetaDivider} />
                    ) : null}
                    <View style={styles.modalMetaRow}>
                      <View style={styles.modalMetaIconWrap}>
                        <Ionicons name="time-outline" size={18} color="#16673E" />
                      </View>
                      <View style={styles.modalMetaInfo}>
                        <Text style={styles.modalMetaLabel}>PICKUP DEADLINE</Text>
                        <Text style={styles.modalMetaValue}>
                          Safe until {formatBangladeshDateTime(pickupDeadline)}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}

                {preparedAt ? (
                  <>
                    <View style={styles.modalMetaDivider} />
                    <View style={styles.modalMetaRow}>
                      <View style={styles.modalMetaIconWrap}>
                        <Ionicons name="restaurant-outline" size={18} color="#16673E" />
                      </View>
                      <View style={styles.modalMetaInfo}>
                        <Text style={styles.modalMetaLabel}>PREPARED TIME</Text>
                        <Text style={styles.modalMetaValue}>
                          {formatBangladeshDateTime(preparedAt)}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {/* Pickup Address & Operating Area */}
            {pickupAddress || pickupArea ? (
              <View style={styles.modalMetaCard}>
                <View style={styles.modalMetaRow}>
                  <View style={styles.modalMetaIconWrap}>
                    <Ionicons name="location-outline" size={18} color="#16673E" />
                  </View>
                  <View style={styles.modalMetaInfo}>
                    <Text style={styles.modalMetaLabel}>PICKUP LOCATION</Text>
                    <Text style={styles.modalMetaValue}>
                      {pickupAddress || "Pickup address available upon reservation"}
                    </Text>
                    {pickupArea ? (
                      <View style={styles.modalAreaTag}>
                        <Text style={styles.modalAreaTagText}>Area: {pickupArea}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}

            {/* Organization Involved */}
            <View style={styles.modalOrgCard}>
              <View style={styles.modalOrgRow}>
                <View style={styles.modalOrgIconWrap}>
                  <Ionicons name="business-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalOrgInfo}>
                  <Text style={styles.modalOrgLabel}>DONATED BY</Text>
                  <Text style={styles.modalOrgName}>
                    {organizationLabel(flow.donor_organization_name, "Verified Donor Partner")}
                  </Text>
                </View>
              </View>

              <View style={styles.modalOrgDivider} />

              <View style={styles.modalOrgRow}>
                <View style={styles.modalOrgIconWrap}>
                  <Ionicons name="people-outline" size={18} color="#16673E" />
                </View>
                <View style={styles.modalOrgInfo}>
                  <Text style={styles.modalOrgLabel}>{receiverLabel}</Text>
                  <Text style={styles.modalOrgName}>
                    {organizationLabel(flow.receiver_organization_name, receiverFallback)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Food Details, Storage & Allergens */}
            {description || storageNotes || allergenInfo ? (
              <View style={styles.modalMetaCard}>
                {description ? (
                  <View style={styles.modalDetailBlock}>
                    <Text style={styles.modalMetaLabel}>FOOD DESCRIPTION</Text>
                    <Text style={styles.modalDetailDesc}>{description}</Text>
                  </View>
                ) : null}

                {storageNotes ? (
                  <View style={[styles.modalDetailBlock, Boolean(description) && styles.modalDetailBlockSpaced]}>
                    <Text style={styles.modalMetaLabel}>STORAGE & HANDLING INSTRUCTIONS</Text>
                    <Text style={styles.modalDetailDesc}>{storageNotes}</Text>
                  </View>
                ) : null}

                {allergenInfo ? (
                  <View style={[styles.modalDetailBlock, Boolean(description || storageNotes) && styles.modalDetailBlockSpaced]}>
                    <Text style={styles.modalMetaLabel}>DIETARY & ALLERGEN ADVICE</Text>
                    <Text style={styles.modalDetailDesc}>{allergenInfo}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Full Lifecycle Audit Timeline */}
            <View style={styles.modalTimelineCard}>
              <Text style={styles.modalSectionTitle}>Lifecycle Timeline</Text>
              <Text style={styles.modalSectionSubtitle}>
                Verified milestones recorded for this food rescue journey.
              </Text>

              <View style={styles.modalTimelineList}>
                {steps.map((step, index) => {
                  const reached = currentIndex >= index || Boolean(flow.status_timestamps[step]);
                  const isCurrent = flow.current_status === step;
                  const timestamp = flow.status_timestamps[step];

                  return (
                    <View key={step} style={styles.modalTimelineItem}>
                      <View style={styles.modalTimelineGutter}>
                        <View
                          style={[
                            styles.modalTimelineDot,
                            reached && styles.modalTimelineDotReached,
                            isCurrent && styles.modalTimelineDotCurrent,
                          ]}
                        >
                          {reached ? (
                            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                          ) : (
                            <View style={styles.modalTimelineDotInner} />
                          )}
                        </View>
                        {index < steps.length - 1 ? (
                          <View
                            style={[
                              styles.modalTimelineLine,
                              currentIndex > index && styles.modalTimelineLineReached,
                            ]}
                          />
                        ) : null}
                      </View>

                      <View style={styles.modalTimelineContent}>
                        <View style={styles.modalTimelineTitleRow}>
                          <Text
                            style={[
                              styles.modalStepTitle,
                              reached && styles.modalStepTitleReached,
                              isCurrent && styles.modalStepTitleCurrent,
                            ]}
                          >
                            {statusLabel(step)}
                          </Text>
                          {timestamp ? (
                            <Text style={styles.modalStepDate}>
                              {formatBangladeshDateTime(timestamp)}
                            </Text>
                          ) : (
                            <Text style={styles.modalStepDatePending}>Pending</Text>
                          )}
                        </View>
                        <Text style={styles.modalStepDesc}>
                          {getStepDescription(step)}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {isTerminalOutcome ? (
                  <View style={styles.modalTimelineItem}>
                    <View style={styles.modalTimelineGutter}>
                      <View style={[styles.modalTimelineDot, styles.modalTimelineDotTerminal]}>
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.modalTimelineContent}>
                      <Text style={[styles.modalStepTitle, styles.modalStepTitleTerminal]}>
                        {statusLabel(flow.current_status as JourneyStatus)}
                      </Text>
                      <Text style={styles.modalStepDesc}>
                        This journey was concluded without completing collection.
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onClose}
              style={({ pressed }) => [styles.modalDoneButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FlowCard({
  flow,
  mode,
  showOrganizationIds,
  onPress,
}: {
  flow: HistoryFlow;
  mode: HistoryMode;
  showOrganizationIds: boolean;
  onPress: () => void;
}) {
  const steps = mode === "donations" ? DONATION_STEPS : PICKUP_STEPS;
  const currentStep = flow.current_status && isTimelineStep(flow.current_status, steps)
    ? flow.current_status
    : null;
  const currentIndex = currentStep ? steps.indexOf(currentStep) : -1;
  const isTerminalOutcome =
    flow.current_status === "CANCELLED" ||
    flow.current_status === "EXPIRED" ||
    flow.current_status === "REJECTED" ||
    flow.current_status === "WITHDRAWN";
  const hasReceived =
    flow.current_status === "COLLECTED" || flow.current_status === "COMPLETED";
  const receiverLabel =
    mode === "donations"
      ? hasReceived
        ? "Received by"
        : flow.current_status === "RESERVED"
          ? "Assigned to"
          : "Receiver"
      : hasReceived
        ? "Received by"
        : flow.current_status === "ACCEPTED"
          ? "Assigned to"
          : "Requested by";
  const receiverFallback = isTerminalOutcome
    ? "No collection"
    : hasReceived
      ? "Partner NGO"
      : "Awaiting pickup";

  const totalSteps = steps.length;
  const completedCount = currentIndex >= 0 ? currentIndex + 1 : 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View journey details for ${flow.food_name || "Food donation"}`}
      onPress={onPress}
      style={({ pressed }) => [styles.flowCard, pressed && styles.pressed]}
    >
      <View style={styles.flowHeader}>
        <View style={styles.flowHeaderCopy}>
          <Text style={styles.foodName} numberOfLines={2}>
            {flow.food_name?.trim() || "Food Surplus Donation"}
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

      {/* Concise Portion & Location Badges */}
      {(flow.quantity !== null && flow.quantity !== undefined) || flow.pickup_area || flow.pickup_address ? (
        <View style={styles.flowItemMetaRow}>
          {flow.quantity !== null && flow.quantity !== undefined ? (
            <View style={styles.flowMetaPill}>
              <Ionicons name="cube-outline" size={13} color="#16673E" />
              <Text style={styles.flowMetaPillText}>
                {flow.quantity} {flow.unit || "servings"}
              </Text>
            </View>
          ) : null}

          {flow.pickup_area || flow.pickup_address ? (
            <View style={[styles.flowMetaPill, { flexShrink: 1 }]}>
              <Ionicons name="location-outline" size={13} color="#16673E" />
              <Text style={styles.flowMetaPillText} numberOfLines={1}>
                {flow.pickup_area || flow.pickup_address}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.organizationBox}>
        <View style={styles.organizationColumn}>
          <Text style={styles.organizationLabel}>DONATED BY</Text>
          <Text style={styles.organizationName} numberOfLines={1}>
            {organizationLabel(flow.donor_organization_name, "Verified Donor Partner")}
          </Text>
        </View>
        <View style={styles.organizationDivider} />
        <View style={styles.organizationColumn}>
          <Text style={styles.organizationLabel}>{receiverLabel.toUpperCase()}</Text>
          <Text style={styles.organizationName} numberOfLines={1}>
            {organizationLabel(flow.receiver_organization_name, receiverFallback)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.progressPill}>
          <View style={[styles.progressDot, isTerminalOutcome && styles.progressDotTerminal]} />
          <Text style={[styles.progressText, isTerminalOutcome && styles.progressTextTerminal]}>
            {isTerminalOutcome
              ? statusLabel(flow.current_status as JourneyStatus)
              : `Step ${completedCount} of ${totalSteps}: ${currentStep ? statusLabel(currentStep) : "Active"}`}
          </Text>
        </View>

        <View style={styles.detailsButton}>
          <Text style={styles.detailsButtonText}>View Details ›</Text>
        </View>
      </View>
    </Pressable>
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
  const [selectedFlow, setSelectedFlow] = useState<HistoryFlow | null>(null);

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
          if (!active) return;
          const maxSafeOffset = Math.max(
            0,
            Math.floor((nextPage.total - 1) / PAGE_SIZE) * PAGE_SIZE,
          );
          if (offset > maxSafeOffset && nextPage.total > 0) {
            setOffset(maxSafeOffset);
            return;
          }
          setPage(nextPage);
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

  return (
    <SafeAreaView style={styles.screen} edges={Platform.OS === "android" ? ["top", "left", "right"] : []}>
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={loading && Boolean(page)}
            onRefresh={() => setRefreshKey((value) => value + 1)}
            tintColor="#16673E"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />

        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Activity History</Text>
          </View>
          <Text style={styles.headerTitle}>From food to community</Text>
          <Text style={styles.headerText}>
            Each card follows one handover journey and the organizations involved.
          </Text>
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
        {!loading && !error
          ? flows.map((flow) => (
              <FlowCard
                key={`${flow.donation_id}-${flow.pickup_request_id ?? "donation"}`}
                flow={flow}
                mode={mode}
                showOrganizationIds={isAdmin}
                onPress={() => setSelectedFlow(flow)}
              />
            ))
          : null}

        <PaginationControls
          offset={offset}
          limit={PAGE_SIZE}
          total={total}
          loading={loading}
          onPageChange={setOffset}
        />
      </ScrollView>

      {selectedFlow ? (
        <FlowDetailModal
          flow={selectedFlow}
          mode={mode}
          onClose={() => setSelectedFlow(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F3" },
  container: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 36, gap: 18 },
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
  segmentedControl: { flexDirection: "row", padding: 5, borderRadius: 16, backgroundColor: "#E1EDE4" },
  segment: { flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12 },
  segmentActive: {
    backgroundColor: "#FAFDFB",
    borderWidth: 1,
    borderColor: "#DCE7E0",
    shadowColor: "#173526",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  segmentText: { color: "#607567", fontSize: 14, fontWeight: "800" },
  segmentTextActive: { color: "#176B43" },
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  sectionLabel: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  sectionTitle: { marginTop: 4, color: "#173526", fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  refreshButton: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#E4F2E8", borderWidth: 1, borderColor: "#C6E4D1" },
  refreshText: { color: "#16673E", fontSize: 14, fontWeight: "800" },
  stateBox: { minHeight: 165, alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 22, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  stateText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 10, borderRadius: 20, padding: 18, backgroundColor: "#F2F5F3", borderWidth: 1, borderColor: "#D5E0D8" },
  errorText: { color: "#27362D", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#16673E", fontSize: 14, fontWeight: "800" },
  emptyBox: { alignItems: "center", borderRadius: 22, paddingHorizontal: 32, paddingVertical: 40, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  emptyTitle: { color: "#173526", fontSize: 19, fontWeight: "800" },
  emptyText: { marginTop: 8, color: "#66786D", fontSize: 14, lineHeight: 22, textAlign: "center" },
  flowCard: { gap: 14, borderRadius: 22, padding: 18, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  flowHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  flowHeaderCopy: { flex: 1, gap: 4 },
  foodName: { color: "#173526", fontSize: 18, fontWeight: "800", lineHeight: 24, letterSpacing: -0.3 },
  postedAt: { color: "#6E8275", fontSize: 12, lineHeight: 18 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#E2F4E8", borderWidth: 1, borderColor: "#BDE6CE" },
  statusBadgeText: { color: "#16673E", fontSize: 11, fontWeight: "800" },
  statusBadgeTerminal: { backgroundColor: "#ECEFF1", borderColor: "#CFD8DC" },
  statusBadgeTextTerminal: { color: "#546E7A" },
  organizationBox: { flexDirection: "row", borderRadius: 14, padding: 12, backgroundColor: "#F2F7F4", borderWidth: 1, borderColor: "#DCE7DF" },
  organizationColumn: { flex: 1, gap: 3 },
  organizationDivider: { width: 1, marginHorizontal: 12, backgroundColor: "#D8E6DB" },
  organizationLabel: { color: "#6E8275", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  organizationName: { color: "#284937", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  organizationId: { color: "#6E8275", fontSize: 11, fontWeight: "700" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  progressPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#EBF5EF",
    borderWidth: 1,
    borderColor: "#C5E4D1",
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16673E",
  },
  progressDotTerminal: {
    backgroundColor: "#78909C",
  },
  progressText: {
    color: "#16673E",
    fontSize: 12,
    fontWeight: "700",
  },
  progressTextTerminal: {
    color: "#546E7A",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#BEDECB",
  },
  detailsButtonText: {
    color: "#16673E",
    fontSize: 12,
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
  modalStatusBanner: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
  },
  modalStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalPostedAt: {
    color: "#6E8275",
    fontSize: 12,
    fontWeight: "600",
  },
  modalOrgCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    gap: 12,
  },
  modalOrgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalOrgIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#BEDECB",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOrgInfo: {
    flex: 1,
    gap: 2,
  },
  modalOrgLabel: {
    color: "#75867C",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modalOrgName: {
    color: "#173526",
    fontSize: 15,
    fontWeight: "800",
  },
  modalOrgDivider: {
    height: 1,
    backgroundColor: "#E6EFE9",
  },
  modalTimelineCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    gap: 12,
  },
  modalSectionTitle: {
    color: "#173526",
    fontSize: 17,
    fontWeight: "800",
  },
  modalSectionSubtitle: {
    color: "#6B7D71",
    fontSize: 13,
    lineHeight: 19,
    marginTop: -8,
  },
  modalTimelineList: {
    gap: 0,
    marginTop: 4,
  },
  modalTimelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    minHeight: 56,
  },
  modalTimelineGutter: {
    alignItems: "center",
    width: 22,
  },
  modalTimelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD9CE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  modalTimelineDotReached: {
    borderColor: "#16673E",
    backgroundColor: "#16673E",
  },
  modalTimelineDotCurrent: {
    borderColor: "#16673E",
    backgroundColor: "#20844F",
  },
  modalTimelineDotTerminal: {
    borderColor: "#78909C",
    backgroundColor: "#78909C",
  },
  modalTimelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD9CE",
  },
  modalTimelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#DCE7DF",
    marginVertical: 2,
  },
  modalTimelineLineReached: {
    backgroundColor: "#20844F",
  },
  modalTimelineContent: {
    flex: 1,
    paddingBottom: 16,
    gap: 3,
  },
  modalTimelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modalStepTitle: {
    color: "#7E9084",
    fontSize: 14,
    fontWeight: "700",
  },
  modalStepTitleReached: {
    color: "#173526",
    fontWeight: "800",
  },
  modalStepTitleCurrent: {
    color: "#16673E",
    fontWeight: "800",
  },
  modalStepTitleTerminal: {
    color: "#546E7A",
    fontWeight: "800",
  },
  modalStepDate: {
    color: "#16673E",
    fontSize: 11,
    fontWeight: "700",
  },
  modalStepDatePending: {
    color: "#9BB0A3",
    fontSize: 11,
    fontWeight: "600",
  },
  modalStepDesc: {
    color: "#556A5D",
    fontSize: 12,
    lineHeight: 18,
  },
  flowItemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  flowMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#EBF5EE",
    borderWidth: 1,
    borderColor: "#CCE5D6",
  },
  flowMetaPillText: {
    color: "#16673E",
    fontSize: 11,
    fontWeight: "700",
  },
  modalMetaCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE7E0",
    gap: 12,
  },
  modalMetaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalMetaIconWrap: {
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
  modalMetaInfo: {
    flex: 1,
    gap: 3,
  },
  modalMetaLabel: {
    color: "#75867C",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  modalMetaValue: {
    color: "#173526",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  modalMetaDivider: {
    height: 1,
    backgroundColor: "#E6EFE9",
  },
  modalAreaTag: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#CBE4D5",
  },
  modalAreaTagText: {
    color: "#16673E",
    fontSize: 11,
    fontWeight: "700",
  },
  modalDetailBlock: {
    gap: 4,
  },
  modalDetailBlockSpaced: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E6EFE9",
  },
  modalDetailDesc: {
    color: "#354A3E",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
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
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
