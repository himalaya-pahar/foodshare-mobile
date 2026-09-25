import { useCallback, useState } from "react";
import { router, useFocusEffect, type Href } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ActivityIndicator,
  Image,
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
import { Ionicons } from "@expo/vector-icons";

import BrandHeader from "@/components/brand-header";
import { useAuth } from "@/providers/auth-provider";
import { AiAssistant } from "@/components/ai-assistant";
import { formatBangladeshDateTime } from "@/lib/datetime";
import { getDonationMedia } from "@/services/donation-media";
import { getAvailableDonations } from "@/services/donations";
import type { DonationFeedItem } from "@/types/donation";
import type { DonationMedia } from "@/types/donation-media";

const PAGE_SIZE = 10;

type FeedDonation = DonationFeedItem & {
  media: DonationMedia[];
};

function donationHref(donationId: number): Href {
  return `/donation/${donationId}` as Href;
}

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

function DonationCard({
  donation,
  onPress,
}: {
  donation: FeedDonation;
  onPress: () => void;
}) {
  const images = donation.media.filter((item) => item.media_type === "IMAGE");
  const videos = donation.media.filter((item) => item.media_type === "VIDEO");
  const postedBy = donation.restaurant_organization_name?.trim() ||
    donation.restaurant_full_name?.trim() ||
    "Verified Partner Restaurant";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${donation.food_name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.donationCard,
        pressed && styles.buttonPressed,
      ]}
    >
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
        <View style={styles.cardTopRow}>
          <View style={styles.verifiedSurplusBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#16673E" />
            <Text style={styles.verifiedSurplusText}>Verified Surplus</Text>
          </View>
          <View style={styles.availableBadge}>
            <View style={styles.availableDot} />
            <Text style={styles.availableText}>Available</Text>
          </View>
        </View>

        <View style={styles.cardIdentity}>
          <Text style={styles.foodName}>{donation.food_name}</Text>
          <Text style={styles.cardArea} numberOfLines={1}>
            {donation.pickup_area}
          </Text>
          {donation.description ? (
            <Text style={styles.description} numberOfLines={3}>
              {donation.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.detailsPanel}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>QUANTITY</Text>
              <Text style={styles.metaValue}>
                {donation.quantity} {donation.unit}
              </Text>
            </View>

            <View style={styles.metaDivider} />

            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>PICKUP BY</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {formatBangladeshDateTime(donation.pickup_deadline)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.locationSection}>
          <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
          <Text style={styles.address} numberOfLines={2}>{donation.pickup_address}</Text>
        </View>

        <View style={styles.postedByRow}>
          <Text style={styles.postedByLabel}>POSTED BY</Text>
          <Text style={styles.postedByName} numberOfLines={1}>{postedBy}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.postedAt}>Posted {formatBangladeshDateTime(donation.created_at)}</Text>
          <View style={styles.cardActionBtn}>
            <Text style={styles.cardActionText}>Details</Text>
            <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [donations, setDonations] = useState<FeedDonation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaInput, setAreaInput] = useState("");
  const [area, setArea] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const addMediaToDonations = useCallback(
    async (items: DonationFeedItem[]): Promise<FeedDonation[]> =>
      Promise.all(
        items.map(async (donation) => {
          try {
            const media = await getDonationMedia(donation.id);
            return { ...donation, media };
          } catch {
            // Media is optional, so a failed media request must not hide food listings.
            return { ...donation, media: [] };
          }
        }),
      ),
    [],
  );

  const loadFeed = useCallback(
    async (offset: number, mode: "replace" | "append") => {
      if (mode === "replace") {
        setError(null);
      }

      try {
        const page = await getAvailableDonations({
          limit: PAGE_SIZE,
          offset,
          area: area || undefined,
        });
        const donationsWithMedia = await addMediaToDonations(page.items);

        setTotal(page.total);
        setDonations((current) =>
          mode === "replace"
            ? donationsWithMedia
            : [...current, ...donationsWithMedia],
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load available donations.",
        );
      }
    },
    [addMediaToDonations, area],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadInitialFeed() {
        setLoading(true);
        setError(null);

        try {
          const page = await getAvailableDonations({
            limit: PAGE_SIZE,
            offset: 0,
            area: area || undefined,
          });
          const donationsWithMedia = await addMediaToDonations(page.items);

          if (!active) return;

          setDonations(donationsWithMedia);
          setTotal(page.total);
        } catch (requestError) {
          if (active) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Could not load available donations.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadInitialFeed();

      return () => {
        active = false;
      };
    }, [addMediaToDonations, area, refreshKey]),
  );

  async function refreshFeed() {
    if (refreshing) return;

    setRefreshing(true);
    await loadFeed(0, "replace");
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore || donations.length >= total) return;

    setLoadingMore(true);
    await loadFeed(donations.length, "append");
    setLoadingMore(false);
  }

  function searchByArea() {
    const nextArea = areaInput.trim();

    if (nextArea === area) {
      setRefreshKey((value) => value + 1);
      return;
    }

    setArea(nextArea);
  }

  function clearAreaSearch() {
    setAreaInput("");
    if (!area) return;
    setArea("");
  }

  const firstName = user?.full_name.trim().split(/\s+/)[0] || "there";
  const hasMore = donations.length < total;

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
            refreshing={refreshing}
            onRefresh={() => void refreshFeed()}
            tintColor="#176B43"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader />

        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>Community Food Network</Text>
          </View>
          <Text style={styles.headerTitle}>Hello, {firstName}</Text>
          <Text style={styles.headerText}>
            Safe surplus food, ready to reach the community.
          </Text>
        </View>

        <View style={styles.feedHeader}>
          <View>
            <Text style={styles.sectionLabel}>LIVE DONATIONS</Text>
            <Text style={styles.sectionTitle}>Available now</Text>
          </View>
          <Text style={styles.countText}>
            {total === 1 ? "1 donation" : `${total} donations`}
          </Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            onChangeText={setAreaInput}
            onSubmitEditing={searchByArea}
            placeholder="Search donations by area"
            placeholderTextColor="#87968C"
            returnKeyType="search"
            style={styles.searchInput}
            value={areaInput}
          />
          <Pressable
            accessibilityRole="button"
            onPress={searchByArea}
            style={({ pressed }) => [styles.searchButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>

        {area ? (
          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterText}>Area: {area}</Text>
            <Pressable onPress={clearAreaSearch}>
              <Text style={styles.clearFilterText}>Clear</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#176B43" />
            <Text style={styles.loadingText}>Loading available food…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Feed unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refreshFeed()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && donations.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>+</Text>
            </View>
            <Text style={styles.emptyTitle}>No donations right now</Text>
            <Text style={styles.emptyText}>
              New food donations will appear here as soon as they are shared.
            </Text>
          </View>
        ) : null}

        {!loading && !error
          ? donations.map((donation) => (
              <DonationCard
                key={donation.id}
                donation={donation}
                onPress={() =>
                  router.push(donationHref(donation.id))
                }
              />
            ))
          : null}

        {!loading && !error && hasMore ? (
          <Pressable
            accessibilityRole="button"
            disabled={loadingMore}
            onPress={() => void loadMore()}
            style={({ pressed }) => [
              styles.loadMoreButton,
              (pressed || loadingMore) && styles.buttonPressed,
            ]}
          >
            {loadingMore ? (
              <ActivityIndicator color="#176B43" />
            ) : (
              <Text style={styles.loadMoreText}>Load more donations</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      <AiAssistant />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F7F3",
  },
  container: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingBottom: 36,
    gap: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  brand: {
    color: "#183B2A",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
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
  feedHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 8,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: "#D2DFD6",
    borderRadius: 15,
    paddingHorizontal: 16,
    color: "#1E3829",
    fontSize: 15,
    backgroundColor: "#FAFDFB",
  },
  searchButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    paddingHorizontal: 18,
    backgroundColor: "#16673E",
    borderWidth: 1,
    borderColor: "#1E8250",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#E2F4E8",
  },
  activeFilterText: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "700",
  },
  clearFilterText: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "800",
  },
  sectionLabel: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    marginTop: 4,
    color: "#173526",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  countText: {
    color: "#587063",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingBox: {
    minHeight: 180,
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
  loadingText: {
    color: "#66786D",
    fontSize: 14,
  },
  donationCard: {
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "#DCE6DF",
    borderRadius: 22,
    backgroundColor: "#FAFDFB",
    shadowColor: "#0D2E1B",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardContent: {
    padding: 20,
    gap: 16,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  verifiedSurplusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    backgroundColor: "#EAF5EE",
    borderWidth: 1,
    borderColor: "#CBE4D4",
  },
  verifiedSurplusText: {
    color: "#16673E",
    fontSize: 11,
    fontWeight: "800",
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#E2F4E8",
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#20844F",
  },
  availableText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "800",
  },
  cardArea: {
    color: "#66786D",
    fontSize: 13,
    fontWeight: "700",
  },
  foodName: {
    color: "#173526",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  cardIdentity: {
    gap: 5,
  },
  postedAt: {
    color: "#6E8275",
    fontSize: 12,
    lineHeight: 18,
  },
  description: {
    color: "#587063",
    fontSize: 14,
    lineHeight: 21,
  },
  postedByRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF3EF",
    paddingTop: 12,
  },
  postedByLabel: {
    color: "#7A8C80",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  postedByName: {
    flex: 1,
    color: "#28533B",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  mediaContainer: {
    backgroundColor: "#E4EEE6",
  },
  heroMediaImage: {
    width: 340,
    height: 220,
    backgroundColor: "#E4EEE6",
  },
  heroMediaVideo: {
    width: 340,
    height: 220,
    backgroundColor: "#1C4834",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  detailsPanel: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#F3F7F4",
  },
  metaItem: {
    flex: 1,
    gap: 4,
  },
  metaDivider: {
    width: 1,
    marginHorizontal: 12,
    backgroundColor: "#DCE7DE",
  },
  metaLabel: {
    color: "#7A8C80",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  metaValue: {
    color: "#284634",
    fontSize: 13,
    fontWeight: "700",
  },
  address: {
    color: "#405A49",
    fontSize: 13,
    lineHeight: 19,
  },
  locationSection: {
    gap: 3,
  },
  locationLabel: {
    color: "#7A8C80",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  cardFooter: {
    marginHorizontal: -20,
    marginBottom: -20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EDF2EE",
    backgroundColor: "#F7FAF8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#16673E",
  },
  cardActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  errorBox: {
    gap: 10,
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#F2F5F3",
    borderWidth: 1,
    borderColor: "#D5E0D8",
  },
  errorTitle: {
    color: "#173526",
    fontSize: 17,
    fontWeight: "800",
  },
  errorText: {
    color: "#5F7367",
    fontSize: 14,
    lineHeight: 21,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#176B43",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyBox: {
    alignItems: "center",
    borderRadius: 22,
    paddingHorizontal: 32,
    paddingVertical: 40,
    backgroundColor: "#FAFDFB",
    borderWidth: 1.2,
    borderColor: "#DCE6DF",
    shadowColor: "#0D2E1B",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#E2F4E8",
  },
  emptyIconText: {
    color: "#176B43",
    fontSize: 30,
    fontWeight: "500",
  },
  emptyTitle: {
    marginTop: 16,
    color: "#173526",
    fontSize: 19,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: "#66786D",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  loadMoreButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#B7D6C1",
    borderRadius: 18,
    backgroundColor: "#EDF7F0",
  },
  loadMoreText: {
    color: "#176B43",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
