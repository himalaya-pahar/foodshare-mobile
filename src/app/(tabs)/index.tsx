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

import { useAuth } from "@/providers/auth-provider";
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
      style={styles.mediaVideo}
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
    donation.restaurant_full_name?.trim();

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
      <View style={styles.cardTopRow}>
        <Text style={styles.donationIdTop}>Donation ID {donation.id}</Text>
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

      {postedBy ? (
        <View style={styles.postedByRow}>
          <Text style={styles.postedByLabel}>POSTED BY</Text>
          <Text style={styles.postedByName} numberOfLines={1}>{postedBy}</Text>
        </View>
      ) : null}

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
              style={styles.mediaImage}
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

      <View style={styles.cardFooter}>
        <Text style={styles.postedAt}>Posted {formatBangladeshDateTime(donation.created_at)}</Text>
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
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.brand}>FoodShare</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>COMMUNITY FOOD NETWORK</Text>
          <Text style={styles.greeting}>Hello, {firstName}.</Text>
          <Text style={styles.heroText}>
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
    paddingBottom: 32,
    gap: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "#176B43",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  brand: {
    color: "#183B2A",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  hero: {
    gap: 8,
    borderRadius: 25,
    padding: 22,
    backgroundColor: "#174B36",
  },
  eyebrow: {
    color: "#B9DFC7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  greeting: {
    color: "#FFFFFF",
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroText: {
    color: "#D7E9DC",
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
    gap: 9,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D6E2D9",
    borderRadius: 13,
    paddingHorizontal: 13,
    color: "#1E3829",
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },
  searchButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    paddingHorizontal: 15,
    backgroundColor: "#176B43",
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: "#E2F4E8",
  },
  activeFilterText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "700",
  },
  clearFilterText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "800",
  },
  sectionLabel: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionTitle: {
    marginTop: 4,
    color: "#173526",
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  countText: {
    color: "#587063",
    fontSize: 13,
    fontWeight: "700",
  },
  loadingBox: {
    minHeight: 176,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    color: "#66786D",
    fontSize: 14,
  },
  donationCard: {
    gap: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5EEE7",
    borderRadius: 24,
    padding: 17,
    backgroundColor: "#FFFFFF",
    shadowColor: "#173526",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  availableBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#E2F4E8",
  },
  availableDot: {
    width: 7,
    height: 7,
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
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  cardIdentity: {
    gap: 5,
  },
  donationIdTop: {
    color: "#6E8275",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
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
  mediaRow: {
    gap: 10,
  },
  mediaImage: {
    width: 158,
    height: 116,
    borderRadius: 14,
    backgroundColor: "#E4EEE6",
  },
  mediaVideo: {
    width: 158,
    height: 116,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1C4834",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  detailsPanel: {
    borderRadius: 15,
    padding: 13,
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
    marginHorizontal: -17,
    marginBottom: -17,
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EDF2EE",
    backgroundColor: "#FAFCFA",
  },
  errorBox: {
    gap: 9,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFF2F0",
  },
  errorTitle: {
    color: "#9B2C22",
    fontSize: 16,
    fontWeight: "800",
  },
  errorText: {
    color: "#7A3D36",
    fontSize: 14,
    lineHeight: 21,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#9B2C22",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyBox: {
    alignItems: "center",
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 34,
    backgroundColor: "#FFFFFF",
  },
  emptyIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#E2F4E8",
  },
  emptyIconText: {
    color: "#176B43",
    fontSize: 28,
    fontWeight: "500",
  },
  emptyTitle: {
    marginTop: 15,
    color: "#173526",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 7,
    color: "#66786D",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  loadMoreButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#B7D6C1",
    borderRadius: 16,
    backgroundColor: "#EDF7F0",
  },
  loadMoreText: {
    color: "#176B43",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
