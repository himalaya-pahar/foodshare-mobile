import DateTimePicker from "@expo/ui/community/datetime-picker";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import DonationMediaModal from "@/components/donation-media-modal";
import PaginationControls from "@/components/pagination-controls";
import { getCachedData, invalidateCache, setCachedData } from "@/lib/cache";
import { asDate, formatBangladeshDateTime } from "@/lib/datetime";
import { useAuth } from "@/providers/auth-provider";
import { getDonationMedia } from "@/services/donation-media";
import {
  acceptPickupRequest,
  cancelDonation,
  completeDonation,
  createDonation,
  getDonationPickupRequests,
  getRestaurantDonations,
  rejectPickupRequest,
  updateDonation,
} from "@/services/donations";
import type {
  DonationFeedItem,
  DonationInput,
  PickupRequest,
} from "@/types/donation";
import type { DonationMedia } from "@/types/donation-media";
import type { PaginatedResponse } from "@/types/pagination";

const PAGE_SIZE = 20;

type FeedDonation = DonationFeedItem & {
  media: DonationMedia[];
};

function DonationVideoPreview({
  uri,
  foodName,
}: {
  uri: string;
  foodName: string;
}) {
  const player = useVideoPlayer(uri, (createdPlayer) => {
    createdPlayer.muted = true;
  });

  return (
    <VideoView
      accessibilityLabel={`Video of ${foodName}`}
      contentFit="cover"
      nativeControls
      player={player}
      style={styles.heroMediaVideo}
      surfaceType="textureView"
    />
  );
}

type DonationForm = {
  foodName: string;
  description: string;
  quantity: string;
  unit: string;
  preparedAt: Date;
  pickupDeadline: Date;
  pickupArea: string;
  pickupAddress: string;
  storageNotes: string;
  allergenInfo: string;
};

function safeDate(value: string): Date {
  return asDate(value) ?? new Date();
}

function emptyForm(area?: string | null, address?: string | null): DonationForm {
  const preparedAt = new Date();
  const pickupDeadline = new Date(preparedAt.getTime() + 4 * 60 * 60 * 1000);

  return {
    foodName: "",
    description: "",
    quantity: "",
    unit: "portions",
    preparedAt,
    pickupDeadline,
    pickupArea: area?.trim() ?? "",
    pickupAddress: address?.trim() ?? "",
    storageNotes: "",
    allergenInfo: "",
  };
}

function formFromDonation(donation: DonationFeedItem): DonationForm {
  return {
    foodName: donation.food_name,
    description: donation.description ?? "",
    quantity: String(donation.quantity),
    unit: donation.unit,
    preparedAt: safeDate(donation.prepared_at),
    pickupDeadline: safeDate(donation.pickup_deadline),
    pickupArea: donation.pickup_area,
    pickupAddress: donation.pickup_address,
    storageNotes: donation.storage_notes ?? "",
    allergenInfo: donation.allergen_info ?? "",
  };
}

function toPayload(form: DonationForm): DonationInput {
  const foodName = form.foodName.trim();
  const quantity = Number(form.quantity);
  const unit = form.unit.trim();
  const pickupArea = form.pickupArea.trim();
  const pickupAddress = form.pickupAddress.trim();

  if (foodName.length < 2) {
    throw new Error("Food name must contain at least 2 characters.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Enter a quantity greater than zero.");
  }

  if (!unit) {
    throw new Error("Enter the quantity unit, such as portions or kg.");
  }

  if (pickupArea.length < 2) {
    throw new Error("Pickup area must contain at least 2 characters.");
  }

  if (pickupAddress.length < 5) {
    throw new Error("Pickup address must contain at least 5 characters.");
  }

  if (form.pickupDeadline <= form.preparedAt) {
    throw new Error("Pickup deadline must be after the prepared time.");
  }

  return {
    food_name: foodName,
    description: form.description.trim() || null,
    quantity,
    unit,
    prepared_at: form.preparedAt.toISOString(),
    pickup_deadline: form.pickupDeadline.toISOString(),
    pickup_area: pickupArea,
    pickup_address: pickupAddress,
    storage_notes: form.storageNotes.trim() || null,
    allergen_info: form.allergenInfo.trim() || null,
  };
}

