import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import DonationMediaModal from "@/components/donation-media-modal";
import { useAuth } from "@/providers/auth-provider";
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
import type { PaginatedResponse } from "@/types/pagination";

const PAGE_SIZE = 20;

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
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
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

function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? safeDate(value) : value;

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
        <Text style={styles.dateButtonText}>{formatDateTime(value)}</Text>
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
    <Modal animationType="slide" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.modalScreen}>
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
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
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
      </SafeAreaView>
    </Modal>
  );
}

function PickupRequestsModal({
  donation,
  onClose,
  onDonationChanged,
}: {
  donation: DonationFeedItem;
  onClose: () => void;
  onDonationChanged: () => void;
}) {
  const [page, setPage] = useState<PaginatedResponse<PickupRequest> | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getDonationPickupRequests(donation.id, {
        limit: PAGE_SIZE,
        offset,
      });
      setPage(result);
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
    if (busyRequestId !== null) return;

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
                    <Text style={styles.requestName}>NGO #{request.ngo_id}</Text>
                    <Text style={styles.requestStatus}>{request.status}</Text>
                  </View>
                  <Text style={styles.requestTime}>
                    Pickup: {formatDateTime(request.estimated_pickup_at)}
                  </Text>
                  {request.message ? (
                    <Text style={styles.requestMessage}>{request.message}</Text>
                  ) : null}
                  {isPending ? (
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

            {total > PAGE_SIZE ? (
              <View style={styles.paginationRow}>
                <Pressable
                  disabled={!canGoBack}
                  onPress={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                  style={[styles.pageButton, !canGoBack && styles.disabledButton]}
                >
                  <Text style={styles.pageButtonText}>Previous</Text>
                </Pressable>
                <Pressable
                  disabled={!canGoForward}
                  onPress={() => setOffset((current) => current + PAGE_SIZE)}
                  style={[styles.pageButton, !canGoForward && styles.disabledButton]}
                >
                  <Text style={styles.pageButtonText}>Next</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function DonationCard({
  donation,
  onEdit,
  onCancel,
  onRequests,
  onMedia,
  onComplete,
}: {
  donation: DonationFeedItem;
  onEdit: () => void;
  onCancel: () => void;
  onRequests: () => void;
  onMedia: () => void;
  onComplete: () => void;
}) {
  const editable = donation.status === "AVAILABLE";
  const canComplete = donation.status === "COLLECTED";

  return (
    <View style={styles.donationCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, styles[`status${donation.status}`]]}>
          <Text style={styles.statusText}>{statusLabel(donation.status)}</Text>
        </View>
        <Text style={styles.areaText} numberOfLines={1}>{donation.pickup_area}</Text>
      </View>
      <Text style={styles.foodName}>{donation.food_name}</Text>
      <Text style={styles.quantityText}>{donation.quantity} {donation.unit}</Text>
      <Text style={styles.deadlineText}>Pickup by {formatDateTime(donation.pickup_deadline)}</Text>

      <View style={styles.cardActions}>
        <Pressable onPress={onRequests} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Requests</Text>
        </Pressable>
        <Pressable onPress={onMedia} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Media</Text>
        </Pressable>
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
  );
}

export default function RestaurantDonationsScreen() {
  const { user } = useAuth();
  const isRestaurant = user?.role === "RESTAURANT";
  const [page, setPage] = useState<PaginatedResponse<DonationFeedItem> | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [formDonation, setFormDonation] = useState<DonationFeedItem | null | undefined>(undefined);
  const [selectedDonation, setSelectedDonation] = useState<DonationFeedItem | null>(null);
  const [mediaDonation, setMediaDonation] = useState<DonationFeedItem | null>(null);
  const [busyDonationId, setBusyDonationId] = useState<number | null>(null);

  const reload = useCallback(() => setRevision((current) => current + 1), []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!isRestaurant) {
        setLoading(false);
        return () => {
          active = false;
        };
      }

      async function loadDonations() {
        setLoading(true);
        setError(null);
        try {
          const result = await getRestaurantDonations({ limit: PAGE_SIZE, offset });
          if (active) setPage(result);
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
    }, [isRestaurant, offset, revision]),
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

  if (!isRestaurant) {
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

  return (
    <SafeAreaView style={styles.screen} edges={Platform.OS === "android" ? ["top", "left", "right"] : []}>
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>F</Text></View>
          <Text style={styles.brand}>FoodShare</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>RESTAURANT WORKSPACE</Text>
          <Text style={styles.heroTitle}>Share food with purpose.</Text>
          <Text style={styles.heroText}>Post safe surplus food, choose a pickup request, and follow every collection.</Text>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionLabel}>YOUR DONATIONS</Text>
            <Text style={styles.sectionTitle}>{total === 1 ? "1 donation" : `${total} donations`}</Text>
          </View>
          <Pressable onPress={() => setFormDonation(null)} style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        {loading ? <View style={styles.loadingBox}><ActivityIndicator color="#176B43" /><Text style={styles.loadingText}>Loading donations…</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={reload}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!loading && !error && donations.length === 0 ? <View style={styles.emptyBox}><Text style={styles.emptyTitle}>Nothing shared yet</Text><Text style={styles.emptyText}>Create your first donation to help food reach the community.</Text></View> : null}

        {!loading && !error ? donations.map((donation) => (
          <DonationCard
            key={donation.id}
            donation={donation}
            onEdit={() => setFormDonation(donation)}
            onCancel={() => confirmCancel(donation)}
            onRequests={() => setSelectedDonation(donation)}
            onMedia={() => setMediaDonation(donation)}
            onComplete={() => confirmComplete(donation)}
          />
        )) : null}

        {total > PAGE_SIZE ? <View style={styles.paginationRow}>
          <Pressable disabled={!canGoBack} onPress={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))} style={[styles.pageButton, !canGoBack && styles.disabledButton]}><Text style={styles.pageButtonText}>Previous</Text></Pressable>
          <Pressable disabled={!canGoForward} onPress={() => setOffset((current) => current + PAGE_SIZE)} style={[styles.pageButton, !canGoForward && styles.disabledButton]}><Text style={styles.pageButtonText}>Next</Text></Pressable>
        </View> : null}
      </ScrollView>

      {formDonation !== undefined ? <DonationFormModal key={formDonation?.id ?? "new"} donation={formDonation} area={user?.area} address={user?.address} onClose={() => setFormDonation(undefined)} onSave={saveDonation} /> : null}
      {selectedDonation ? <PickupRequestsModal donation={selectedDonation} onClose={() => setSelectedDonation(null)} onDonationChanged={reload} /> : null}
      {mediaDonation ? <DonationMediaModal donationId={mediaDonation.id} donationName={mediaDonation.food_name} onClose={() => setMediaDonation(null)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F3" },
  container: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 32, gap: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#176B43" },
  logoText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  brand: { color: "#183B2A", fontSize: 20, fontWeight: "800" },
  hero: { gap: 8, borderRadius: 25, padding: 22, backgroundColor: "#174B36" },
  heroLabel: { color: "#B9DFC7", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  heroText: { color: "#D7E9DC", fontSize: 15, lineHeight: 22 },
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 },
  sectionLabel: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { marginTop: 4, color: "#173526", fontSize: 23, fontWeight: "800" },
  addButton: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#176B43" },
  addButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  donationCard: { gap: 10, borderRadius: 22, padding: 18, backgroundColor: "#FFFFFF" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#E4F2E8" },
  statusAVAILABLE: { backgroundColor: "#E2F4E8" },
  statusRESERVED: { backgroundColor: "#FFF0D4" },
  statusCOLLECTED: { backgroundColor: "#E1EEFF" },
  statusCOMPLETED: { backgroundColor: "#DFF1E5" },
  statusEXPIRED: { backgroundColor: "#F0F0F0" },
  statusCANCELLED: { backgroundColor: "#FFE8E5" },
  statusText: { color: "#24593B", fontSize: 12, fontWeight: "800" },
  areaText: { flex: 1, color: "#66786D", fontSize: 13, fontWeight: "700", textAlign: "right" },
  foodName: { color: "#173526", fontSize: 21, fontWeight: "800" },
  quantityText: { color: "#496957", fontSize: 15, fontWeight: "700" },
  deadlineText: { color: "#66786D", fontSize: 13 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  secondaryButton: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: "#EDF7F0" },
  secondaryButtonText: { color: "#176B43", fontSize: 13, fontWeight: "800" },
  cancelButton: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: "#FFF0EE" },
  cancelText: { color: "#A43C31", fontSize: 13, fontWeight: "800" },
  completeButton: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: "#176B43" },
  completeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  loadingBox: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 22, backgroundColor: "#FFFFFF" },
  loadingText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 8, borderRadius: 18, padding: 16, backgroundColor: "#FFF2F0" },
  errorText: { color: "#8A342A", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#9B2C22", fontSize: 14, fontWeight: "800" },
  emptyBox: { alignItems: "center", borderRadius: 22, paddingHorizontal: 28, paddingVertical: 34, backgroundColor: "#FFFFFF" },
  emptyTitle: { color: "#173526", fontSize: 18, fontWeight: "800" },
  emptyText: { marginTop: 7, color: "#66786D", fontSize: 14, lineHeight: 21, textAlign: "center" },
  paginationRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  pageButton: { flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12, backgroundColor: "#E4F2E8" },
  pageButtonText: { color: "#176B43", fontSize: 14, fontWeight: "800" },
  disabledButton: { opacity: 0.45 },
  buttonPressed: { opacity: 0.74 },
  accessBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  accessTitle: { color: "#173526", fontSize: 21, fontWeight: "800" },
  accessText: { marginTop: 8, color: "#66786D", fontSize: 15, textAlign: "center" },
  modalScreen: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13, 36, 24, 0.46)" },
  modalCard: { maxHeight: "92%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#F7FAF7" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 22, paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: "#E3ECE5" },
  modalEyebrow: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  modalTitle: { marginTop: 4, color: "#173526", fontSize: 21, fontWeight: "800" },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F0EA" },
  closeButtonText: { color: "#31503E", fontSize: 26, fontWeight: "400", lineHeight: 28 },
  formContent: { padding: 22, paddingBottom: 34, gap: 15 },
  formField: { gap: 7 },
  inputLabel: { color: "#526B5A", fontSize: 13, fontWeight: "800" },
  input: { minHeight: 50, borderWidth: 1, borderColor: "#D6E2D9", borderRadius: 13, paddingHorizontal: 13, color: "#1E3829", fontSize: 15, backgroundColor: "#FFFFFF" },
  multilineInput: { minHeight: 88, paddingTop: 12 },
  twoColumnRow: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },
  dateButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#D6E2D9", borderRadius: 13, paddingHorizontal: 13, backgroundColor: "#FFFFFF" },
  dateButtonText: { color: "#1E3829", fontSize: 15 },
  dateButtonIcon: { color: "#176B43", fontSize: 18, fontWeight: "800" },
  formError: { borderRadius: 12, padding: 12, color: "#9B2C22", fontSize: 14, lineHeight: 20, backgroundColor: "#FFF0EE" },
  saveButton: { minHeight: 54, alignItems: "center", justifyContent: "center", marginTop: 4, borderRadius: 15, backgroundColor: "#176B43" },
  saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  requestContent: { padding: 22, paddingBottom: 34, gap: 12 },
  requestSubtitle: { color: "#66786D", fontSize: 14, marginBottom: 4 },
  requestCard: { gap: 8, borderRadius: 17, padding: 15, backgroundColor: "#FFFFFF" },
  requestHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  requestName: { color: "#1E3829", fontSize: 16, fontWeight: "800" },
  requestStatus: { color: "#176B43", fontSize: 12, fontWeight: "800" },
  requestTime: { color: "#66786D", fontSize: 13 },
  requestMessage: { color: "#496957", fontSize: 14, lineHeight: 20 },
  requestActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  rejectButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#FFF0EE" },
  rejectText: { color: "#A43C31", fontSize: 14, fontWeight: "800" },
  acceptButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#176B43" },
  acceptText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
