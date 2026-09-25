import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import BrandHeader from "@/components/brand-header";
import { useAuth } from "@/providers/auth-provider";
import { asDate, formatBangladeshDateTime } from "@/lib/datetime";
import { getDonationMedia } from "@/services/donation-media";
import {
  createPickupRequest,
  getDonationById,
} from "@/services/donations";
import type { DonationFeedItem } from "@/types/donation";
import type { DonationMedia } from "@/types/donation-media";

function safeDate(value: string): Date {
  return asDate(value) ?? new Date();
}

function mergeDate(current: Date, next: Date): Date {
  const result = new Date(current);
  result.setFullYear(next.getFullYear(), next.getMonth(), next.getDate());
  return result;
}

function mergeTime(current: Date, next: Date): Date {
  const result = new Date(current);
  result.setHours(next.getHours(), next.getMinutes(), 0, 0);
  return result;
}

function DonationVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (createdPlayer) => {
    createdPlayer.muted = true;
  });

  return (
    <VideoView
      contentFit="cover"
      nativeControls
      player={player}
      style={styles.video}
      surfaceType="textureView"
    />
  );
}

function PickUpTimeField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (value: Date) => void;
}) {
  const [step, setStep] = useState<"date" | "time" | null>(null);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Estimated pickup time *</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setStep("date")}
        style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
      >
        <Text style={styles.dateText}>{formatBangladeshDateTime(value)}</Text>
        <Text style={styles.dateIcon}>⌄</Text>
      </Pressable>

      {step ? (
        <DateTimePicker
          is24Hour
          mode={step}
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
          presentation="dialog"
          value={value}
        />
      ) : null}
    </View>
  );
}

