import { useCallback, useEffect, useMemo, useState } from "react";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteDonationMedia,
  getDonationMedia,
  uploadDonationMedia,
} from "@/services/donation-media";
import { formatBangladeshDate } from "@/lib/datetime";
import type {
  DonationMedia,
  DonationMediaContentType,
} from "@/types/donation-media";

const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;
const MAX_DONATION_MEDIA_BYTES = 5 * 1024 * 1024;

type MediaKind = "image" | "video";

const imageContentTypeByExtension: Record<string, DonationMediaContentType> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function resolveContentType(
  kind: MediaKind,
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  uri: string,
): DonationMediaContentType | null {
  const normalizedMimeType = mimeType?.toLowerCase();

  if (kind === "image") {
    if (normalizedMimeType === "image/jpeg" || normalizedMimeType === "image/jpg") {
      return "image/jpeg";
    }
    if (normalizedMimeType === "image/png") return "image/png";
    if (normalizedMimeType === "image/webp") return "image/webp";

    const extension = (fileName ?? uri)
      .split(/[?#]/)[0]
      .split(".")
      .pop()
      ?.toLowerCase();

    return extension ? imageContentTypeByExtension[extension] ?? null : null;
  }

  if (normalizedMimeType === "video/mp4") return "video/mp4";

  const extension = (fileName ?? uri)
    .split(/[?#]/)[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  return extension === "mp4" ? "video/mp4" : null;
}

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DonationMediaModal({
  donationId,
  donationName,
  onClose,
}: {
  donationId: number;
  donationName: string;
  onClose: () => void;
}) {
  const [media, setMedia] = useState<DonationMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getDonationMedia(donationId);
      setMedia(result.sort((first, second) => first.sort_order - second.sort_order));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load this donation's media.",
      );
    } finally {
      setLoading(false);
    }
  }, [donationId]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const images = useMemo(
    () => media.filter((item) => item.media_type === "IMAGE"),
    [media],
  );
  const videos = useMemo(
    () => media.filter((item) => item.media_type === "VIDEO"),
    [media],
  );

  async function selectMedia(kind: MediaKind) {
    if (uploadingLabel || deletingId !== null) return;

    const remaining = kind === "image" ? MAX_IMAGES - images.length : MAX_VIDEOS - videos.length;

    if (remaining <= 0) return;

    setError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [kind === "image" ? "images" : "videos"],
        allowsMultipleSelection: kind === "image",
        selectionLimit: kind === "image" ? remaining : 1,
        orderedSelection: kind === "image",
        quality: kind === "image" ? 0.9 : 1,
      });

      if (result.canceled || result.assets.length === 0) return;

      const selected = result.assets.slice(0, remaining).map((asset) => {
        const contentType = resolveContentType(
          kind,
          asset.mimeType,
          asset.fileName,
          asset.uri,
        );

        if (!contentType) {
          throw new Error(
            kind === "image"
              ? "Choose JPEG, PNG, or WebP images."
              : "Choose an MP4 video.",
          );
        }

        const file = new File(asset.uri);

        if (!file.exists || file.size <= 0) {
          throw new Error("Could not read the selected media. Please try again.");
        }

        if (file.size > MAX_DONATION_MEDIA_BYTES) {
          throw new Error(
            `This file is ${formatFileSize(file.size)}. Choose one smaller than 5 MB.`,
          );
        }

        return { contentType, file };
      });

      const nextSortOrder = Math.max(-1, ...media.map((item) => item.sort_order)) + 1;

      for (let index = 0; index < selected.length; index += 1) {
        const item = selected[index];
        const description =
          kind === "image"
            ? `Uploading image ${index + 1} of ${selected.length}…`
            : "Uploading video…";

        setUploadingLabel(description);
        await uploadDonationMedia(
          donationId,
          item.contentType,
          item.file,
          nextSortOrder + index,
        );
      }

      await loadMedia();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not upload this media.";

      setError(message);
      await loadMedia();
      setError(message);
    } finally {
      setUploadingLabel(null);
    }
  }

  function confirmDelete(item: DonationMedia) {
    Alert.alert(
      "Remove this media?",
      "It will be removed from this donation permanently.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void removeMedia(item),
        },
      ],
    );
  }

  async function removeMedia(item: DonationMedia) {
    if (uploadingLabel || deletingId !== null) return;

    setDeletingId(item.id);
    setError(null);

    try {
      await deleteDonationMedia(item.id);
      setMedia((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not remove this media.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const isBusy = uploadingLabel !== null || deletingId !== null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!isBusy) onClose();
      }}
      transparent
    >
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>DONATION MEDIA</Text>
              <Text style={styles.title} numberOfLines={1}>{donationName}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close donation media"
              disabled={isBusy}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#176B43" />
                <Text style={styles.stateText}>Loading media…</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable disabled={isBusy} onPress={() => void loadMedia()}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {!loading ? (
              <>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Photos</Text>
                    <Text style={styles.sectionHint}>{images.length} / {MAX_IMAGES} images</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add donation photos"
                    accessibilityState={{ disabled: isBusy || images.length >= MAX_IMAGES }}
                    disabled={isBusy || images.length >= MAX_IMAGES}
                    onPress={() => void selectMedia("image")}
                    style={({ pressed }) => [
                      styles.addButton,
                      (pressed || isBusy || images.length >= MAX_IMAGES) && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.addButtonText}>+ Add photos</Text>
                  </Pressable>
                </View>

                {images.length === 0 ? (
                  <View style={styles.emptyMediaBox}>
                    <Text style={styles.emptyMediaText}>No photos added yet.</Text>
                  </View>
                ) : (
                  <View style={styles.imageGrid}>
                    {images.map((item) => (
                      <View key={item.id} style={styles.imageCard}>
                        <Image source={{ uri: item.media_url }} style={styles.image} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove donation photo"
                          disabled={isBusy}
                          onPress={() => confirmDelete(item)}
                          style={({ pressed }) => [
                            styles.removeImageButton,
                            (pressed || deletingId === item.id) && styles.buttonPressed,
                          ]}
                        >
                          {deletingId === item.id ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.removeImageText}>Remove</Text>
                          )}
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.sectionDivider} />

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Video</Text>
                    <Text style={styles.sectionHint}>{videos.length} / {MAX_VIDEOS} video</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add donation video"
                    accessibilityState={{ disabled: isBusy || videos.length >= MAX_VIDEOS }}
                    disabled={isBusy || videos.length >= MAX_VIDEOS}
                    onPress={() => void selectMedia("video")}
                    style={({ pressed }) => [
                      styles.addButton,
                      (pressed || isBusy || videos.length >= MAX_VIDEOS) && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.addButtonText}>+ Add video</Text>
                  </Pressable>
                </View>

                {videos.length === 0 ? (
                  <View style={styles.emptyMediaBox}>
                    <Text style={styles.emptyMediaText}>No video added yet.</Text>
                  </View>
                ) : (
                  videos.map((item) => (
                    <View key={item.id} style={styles.videoCard}>
                      <View style={styles.videoIcon}>
                        <Text style={styles.videoIconText}>▶</Text>
                      </View>
                      <View style={styles.videoCopy}>
                        <Text style={styles.videoTitle}>Donation video</Text>
                        <Text style={styles.videoDate}>{formatBangladeshDate(item.created_at)}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove donation video"
                        disabled={isBusy}
                        onPress={() => confirmDelete(item)}
                        style={({ pressed }) => [
                          styles.removeVideoButton,
                          (pressed || deletingId === item.id) && styles.buttonPressed,
                        ]}
                      >
                        {deletingId === item.id ? (
                          <ActivityIndicator color="#455A64" size="small" />
                        ) : (
                          <Text style={styles.removeVideoText}>Remove</Text>
                        )}
                      </Pressable>
                    </View>
                  ))
                )}

                {uploadingLabel ? (
                  <View style={styles.uploadingBox}>
                    <ActivityIndicator color="#176B43" />
                    <Text style={styles.uploadingText}>{uploadingLabel}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalScreen: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(13, 36, 24, 0.46)" },
  modalCard: { maxHeight: "92%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#F7FAF7" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 22, paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: "#E3ECE5" },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#6A8374", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { marginTop: 4, color: "#173526", fontSize: 21, fontWeight: "800" },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F0EA" },
  closeButtonText: { color: "#31503E", fontSize: 26, fontWeight: "400", lineHeight: 28 },
  content: { padding: 22, paddingBottom: 34, gap: 15 },
  stateBox: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 12, borderRadius: 20, backgroundColor: "#FFFFFF" },
  stateText: { color: "#66786D", fontSize: 14 },
  errorBox: { gap: 8, borderRadius: 15, padding: 14, backgroundColor: "#F2F5F3", borderWidth: 1, borderColor: "#D5E0D8" },
  errorText: { color: "#27362D", fontSize: 14, lineHeight: 20 },
  retryText: { color: "#176B43", fontSize: 14, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionTitle: { color: "#173526", fontSize: 18, fontWeight: "800" },
  sectionHint: { marginTop: 3, color: "#66786D", fontSize: 13 },
  addButton: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#176B43" },
  addButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  emptyMediaBox: { alignItems: "center", borderRadius: 17, paddingVertical: 23, backgroundColor: "#FFFFFF" },
  emptyMediaText: { color: "#66786D", fontSize: 14 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  imageCard: { width: "47%", overflow: "hidden", borderRadius: 15, backgroundColor: "#FFFFFF" },
  image: { width: "100%", aspectRatio: 1.05, backgroundColor: "#E8F0EA" },
  removeImageButton: { minHeight: 39, alignItems: "center", justifyContent: "center", backgroundColor: "#455A64" },
  removeImageText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  sectionDivider: { height: 1, marginVertical: 5, backgroundColor: "#E1EAE3" },
  videoCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 17, padding: 14, backgroundColor: "#FFFFFF" },
  videoIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#E2F4E8" },
  videoIconText: { marginLeft: 2, color: "#176B43", fontSize: 16 },
  videoCopy: { flex: 1 },
  videoTitle: { color: "#173526", fontSize: 15, fontWeight: "800" },
  videoDate: { marginTop: 3, color: "#66786D", fontSize: 12 },
  removeVideoButton: { paddingVertical: 7, paddingLeft: 7 },
  removeVideoText: { color: "#455A64", fontSize: 13, fontWeight: "800" },
  uploadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 15, padding: 14, backgroundColor: "#EAF6EE" },
  uploadingText: { color: "#176B43", fontSize: 14, fontWeight: "700" },
  buttonPressed: { opacity: 0.55 },
});
