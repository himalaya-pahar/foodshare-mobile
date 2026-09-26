import { fetch } from "expo/fetch";

import { ApiError, apiRequest } from "@/lib/api";
import type {
  ProfileImage,
  ProfileImageContentType,
} from "@/types/profile-image";

type ProfileImageUploadUrl = {
  image_id: number;
  upload_url: string;
  expires_in: number;
};

export function getMyProfileImage(): Promise<ProfileImage | null> {
  return apiRequest<ProfileImage | null>("/profile-image/me");
}

export function deleteProfileImage(imageId: number): Promise<void> {
  return apiRequest<void>(`/profile-image/${imageId}`, {
    method: "DELETE",
  });
}

export async function removeMyProfileImage(
  knownImageId?: number | null,
): Promise<void> {
  let id = knownImageId;
  if (!id) {
    const existing = await getMyProfileImage();
    id = existing?.id;
  }
  if (!id) {
    return;
  }
  await deleteProfileImage(id);
}

export async function uploadProfileImage(
  contentType: ProfileImageContentType,
  file: Blob,
  existingImageId?: number | null,
): Promise<ProfileImage> {
  if (existingImageId) {
    try {
      await deleteProfileImage(existingImageId);
    } catch {
      // Best-effort cleanup, proceed to upload request
    }
  }

  let upload: ProfileImageUploadUrl;
  try {
    upload = await apiRequest<ProfileImageUploadUrl>(
      "/profile-image/upload-url",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content_type: contentType }),
      },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const existing = await getMyProfileImage();
      if (existing?.id) {
        await deleteProfileImage(existing.id);
        upload = await apiRequest<ProfileImageUploadUrl>(
          "/profile-image/upload-url",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content_type: contentType }),
          },
        );
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const uploadResponse = await fetch(upload.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Photo upload failed. Please try again.");
  }

  return apiRequest<ProfileImage>(
    `/profile-image/${upload.image_id}/complete`,
    { method: "POST" },
  );
}

