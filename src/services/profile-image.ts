import { fetch } from "expo/fetch";

import { apiRequest } from "@/lib/api";
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

export async function uploadProfileImage(
  contentType: ProfileImageContentType,
  file: Blob,
): Promise<ProfileImage> {
  const upload = await apiRequest<ProfileImageUploadUrl>(
    "/profile-image/upload-url",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content_type: contentType }),
    },
  );

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
