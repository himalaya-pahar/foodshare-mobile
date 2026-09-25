import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
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

import LogoutButton from "@/components/logout-button";
import { useAuth } from "@/providers/auth-provider";
import {
  getMyProfileImage,
  uploadProfileImage,
} from "@/services/profile-image";
import type {
  ApprovalStatus,
  ProfileUpdate,
  User,
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

function displayUserStatus(user: User): string {
  if (user.status === "active" || user.approval_status === "APPROVED") {
    return "Approved";
  }
  if (user.status === "pending_email") {
    return "Pending email verification";
  }
  if (user.status === "pending_admin" || user.approval_status === "PENDING") {
    return "Pending approval";
  }
  if (user.status === "rejected" || user.approval_status === "REJECTED") {
    return "Rejected";
  }
  return "Active";
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

type EditForm = {
  fullName: string;
  organizationName: string;
  phone: string;
  area: string;
  address: string;
};

function formFromUser(user: User): EditForm {
  return {
    fullName: user.full_name,
    organizationName: user.organization_name ?? "",
    phone: user.phone ?? "",
    area: user.area ?? "",
    address: user.address ?? "",
  };
}

function ProfileEditModal({
  user,
  onClose,
  onSave,
}: {
  user: User;
  onClose: () => void;
  onSave: (data: ProfileUpdate) => Promise<void>;
}) {
  const [form, setForm] = useState<EditForm>(() => formFromUser(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const fullName = form.fullName.trim();

    if (fullName.length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        full_name: fullName,
        organization_name: form.organizationName.trim() || null,
        phone: form.phone.trim() || null,
        area: form.area.trim() || null,
        address: form.address.trim() || null,
      });
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update your profile.",
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
              <Text style={styles.modalEyebrow}>EDIT PROFILE</Text>
              <Text style={styles.modalTitle}>Keep your details current</Text>
            </View>
            <Pressable disabled={saving} onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Full name *</Text>
              <TextInput value={form.fullName} onChangeText={(fullName) => setForm((value) => ({ ...value, fullName }))} style={styles.editInput} placeholder="Your name" placeholderTextColor="#87968C" />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Organization name</Text>
              <TextInput value={form.organizationName} onChangeText={(organizationName) => setForm((value) => ({ ...value, organizationName }))} style={styles.editInput} placeholder="Your organization" placeholderTextColor="#87968C" />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Phone number</Text>
              <TextInput value={form.phone} onChangeText={(phone) => setForm((value) => ({ ...value, phone }))} keyboardType="phone-pad" style={styles.editInput} placeholder="Your phone number" placeholderTextColor="#87968C" />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Area</Text>
              <TextInput value={form.area} onChangeText={(area) => setForm((value) => ({ ...value, area }))} style={styles.editInput} placeholder="e.g. Dhanmondi" placeholderTextColor="#87968C" />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Address</Text>
              <TextInput value={form.address} onChangeText={(address) => setForm((value) => ({ ...value, address }))} multiline textAlignVertical="top" style={[styles.editInput, styles.editMultiline]} placeholder="Your address" placeholderTextColor="#87968C" />
            </View>
            {error ? <Text style={styles.editError}>{error}</Text> : null}
            <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.saveProfileButton, (pressed || saving) && styles.photoButtonPressed]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveProfileText}>Save profile</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

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
                {displayUserStatus(user)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
            <Text style={styles.sectionTitle}>Your information</Text>
          </View>
          <Pressable onPress={() => setEditingProfile(true)} style={styles.editProfileButton}>
            <Text style={styles.editProfileText}>Edit profile</Text>
          </Pressable>
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

      {editingProfile ? (
        <ProfileEditModal
          user={user}
          onClose={() => setEditingProfile(false)}
          onSave={updateProfile}
        />
      ) : null}
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
    gap: 20,
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
  hero: {
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EBE7",
    shadowColor: "#173526",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatarButton: {
    borderRadius: 38,
  },
  avatarPressed: {
    opacity: 0.82,
  },
  avatar: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#CBE4D4",
    borderRadius: 36,
    backgroundColor: "#E4F2E8",
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#F2F7F4",
    borderWidth: 1,
    borderColor: "#D2E2D7",
  },
  photoButtonPressed: {
    opacity: 0.72,
  },
  photoButtonText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "700",
  },
  photoError: {
    marginTop: 10,
    color: "#D32F2F",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  photoMessage: {
    marginTop: 10,
    color: "#176B43",
    fontSize: 13,
    fontWeight: "700",
  },
  heroLabel: {
    marginTop: 16,
    color: "#6F8276",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  name: {
    marginTop: 6,
    color: "#17251B",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  email: {
    marginTop: 4,
    color: "#5F7367",
    fontSize: 14,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#E4F2E8",
    borderWidth: 1,
    borderColor: "#C6E4D1",
  },
  roleBadgeText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "800",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F4F7F4",
    borderWidth: 1,
    borderColor: "#DCE6DF",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#20844F",
  },
  statusText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  sectionLabel: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: "#173526",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  editProfileButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#E1F0E5",
  },
  editProfileText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "800",
  },
  detailsCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#173526",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  field: {
    gap: 5,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2EE",
  },
  fieldLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    color: "#75867C",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  fieldValue: {
    color: "#203B2B",
    fontSize: 16,
    lineHeight: 23,
  },
  logoutSection: {
    gap: 12,
    marginTop: 8,
  },
  logoutHint: {
    color: "#6B7D71",
    fontSize: 14,
    lineHeight: 21,
  },
  modalScreen: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(13, 36, 24, 0.5)",
  },
  modalCard: {
    maxHeight: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F7FAF7",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E3ECE5",
  },
  modalEyebrow: {
    color: "#6A8374",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  modalTitle: {
    marginTop: 4,
    color: "#173526",
    fontSize: 22,
    fontWeight: "800",
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "#E8F0EA",
  },
  closeButtonText: {
    color: "#31503E",
    fontSize: 26,
    lineHeight: 28,
  },
  editContent: {
    gap: 16,
    padding: 22,
    paddingBottom: 36,
  },
  editField: {
    gap: 8,
  },
  editLabel: {
    color: "#3A5244",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  editInput: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: "#D6E2D9",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#1E3829",
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },
  editMultiline: {
    minHeight: 90,
    paddingTop: 14,
  },
  editError: {
    borderRadius: 14,
    padding: 14,
    color: "#27362D",
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: "#F2F5F3",
    borderWidth: 1,
    borderColor: "#D5E0D8",
  },
  saveProfileButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#176B43",
    shadowColor: "#0D3B22",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  saveProfileText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
});