function statusLabel(status: DonationFeedItem["status"]): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function DonationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const donationId = Number(id);
  const [donation, setDonation] = useState<DonationFeedItem | null>(null);
  const [media, setMedia] = useState<DonationMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickupAt, setPickupAt] = useState(new Date());
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const loadDonation = useCallback(async () => {
    if (!Number.isInteger(donationId) || donationId <= 0) {
      setError("This donation link is invalid.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [donationResult, mediaResult] = await Promise.all([
        getDonationById(donationId),
        getDonationMedia(donationId).catch(() => []),
      ]);

      setDonation(donationResult);
      setMedia(mediaResult.sort((first, second) => first.sort_order - second.sort_order));

      const earliestPickup = new Date(
        Math.max(
          safeDate(donationResult.prepared_at).getTime(),
          safeDate(donationResult.created_at).getTime(),
        ),
      );
      setPickupAt(earliestPickup);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load this donation.",
      );
    } finally {
      setLoading(false);
    }
  }, [donationId]);

  useEffect(() => {
    void loadDonation();
  }, [loadDonation]);

  const images = useMemo(
    () => media.filter((item) => item.media_type === "IMAGE"),
    [media],
  );
  const videos = useMemo(
    () => media.filter((item) => item.media_type === "VIDEO"),
    [media],
  );

  async function submitPickupRequest() {
    if (!donation || submitting) return;

    const availableFrom = Math.max(
      safeDate(donation.prepared_at).getTime(),
      safeDate(donation.created_at).getTime(),
    );
    const deadline = safeDate(donation.pickup_deadline).getTime();
    const selectedTime = pickupAt.getTime();

    if (selectedTime < availableFrom) {
      setRequestError("Choose a pickup time after the food is prepared and posted.");
      return;
    }

    if (selectedTime > deadline) {
      setRequestError("Choose a pickup time before the pickup deadline.");
      return;
    }

    setSubmitting(true);
    setRequestError(null);
    setRequestMessage(null);

    try {
      await createPickupRequest(donation.id, {
        estimated_pickup_at: pickupAt.toISOString(),
        message: message.trim() || null,
      });
      setRequestMessage("Pickup request submitted. The restaurant will review it.");
      setMessage("");
    } catch (requestError) {
      setRequestError(
        requestError instanceof Error
          ? requestError.message
          : "Could not submit your pickup request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canRequest =
    user?.role === "NGO" && donation?.status === "AVAILABLE";
  const postedBy = donation
    ? donation.restaurant_organization_name?.trim() ||
      donation.restaurant_full_name?.trim() ||
      "Verified Partner Restaurant"
    : null;

  return (
    <SafeAreaView
      style={styles.screen}
      edges={Platform.OS === "android" ? ["top", "left", "right"] : []}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color="#176B43" />
          </Pressable>
          <BrandHeader size="compact" />
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color="#176B43" />
            <Text style={styles.stateText}>Loading donation…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void loadDonation()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {donation && !loading && !error ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{statusLabel(donation.status)}</Text>
                </View>
                <View style={styles.verifiedPill}>
                  <Ionicons name="shield-checkmark" size={13} color="#176B43" />
                  <Text style={styles.verifiedPillText}>Verified Surplus</Text>
                </View>
              </View>
              <Text style={styles.title}>{donation.food_name}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={15} color="#176B43" />
                <Text style={styles.area}>{donation.pickup_area}</Text>
              </View>
              {postedBy ? (
                <View style={styles.postedByRow}>
                  <Ionicons name="restaurant-outline" size={14} color="#526E5C" />
                  <Text style={styles.postedBy}>Shared by {postedBy}</Text>
                </View>
              ) : null}
            </View>

            {images.length > 0 || videos.length > 0 ? (
              <ScrollView
                horizontal
                contentContainerStyle={styles.mediaRow}
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
              >
                {images.map((item) => (
                  <Image
                    key={item.id}
                    accessibilityLabel={`Photo of ${donation.food_name}`}
                    source={{ uri: item.media_url }}
                    style={styles.image}
                  />
                ))}
                {videos.map((item) => (
                  <DonationVideo key={item.id} uri={item.media_url} />
                ))}
              </ScrollView>
            ) : null}

            {donation.description ? (
              <Text style={styles.description}>{donation.description}</Text>
            ) : null}

            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>QUANTITY</Text>
                <Text style={styles.detailValue}>{donation.quantity} {donation.unit}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PREPARED AT</Text>
                <Text style={styles.detailValue}>{formatBangladeshDateTime(donation.prepared_at)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PICKUP DEADLINE</Text>
                <Text style={styles.detailValue}>{formatBangladeshDateTime(donation.pickup_deadline)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PICKUP ADDRESS</Text>
                <Text style={styles.detailValue}>{donation.pickup_address}</Text>
              </View>
            </View>

            {donation.storage_notes || donation.allergen_info ? (
              <View style={styles.notesCard}>
                {donation.storage_notes ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteLabel}>STORAGE NOTES</Text>
                    <Text style={styles.noteText}>{donation.storage_notes}</Text>
                  </View>
                ) : null}
                {donation.allergen_info ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.noteLabel}>ALLERGEN INFORMATION</Text>
                    <Text style={styles.noteText}>{donation.allergen_info}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {canRequest ? (
              <View style={styles.requestCard}>
                <Text style={styles.requestLabel}>NGO PICKUP REQUEST</Text>
                <Text style={styles.requestTitle}>Request this donation</Text>
                <Text style={styles.requestDescription}>
                  Select a realistic collection time before the deadline.
                </Text>
                <PickUpTimeField value={pickupAt} onChange={setPickupAt} />
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Message for the restaurant</Text>
                  <TextInput
                    multiline
                    maxLength={500}
                    onChangeText={setMessage}
                    placeholder="Share your collection plan or contact details"
                    placeholderTextColor="#87968C"
                    style={styles.messageInput}
                    textAlignVertical="top"
                    value={message}
                  />
                </View>
                {requestError ? <Text style={styles.requestError}>{requestError}</Text> : null}
                {requestMessage ? <Text style={styles.requestSuccess}>{requestMessage}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  onPress={() => void submitPickupRequest()}
                  style={({ pressed }) => [
                    styles.submitButton,
                    (pressed || submitting) && styles.pressed,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Send pickup request</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F3" },
  container: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 36, gap: 18 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#E6F1E9", borderWidth: 1, borderColor: "#CFE3D5" },
  backButtonText: { color: "#176B43", fontSize: 22, lineHeight: 24 },
  stateBox: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 22, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE7E0", shadowColor: "#173526", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  stateText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 10, borderRadius: 20, padding: 18, backgroundColor: "#F2F5F3", borderWidth: 1, borderColor: "#D5E0D8" },
  errorText: { color: "#27362D", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#176B43", fontSize: 14, fontWeight: "800" },
  header: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#E2F4E8",
    borderWidth: 1,
    borderColor: "#BDE6CE",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16673E",
  },
  statusText: { color: "#176B43", fontSize: 12, fontWeight: "800" },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#EFF7F2",
    borderWidth: 1,
    borderColor: "#CCE4D5",
  },
  verifiedPillText: {
    color: "#176B43",
    fontSize: 11,
    fontWeight: "700",
  },
  title: { color: "#17251B", fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  area: { color: "#4E6656", fontSize: 15, fontWeight: "600" },
  postedByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  postedBy: { color: "#176B43", fontSize: 13, fontWeight: "700" },
  mediaRow: { gap: 12 },
  image: { width: 250, height: 188, borderRadius: 18, backgroundColor: "#E1EAE3" },
  video: { width: 250, height: 188, overflow: "hidden", borderRadius: 18, backgroundColor: "#1C4834" },
  description: { color: "#4B6454", fontSize: 16, lineHeight: 24 },
  detailsCard: { borderRadius: 22, padding: 20, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE7E0", shadowColor: "#0D331D", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  detailRow: { gap: 6 },
  detailLabel: { color: "#728278", fontSize: 11, fontWeight: "800", letterSpacing: 0.9 },
  detailValue: { color: "#264332", fontSize: 16, fontWeight: "700", lineHeight: 22 },
  divider: { height: 1, marginVertical: 16, backgroundColor: "#E4ECE6" },
  notesCard: { gap: 16, borderRadius: 22, padding: 20, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE7E0", shadowColor: "#0D331D", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  noteBlock: { gap: 6 },
  noteLabel: { color: "#728278", fontSize: 11, fontWeight: "800", letterSpacing: 0.9 },
  noteText: { color: "#425A49", fontSize: 15, lineHeight: 22 },
  requestCard: { gap: 14, borderRadius: 22, padding: 20, backgroundColor: "#FAFDFB", borderWidth: 1.2, borderColor: "#DCE7E0", shadowColor: "#0D331D", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  requestLabel: { color: "#176B43", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  requestTitle: { color: "#17251B", fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  requestDescription: { color: "#526057", fontSize: 14, lineHeight: 21 },
  field: { gap: 8 },
  fieldLabel: { color: "#3A5244", fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  dateButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: "#CFDED3", borderRadius: 14, paddingHorizontal: 16, backgroundColor: "#F2F6F3" },
  dateText: { color: "#1E3829", fontSize: 15 },
  dateIcon: { color: "#176B43", fontSize: 18, fontWeight: "800" },
  messageInput: { minHeight: 96, borderWidth: 1.5, borderColor: "#CFDED3", borderRadius: 14, paddingHorizontal: 16, paddingTop: 14, color: "#1E3829", fontSize: 15, backgroundColor: "#F2F6F3" },
  requestError: { borderRadius: 14, padding: 14, color: "#27362D", fontSize: 14, lineHeight: 20, backgroundColor: "#F2F5F3", borderWidth: 1, borderColor: "#D5E0D8" },
  requestSuccess: { borderRadius: 14, padding: 14, color: "#176B43", fontSize: 14, lineHeight: 20, backgroundColor: "#E4F3EB", borderWidth: 1, borderColor: "#B8DEC7" },
  submitButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#16673E", borderWidth: 1, borderColor: "#1E8250", shadowColor: "#115231", shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
