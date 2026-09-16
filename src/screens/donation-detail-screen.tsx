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
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/providers/auth-provider";
import { formatBangladeshDateTime } from "@/lib/datetime";
import { getDonationMedia } from "@/services/donation-media";
import {
  createPickupRequest,
  getDonationById,
} from "@/services/donations";
import type { DonationFeedItem } from "@/types/donation";
import type { DonationMedia } from "@/types/donation-media";

function safeDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
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
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.brand}>FoodShare</Text>
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
            <View style={styles.hero}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{statusLabel(donation.status)}</Text>
              </View>
              <Text style={styles.title}>{donation.food_name}</Text>
              <Text style={styles.donationId}>Donation ID {donation.id}</Text>
              <Text style={styles.area}>{donation.pickup_area}</Text>
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
  container: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 34, gap: 17 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 11 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#E0ECE3" },
  backButtonText: { color: "#176B43", fontSize: 30, lineHeight: 32 },
  brand: { color: "#183B2A", fontSize: 20, fontWeight: "800" },
  stateBox: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 22, backgroundColor: "#FFFFFF" },
  stateText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 8, borderRadius: 18, padding: 16, backgroundColor: "#FFF0EE" },
  errorText: { color: "#8A342A", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#9B2C22", fontSize: 14, fontWeight: "800" },
  hero: { gap: 8, borderRadius: 24, padding: 22, backgroundColor: "#174B36" },
  statusBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#DDF3E4" },
  statusText: { color: "#176B43", fontSize: 12, fontWeight: "800" },
  title: { color: "#FFFFFF", fontSize: 29, fontWeight: "800", letterSpacing: -0.8 },
  donationId: { marginTop: -3, color: "#D7E9DC", fontSize: 12, fontWeight: "800" },
  area: { color: "#C5E5D0", fontSize: 14, fontWeight: "700" },
  mediaRow: { gap: 10 },
  image: { width: 246, height: 184, borderRadius: 17, backgroundColor: "#E1EAE3" },
  video: { width: 246, height: 184, overflow: "hidden", borderRadius: 17, backgroundColor: "#1C4834" },
  description: { color: "#4B6454", fontSize: 15, lineHeight: 23 },
  detailsCard: { borderRadius: 20, padding: 17, backgroundColor: "#FFFFFF" },
  detailRow: { gap: 5 },
  detailLabel: { color: "#728278", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  detailValue: { color: "#264332", fontSize: 15, fontWeight: "700", lineHeight: 21 },
  divider: { height: 1, marginVertical: 14, backgroundColor: "#E4ECE6" },
  notesCard: { gap: 14, borderRadius: 20, padding: 17, backgroundColor: "#FFFFFF" },
  noteBlock: { gap: 5 },
  noteLabel: { color: "#728278", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  noteText: { color: "#425A49", fontSize: 14, lineHeight: 21 },
  requestCard: { gap: 15, borderRadius: 22, padding: 19, backgroundColor: "#E4F2E8" },
  requestLabel: { color: "#397152", fontSize: 11, fontWeight: "800", letterSpacing: 0.9 },
  requestTitle: { marginTop: -8, color: "#173526", fontSize: 22, fontWeight: "800" },
  requestDescription: { marginTop: -8, color: "#536B5B", fontSize: 14, lineHeight: 20 },
  field: { gap: 7 },
  fieldLabel: { color: "#526B5A", fontSize: 13, fontWeight: "800" },
  dateButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#CFDED3", borderRadius: 13, paddingHorizontal: 13, backgroundColor: "#FFFFFF" },
  dateText: { color: "#1E3829", fontSize: 15 },
  dateIcon: { color: "#176B43", fontSize: 18, fontWeight: "800" },
  messageInput: { minHeight: 93, borderWidth: 1, borderColor: "#CFDED3", borderRadius: 13, paddingHorizontal: 13, paddingTop: 12, color: "#1E3829", fontSize: 15, backgroundColor: "#FFFFFF" },
  requestError: { borderRadius: 12, padding: 12, color: "#9B2C22", fontSize: 14, lineHeight: 20, backgroundColor: "#FFF0EE" },
  requestSuccess: { borderRadius: 12, padding: 12, color: "#176B43", fontSize: 14, lineHeight: 20, backgroundColor: "#FFFFFF" },
  submitButton: { minHeight: 53, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#176B43" },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
