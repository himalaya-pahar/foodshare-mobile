import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LogoutButton from "@/components/logout-button";
import { useAuth } from "@/providers/auth-provider";
import {
  getMyProfileImage,
  uploadProfileImage,
} from "@/services/profile-image";
import type {
  ApprovalStatus,
  UserRole,
} from "@/types/auth";
import type {
  ProfileImageContentType,
} from "@/types/profile-image";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const contentTypeByExtension: Record<
  string,
  ProfileImageContentType
> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type ProfileFieldProps = {
  label: string;
  value?: string | null;
  last?: boolean;
};

function displayRole(role: UserRole): string {
  if (role === "RESTAURANT") return "Restaurant";
  if (role === "NGO") return "NGO";
  return "Administrator";
}

function displayApprovalStatus(status: ApprovalStatus): string {
  if (status === "APPROVED") return "Approved";
  if (status === "PENDING") return "Pending approval";
  return "Rejected";
}

function getContentType(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  uri: string,
): ProfileImageContentType | null {
  const normalizedMimeType = mimeType?.toLowerCase();

  if (normalizedMimeType === "image/jpeg" || normalizedMimeType === "image/jpg") {
    return "image/jpeg";
  }

  if (normalizedMimeType === "image/png") return "image/png";
  if (normalizedMimeType === "image/webp") return "image/webp";

  const candidate = (fileName ?? uri)
    .split(/[?#]/)[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  return candidate ? contentTypeByExtension[candidate] ?? null : null;
}

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProfileField({
  label,
  value,
  last = false,
}: ProfileFieldProps) {
  return (
    <View style={[styles.field, last && styles.fieldLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>
        {value?.trim() || "Not provided"}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadProfileImage() {
        try {
          const image = await getMyProfileImage();

          if (active) {
            setProfileImageUrl(image?.media_url ?? null);
            setPhotoError(null);
          }
        } catch {
          if (active) {
            setPhotoError("Could not load your profile photo.");
          }
        }
      }

      void loadProfileImage();

      return () => {
        active = false;
      };
    }, []),
  );

  async function chooseProfilePhoto() {
    if (uploadingPhoto) return;

    setPhotoError(null);
    setPhotoMessage(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const contentType = getContentType(
        asset.mimeType,
        asset.fileName,
        asset.uri,
      );

      if (!contentType) {
        throw new Error("Choose a JPEG, PNG, or WebP image.");
      }

      if (
        typeof asset.fileSize === "number" &&
        asset.fileSize > MAX_PROFILE_IMAGE_BYTES
      ) {
        throw new Error(
          `This image is ${formatFileSize(asset.fileSize)}. Choose one smaller than 5 MB.`,
        );
      }

      const file = new File(asset.uri);

      if (!file.exists || file.size <= 0) {
        throw new Error("Could not read the selected image. Please try again.");
      }

      if (file.size > MAX_PROFILE_IMAGE_BYTES) {
        throw new Error(
          `This image is ${formatFileSize(file.size)}. Choose one smaller than 5 MB.`,
        );
      }

      setUploadingPhoto(true);

      const savedImage = await uploadProfileImage(contentType, file);

      setProfileImageUrl(savedImage.media_url);
      setPhotoMessage("Profile photo updated.");
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : "Could not update your profile photo.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (!user) return null;

  const initial = user.full_name.trim().charAt(0).toUpperCase() || "F";
  const photoButtonLabel = profileImageUrl
    ? "Change profile photo"
    : "Add profile photo";

  return (
    <SafeAreaView
      style={styles.screen}
      edges={Platform.OS === "android" ? ["top", "left", "right"] : []}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.brand}>FoodShare</Text>
        </View>

        <View style={styles.hero}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photoButtonLabel}
            accessibilityState={{ disabled: uploadingPhoto, busy: uploadingPhoto }}
            disabled={uploadingPhoto}
            onPress={() => void chooseProfilePhoto()}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && !uploadingPhoto && styles.avatarPressed,
            ]}
          >
            <View style={styles.avatar}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}

              {uploadingPhoto ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: uploadingPhoto, busy: uploadingPhoto }}
            disabled={uploadingPhoto}
            onPress={() => void chooseProfilePhoto()}
            style={({ pressed }) => [
              styles.photoButton,
              (pressed || uploadingPhoto) && styles.photoButtonPressed,
            ]}
          >
            <Text style={styles.photoButtonText}>
              {uploadingPhoto ? "Uploading photo…" : photoButtonLabel}
            </Text>
          </Pressable>

          {photoError ? (
            <Text style={styles.photoError} accessibilityRole="alert">
              {photoError}
            </Text>
          ) : null}

          {photoMessage ? (
            <Text style={styles.photoMessage}>{photoMessage}</Text>
          ) : null}

          <Text style={styles.heroLabel}>YOUR PROFILE</Text>
          <Text style={styles.name}>{user.full_name}</Text>
          <Text style={styles.email}>{user.email}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {displayRole(user.role)}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {displayApprovalStatus(user.approval_status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
          <Text style={styles.sectionTitle}>Your information</Text>
        </View>

        <View style={styles.detailsCard}>
          <ProfileField label="Full name" value={user.full_name} />
          <ProfileField
            label="Organization"
            value={user.organization_name}
          />
          <ProfileField label="Email address" value={user.email} last />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>CONTACT & LOCATION</Text>
          <Text style={styles.sectionTitle}>Where to reach you</Text>
        </View>

        <View style={styles.detailsCard}>
          <ProfileField label="Phone number" value={user.phone} />
          <ProfileField label="Area" value={user.area} />
          <ProfileField label="Address" value={user.address} last />
        </View>

        <View style={styles.logoutSection}>
          <Text style={styles.sectionLabel}>ACCOUNT SECURITY</Text>
          <Text style={styles.logoutHint}>
            Logging out removes your saved session from this device.
          </Text>
          <LogoutButton />
        </View>
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
    gap: 20,
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
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: "#174B36",
  },
  avatarButton: {
    borderRadius: 31,
  },
  avatarPressed: {
    opacity: 0.82,
  },
  avatar: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#DFF1E5",
    borderRadius: 31,
    backgroundColor: "#DFF1E5",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: "#176B43",
    fontSize: 36,
    fontWeight: "800",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23, 75, 54, 0.72)",
  },
  photoButton: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: "#2A644B",
  },
  photoButtonPressed: {
    opacity: 0.72,
  },
  photoButtonText: {
    color: "#E3F2E7",
    fontSize: 12,
    fontWeight: "800",
  },
  photoError: {
    marginTop: 10,
    color: "#FFD4CE",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  photoMessage: {
    marginTop: 10,
    color: "#D8F4E1",
    fontSize: 13,
    fontWeight: "700",
  },
  heroLabel: {
    marginTop: 18,
    color: "#B9DFC7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  name: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  email: {
    marginTop: 5,
    color: "#D7E9DC",
    fontSize: 14,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#2A644B",
  },
  roleBadgeText: {
    color: "#E3F2E7",
    fontSize: 12,
    fontWeight: "800",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#E3F2E7",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#176B43",
  },
  statusText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionHeader: {
    gap: 5,
    marginTop: 4,
  },
  sectionLabel: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#173526",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  detailsCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
  },
  field: {
    gap: 5,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E7EEE8",
  },
  fieldLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    color: "#75867C",
    fontSize: 12,
    fontWeight: "800",
  },
  fieldValue: {
    color: "#203B2B",
    fontSize: 16,
    lineHeight: 23,
  },
  logoutSection: {
    gap: 10,
    marginTop: 8,
  },
  logoutHint: {
    color: "#6B7D71",
    fontSize: 14,
    lineHeight: 21,
  },
});