function mergeDate(current: Date, next: Date): Date {
  const updated = new Date(current);
  updated.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return updated;
}

function mergeTime(current: Date, next: Date): Date {
  const updated = new Date(current);
  updated.setHours(next.getHours(), next.getMinutes(), 0, 0);
  return updated;
}

function statusLabel(status: DonationFeedItem["status"]): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#87968C"
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
}) {
  const [step, setStep] = useState<"date" | "time" | null>(null);

  return (
    <View style={styles.formField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setStep("date")}
        style={({ pressed }) => [
          styles.dateButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.dateButtonText}>{formatBangladeshDateTime(value)}</Text>
        <Text style={styles.dateButtonIcon}>⌄</Text>
      </Pressable>

      {step ? (
        <DateTimePicker
          value={value}
          mode={step}
          is24Hour
          presentation="dialog"
          onDismiss={() => setStep(null)}
          onValueChange={(_, selectedDate) => {
            if (step === "date") {
              onChange(mergeDate(value, selectedDate));
              setStep("time");
              return;
            }

            onChange(mergeTime(value, selectedDate));
            setStep(null);
          }}
        />
      ) : null}
    </View>
  );
}

function DonationFormModal({
  donation,
  area,
  address,
  onClose,
  onSave,
}: {
  donation: DonationFeedItem | null;
  area?: string | null;
  address?: string | null;
  onClose: () => void;
  onSave: (input: DonationInput) => Promise<void>;
}) {
  const [form, setForm] = useState<DonationForm>(() =>
    donation ? formFromDonation(donation) : emptyForm(area, address),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (saving) return;

    try {
      setError(null);
      setSaving(true);
      await onSave(toPayload(form));
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save this donation.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent statusBarTranslucent>
      <SafeAreaView style={styles.modalScreen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
          style={styles.keyboardContainer}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>
                  {donation ? "EDIT DONATION" : "NEW DONATION"}
                </Text>
                <Text style={styles.modalTitle}>
                  {donation ? "Update food details" : "Share surplus food"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close donation form"
                disabled={saving}
                onPress={onClose}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={[styles.formContent, { paddingBottom: 280 }]}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={true}
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <InputField
                label="Food name *"
                value={form.foodName}
                onChangeText={(foodName) => setForm((current) => ({ ...current, foodName }))}
                placeholder="e.g. Vegetable biryani"
              />
              <InputField
                label="Description"
                value={form.description}
                onChangeText={(description) => setForm((current) => ({ ...current, description }))}
                placeholder="What food is available?"
                multiline
              />

              <View style={styles.twoColumnRow}>
                <View style={styles.halfField}>
                  <InputField
                    label="Quantity *"
                    value={form.quantity}
                    onChangeText={(quantity) => setForm((current) => ({ ...current, quantity }))}
                    placeholder="10"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfField}>
                  <InputField
                    label="Unit *"
                    value={form.unit}
                    onChangeText={(unit) => setForm((current) => ({ ...current, unit }))}
                    placeholder="portions"
                  />
                </View>
              </View>

              <DateTimeField
                label="Prepared at *"
                value={form.preparedAt}
                onChange={(preparedAt) => setForm((current) => ({ ...current, preparedAt }))}
              />
              <DateTimeField
                label="Pickup deadline *"
                value={form.pickupDeadline}
                onChange={(pickupDeadline) => setForm((current) => ({ ...current, pickupDeadline }))}
              />
              <InputField
                label="Pickup area *"
                value={form.pickupArea}
                onChangeText={(pickupArea) => setForm((current) => ({ ...current, pickupArea }))}
                placeholder="e.g. Dhanmondi"
              />
              <InputField
                label="Pickup address *"
                value={form.pickupAddress}
                onChangeText={(pickupAddress) => setForm((current) => ({ ...current, pickupAddress }))}
                placeholder="Street, building, pickup point"
                multiline
              />
              <InputField
                label="Storage notes"
                value={form.storageNotes}
                onChangeText={(storageNotes) => setForm((current) => ({ ...current, storageNotes }))}
                placeholder="e.g. Keep refrigerated"
                multiline
              />
              <InputField
                label="Allergen information"
                value={form.allergenInfo}
                onChangeText={(allergenInfo) => setForm((current) => ({ ...current, allergenInfo }))}
                placeholder="e.g. Contains dairy and nuts"
                multiline
              />

              {error ? <Text style={styles.formError}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.saveButton,
                  (pressed || saving) && styles.buttonPressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {donation ? "Save changes" : "Publish donation"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function PickupRequestsModal({
  donation,
  canDecide,
  onClose,
  onDonationChanged,
}: {
  donation: DonationFeedItem;
  canDecide: boolean;
  onClose: () => void;
  onDonationChanged: () => void;
}) {
  const [page, setPage] = useState<PaginatedResponse<PickupRequest> | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [donation.id]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getDonationPickupRequests(donation.id, {
        limit: PAGE_SIZE,
        offset,
      });
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
      setPage({ ...result, items: sortedItems });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load pickup requests.",
      );
    } finally {
      setLoading(false);
    }
  }, [donation.id, offset]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function confirmDecision(request: PickupRequest, decision: "accept" | "reject") {
    const isAccepting = decision === "accept";

    Alert.alert(
      isAccepting ? "Accept this request?" : "Reject this request?",
      isAccepting
        ? "Accepting reserves this donation for this NGO and rejects other pending requests."
        : "This NGO will be notified that its request was not selected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isAccepting ? "Accept" : "Reject",
          style: isAccepting ? "default" : "destructive",
          onPress: () => {
            void decide(request, decision);
          },
        },
      ],
    );
  }

  async function decide(request: PickupRequest, decision: "accept" | "reject") {
    if (!canDecide || busyRequestId !== null) return;

    setBusyRequestId(request.id);

    try {
      if (decision === "accept") {
        await acceptPickupRequest(request.id);
      } else {
        await rejectPickupRequest(request.id);
      }

      await loadRequests();
      onDonationChanged();
    } catch (requestError) {
      Alert.alert(
        "Could not update pickup request",
        requestError instanceof Error ? requestError.message : "Please try again.",
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  const requests = page?.items ?? [];
  const total = page?.total ?? 0;
  const canGoBack = offset > 0 && !loading;
  const canGoForward = offset + requests.length < total && !loading;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>PICKUP REQUESTS</Text>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {donation.food_name}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close pickup requests"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.requestContent}>
            <Text style={styles.requestSubtitle}>
              {total === 1 ? "1 request received" : `${total} requests received`}
            </Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#176B43" />
                <Text style={styles.loadingText}>Loading requests…</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => void loadRequests()}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {!loading && !error && requests.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No requests yet</Text>
                <Text style={styles.emptyText}>
                  NGOs will appear here when they request this donation.
                </Text>
              </View>
            ) : null}

            {requests.map((request) => {
              const isPending = request.status === "PENDING";
              const isBusy = busyRequestId === request.id;

              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestName}>
                      {request.ngo_organization_name?.trim() ||
                        request.ngo_full_name?.trim() ||
                        "Organization unavailable"}
                    </Text>
                    <Text style={styles.requestStatus}>{request.status}</Text>
                  </View>
                  <Text style={styles.requestTime}>
                    Pickup: {formatBangladeshDateTime(request.estimated_pickup_at)}
                  </Text>
                  {request.message ? (
                    <Text style={styles.requestMessage}>{request.message}</Text>
                  ) : null}
                  {isPending && canDecide ? (
                    <View style={styles.requestActions}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy || busyRequestId !== null}
                        onPress={() => confirmDecision(request, "reject")}
                        style={({ pressed }) => [
                          styles.rejectButton,
                          (pressed || isBusy) && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.rejectText}>Reject</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy || busyRequestId !== null}
                        onPress={() => confirmDecision(request, "accept")}
                        style={({ pressed }) => [
                          styles.acceptButton,
                          (pressed || isBusy) && styles.buttonPressed,
                        ]}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.acceptText}>Accept</Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}

            <PaginationControls
              offset={offset}
              limit={PAGE_SIZE}
              total={total}
              loading={loading}
              onPageChange={setOffset}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const DonationCard = React.memo(function DonationCard({
  donation,
  canManage,
  onEdit,
  onCancel,
  onRequests,
  onMedia,
  onComplete,
}: {
  donation: FeedDonation;
  canManage: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onRequests: () => void;
  onMedia: () => void;
  onComplete: () => void;
}) {
  const isDeadlineExpired =
    (asDate(donation.pickup_deadline)?.getTime() ?? Infinity) <= Date.now() &&
    donation.status !== "COMPLETED" &&
    donation.status !== "CANCELLED";
  const isExpired = donation.status === "EXPIRED" || isDeadlineExpired;
  const editable = canManage && donation.status === "AVAILABLE" && !isExpired;
  const canComplete = canManage && donation.status === "COLLECTED";

  const images = donation.media.filter((item) => item.media_type === "IMAGE");
  const videos = donation.media.filter((item) => item.media_type === "VIDEO");

  return (
    <View style={styles.donationCard}>
      {images.length > 0 || videos.length > 0 ? (
        <ScrollView
          horizontal
          contentContainerStyle={styles.mediaContainer}
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={340}
          decelerationRate="fast"
        >
          {images.map((item) => (
            <Image
              key={item.id}
              accessibilityLabel={`Photo of ${donation.food_name}`}
              source={{ uri: item.media_url }}
              style={styles.heroMediaImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ))}
          {videos.map((item) => (
            <DonationVideoPreview
              key={item.id}
              foodName={donation.food_name}
              uri={item.media_url}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, isExpired ? styles.statusEXPIRED : styles[`status${donation.status}`]]}>
            <Text style={[styles.statusText, isExpired && styles.statusTextEXPIRED]}>
              {isExpired ? "Expired" : statusLabel(donation.status)}
            </Text>
          </View>
          <Text style={styles.donationIdTop}>Donation #{donation.id}</Text>
        </View>

        <View style={styles.donationIdentity}>
          <Text style={styles.foodName}>{donation.food_name}</Text>
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>{donation.quantity} {donation.unit}</Text>
          </View>
        </View>

        <View style={styles.locationGroup}>
          <View style={styles.locationHeaderRow}>
            <Ionicons name="location-sharp" size={14} color="#16673E" />
            <Text style={styles.locationAreaTitle}>{donation.pickup_area}</Text>
          </View>
          <Text style={styles.locationAddressText} numberOfLines={2}>
            {donation.pickup_address}
          </Text>
        </View>

        <View style={styles.detailsPanel}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>POSTED</Text>
              <Text style={styles.metaValue}>
                {formatBangladeshDateTime(donation.created_at)}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>PICKUP DEADLINE</Text>
              <Text
                style={[styles.metaValue, isDeadlineExpired ? styles.metaValueExpired : styles.metaValueDeadline]}
                numberOfLines={1}
              >
                {formatBangladeshDateTime(donation.pickup_deadline)}
                {isDeadlineExpired ? " (Expired)" : ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <Pressable onPress={onRequests} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Requests</Text>
          </Pressable>
          {canManage ? (
            <Pressable onPress={onMedia} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Media</Text>
            </Pressable>
          ) : null}
          {editable ? (
            <Pressable onPress={onEdit} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
          ) : null}
          {editable ? (
            <Pressable onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
          {canComplete ? (
            <Pressable onPress={onComplete} style={styles.completeButton}>
              <Text style={styles.completeText}>Complete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

export default function RestaurantDonationsScreen() {
  const { user } = useAuth();
  const isRestaurant = user?.role === "RESTAURANT";
  const canManage = isRestaurant;
  const canMonitor = isRestaurant;
  const [page, setPage] = useState<PaginatedResponse<FeedDonation> | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [formDonation, setFormDonation] = useState<DonationFeedItem | null | undefined>(undefined);
  const [selectedDonation, setSelectedDonation] = useState<DonationFeedItem | null>(null);
  const [mediaDonation, setMediaDonation] = useState<DonationFeedItem | null>(null);
  const [busyDonationId, setBusyDonationId] = useState<number | null>(null);

  const reload = useCallback(() => {
    invalidateCache("restaurant_donations_");
    invalidateCache("feed_");
    setRevision((current) => current + 1);
  }, []);

  const addMediaToDonations = useCallback(
    async (items: DonationFeedItem[]): Promise<FeedDonation[]> =>
      Promise.all(
        items.map(async (donation) => {
          try {
            const media = await getDonationMedia(donation.id);
            return { ...donation, media };
          } catch {
            return { ...donation, media: [] };
          }
        }),
      ),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!canMonitor) {
        setLoading(false);
        return () => {
          active = false;
        };
      }

      async function loadDonations() {
        const cacheKey = `restaurant_donations_${offset}`;
        const cached = getCachedData<PaginatedResponse<FeedDonation>>(cacheKey);
        if (cached) {
          setPage(cached);
          setLoading(false);
        } else {
          setLoading(true);
        }
        setError(null);
        try {
          const result = await getRestaurantDonations({ limit: PAGE_SIZE, offset });
          if (!active) return;
          const maxSafeOffset = Math.max(
            0,
            Math.floor((result.total - 1) / PAGE_SIZE) * PAGE_SIZE,
          );
          if (offset > maxSafeOffset && result.total > 0) {
            setOffset(maxSafeOffset);
            return;
          }
          const itemsWithMedia = await addMediaToDonations(result.items);
          const sortedItems = [...itemsWithMedia].sort((a, b) => {
            const timeA = asDate(a.created_at)?.getTime() ?? 0;
            const timeB = asDate(b.created_at)?.getTime() ?? 0;
            return timeB - timeA;
          });
          const newPage = { ...result, items: sortedItems };
          if (active) {
            setPage(newPage);
            setCachedData(cacheKey, newPage, 45_000);
          }
        } catch (requestError) {
          if (active) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Could not load your donations.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadDonations();
      return () => {
        active = false;
      };
    }, [canMonitor, offset, revision, addMediaToDonations]),
  );

  async function saveDonation(input: DonationInput) {
    if (formDonation) {
      await updateDonation(formDonation.id, input);
    } else {
      await createDonation(input);
      setOffset(0);
    }
    reload();
  }

  function confirmCancel(donation: DonationFeedItem) {
    Alert.alert(
      "Cancel this donation?",
      "This available donation will no longer be visible to NGOs.",
      [
        { text: "Keep donation", style: "cancel" },
        {
          text: "Cancel donation",
          style: "destructive",
          onPress: () => void runDonationAction(donation.id, () => cancelDonation(donation.id)),
        },
      ],
    );
  }

  function confirmComplete(donation: DonationFeedItem) {
    Alert.alert(
      "Complete this donation?",
      "Mark this donation as successfully completed after collection.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Complete",
          onPress: () => void runDonationAction(donation.id, () => completeDonation(donation.id)),
        },
      ],
    );
  }

  async function runDonationAction(donationId: number, action: () => Promise<unknown>) {
    if (busyDonationId !== null) return;
    setBusyDonationId(donationId);
    try {
      await action();
      reload();
    } catch (requestError) {
      Alert.alert(
        "Could not update donation",
        requestError instanceof Error ? requestError.message : "Please try again.",
      );
    } finally {
      setBusyDonationId(null);
    }
  }

  if (!canMonitor) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.accessBox}>
          <Text style={styles.accessTitle}>Restaurant access required</Text>
          <Text style={styles.accessText}>Only Restaurant accounts can manage food donations.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const donations = page?.items ?? [];
  const total = page?.total ?? 0;
  const canGoBack = offset > 0 && !loading;
  const canGoForward = offset + donations.length < total && !loading;

  const renderDonationItem = useCallback(
    ({ item }: { item: FeedDonation }) => (
      <DonationCard
        donation={item}
        canManage={canManage}
        onEdit={() => setFormDonation(item)}
        onCancel={() => confirmCancel(item)}
        onRequests={() => setSelectedDonation(item)}
        onMedia={() => setMediaDonation(item)}
        onComplete={() => confirmComplete(item)}
      />
    ),
    [canManage],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerStack}>
        <BrandHeader />

        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Restaurant Workspace</Text>
          </View>
          <Text style={styles.headerTitle}>Share food with purpose</Text>
          <Text style={styles.headerText}>
            Post safe surplus food, choose a pickup request, and follow every collection.
          </Text>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionLabel}>YOUR DONATIONS</Text>
            <Text style={styles.sectionTitle}>{total === 1 ? "1 donation" : `${total} donations`}</Text>
          </View>
          {canManage ? (
            <Pressable onPress={() => setFormDonation(null)} style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#176B43" />
            <Text style={styles.loadingText}>Loading donations…</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={reload}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [canManage, error, loading, reload, total],
  );

  const listEmpty = useMemo(() => {
    if (loading || error) return null;
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>Nothing shared yet</Text>
        <Text style={styles.emptyText}>Create your first donation to help food reach the community.</Text>
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
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={!loading && !error ? donations : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderDonationItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={<RefreshControl refreshing={loading && (page?.items?.length ?? 0) > 0} onRefresh={reload} tintColor="#176B43" />}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />

      {formDonation !== undefined && canManage ? <DonationFormModal key={formDonation?.id ?? "new"} donation={formDonation} area={user?.area} address={user?.address} onClose={() => setFormDonation(undefined)} onSave={saveDonation} /> : null}
      {selectedDonation ? <PickupRequestsModal donation={selectedDonation} canDecide={canManage} onClose={() => setSelectedDonation(null)} onDonationChanged={reload} /> : null}
      {mediaDonation ? <DonationMediaModal donationId={mediaDonation.id} donationName={mediaDonation.food_name} onClose={() => setMediaDonation(null)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F3" },
  container: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 36 },
  headerStack: { gap: 18, marginBottom: 18 },
  itemSeparator: { height: 18 },
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
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 },
  sectionLabel: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  sectionTitle: { marginTop: 4, color: "#173526", fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  addButton: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#16673E", borderWidth: 1, borderColor: "#1E8250", shadowColor: "#0D3B22", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  addButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  donationCard: { overflow: "hidden", borderWidth: 1.2, borderColor: "#DCE6DF", borderRadius: 22, backgroundColor: "#FAFDFB", shadowColor: "#0D2E1B", shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  cardContent: { padding: 18, gap: 14 },
  mediaContainer: { backgroundColor: "#E4EEE6" },
  heroMediaImage: { width: 340, height: 220, backgroundColor: "#E4EEE6" },
  heroMediaVideo: { width: 340, height: 220, backgroundColor: "#1C4834" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#E4F2E8", borderWidth: 1, borderColor: "#D1E3D7" },
  statusAVAILABLE: { backgroundColor: "#E2F4E8", borderColor: "#BDE6CE" },
  statusRESERVED: { backgroundColor: "#FFF0D4", borderColor: "#F7D8A7" },
  statusCOLLECTED: { backgroundColor: "#E1EEFF", borderColor: "#C7DCF9" },
  statusCOMPLETED: { backgroundColor: "#DFF1E5", borderColor: "#BFE4CD" },
  statusEXPIRED: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  statusCANCELLED: { backgroundColor: "#FFE8E5", borderColor: "#F9C3BC" },
  statusText: { color: "#24593B", fontSize: 12, fontWeight: "800" },
  statusTextEXPIRED: { color: "#B91C1C" },
  donationIdTop: { color: "#6E8275", fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  areaText: { color: "#66786D", fontSize: 13, fontWeight: "700" },
  foodName: { color: "#173526", fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  donationIdentity: { gap: 6 },
  quantityBadge: { alignSelf: "flex-start", backgroundColor: "#EAF5EE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: "#CCE4D5" },
  quantityText: { color: "#16673E", fontSize: 14, fontWeight: "800" },
  locationGroup: { backgroundColor: "#F0F7F2", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#D5E5DA", gap: 6 },
  locationHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationAreaTitle: { color: "#16673E", fontSize: 13, fontWeight: "800" },
  locationAddressText: { color: "#3B5344", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  detailsPanel: { borderRadius: 14, padding: 12, backgroundColor: "#F3F7F4" },
  metaRow: { flexDirection: "row", alignItems: "stretch" },
  metaItem: { flex: 1, gap: 4 },
  metaDivider: { width: 1, marginHorizontal: 12, backgroundColor: "#DCE7DE" },
  metaLabel: { color: "#7A8C80", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  metaValue: { color: "#284634", fontSize: 13, fontWeight: "700" },
  metaValueDeadline: { color: "#16673E", fontSize: 13, fontWeight: "700" },
  metaValueExpired: { color: "#B91C1C", fontSize: 13, fontWeight: "700" },
  keyboardContainer: { flex: 1, justifyContent: "flex-end", width: "100%", maxWidth: 640, alignSelf: "center" },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  secondaryButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#EAF3ED", borderWidth: 1, borderColor: "#CCE2D4" },
  secondaryButtonText: { color: "#16673E", fontSize: 13, fontWeight: "800" },
  cancelButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#FDF2F2", borderWidth: 1, borderColor: "#F8B4B4" },
  cancelText: { color: "#9B1C1C", fontSize: 13, fontWeight: "800" },
  completeButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#16673E", borderWidth: 1, borderColor: "#1E8250", shadowColor: "#0D3B22", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  completeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  loadingBox: { minHeight: 160, alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 22, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  loadingText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 10, borderRadius: 20, padding: 18, backgroundColor: "#F2F5F3", borderWidth: 1, borderColor: "#D5E0D8" },
  errorText: { color: "#27362D", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#176B43", fontSize: 14, fontWeight: "800" },
  emptyBox: { alignItems: "center", borderRadius: 22, paddingHorizontal: 32, paddingVertical: 40, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  emptyTitle: { color: "#173526", fontSize: 19, fontWeight: "800" },
  emptyText: { marginTop: 8, color: "#66786D", fontSize: 14, lineHeight: 22, textAlign: "center" },
  paginationRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  pageButton: { flex: 1, alignItems: "center", borderRadius: 14, paddingVertical: 14, backgroundColor: "#E4F2E8" },
  pageButtonText: { color: "#176B43", fontSize: 15, fontWeight: "800" },
  disabledButton: { opacity: 0.45 },
  buttonPressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  accessBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  accessTitle: { color: "#173526", fontSize: 22, fontWeight: "800" },
  accessText: { marginTop: 8, color: "#66786D", fontSize: 15, textAlign: "center" },
  modalScreen: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13, 36, 24, 0.5)" },
  modalCard: { maxHeight: "92%", flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#FAFDFB", overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 22, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: "#E3ECE5" },
  modalEyebrow: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  modalTitle: { marginTop: 4, color: "#173526", fontSize: 22, fontWeight: "800" },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F0EA" },
  closeButtonText: { color: "#31503E", fontSize: 26, fontWeight: "400", lineHeight: 28 },
  formContent: { padding: 22, paddingBottom: 36, gap: 16 },
  formField: { gap: 8 },
  inputLabel: { color: "#3A5244", fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: "#D6E2D9", borderRadius: 14, paddingHorizontal: 16, color: "#1E3829", fontSize: 15, backgroundColor: "#FFFFFF" },
  multilineInput: { minHeight: 90, paddingTop: 14 },
  twoColumnRow: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },
  dateButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: "#D6E2D9", borderRadius: 14, paddingHorizontal: 16, backgroundColor: "#FFFFFF" },
  dateButtonText: { color: "#1E3829", fontSize: 15 },
  dateButtonIcon: { color: "#176B43", fontSize: 18, fontWeight: "800" },
  formError: { borderRadius: 14, padding: 14, color: "#27362D", fontSize: 14, lineHeight: 20, backgroundColor: "#F2F5F3", borderWidth: 1, borderColor: "#D5E0D8" },
  saveButton: { minHeight: 56, alignItems: "center", justifyContent: "center", marginTop: 4, borderRadius: 16, backgroundColor: "#16673E", borderWidth: 1, borderColor: "#1E8250", shadowColor: "#0D3B22", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  saveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  requestContent: { padding: 22, paddingBottom: 36, gap: 14 },
  requestSubtitle: { color: "#66786D", fontSize: 14, marginBottom: 4 },
  requestCard: { gap: 10, borderRadius: 18, padding: 16, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE6DF", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  requestHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  requestName: { color: "#1E3829", fontSize: 17, fontWeight: "800" },
  requestStatus: { color: "#176B43", fontSize: 12, fontWeight: "800" },
  requestTime: { color: "#66786D", fontSize: 13 },
  requestMessage: { color: "#496957", fontSize: 14, lineHeight: 20 },
  requestActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  rejectButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#ECEFF1" },
  rejectText: { color: "#455A64", fontSize: 14, fontWeight: "800" },
  acceptButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#16673E", borderWidth: 1, borderColor: "#1E8250" },
  acceptText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
