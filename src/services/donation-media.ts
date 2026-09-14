import { fetch } from "expo/fetch";

import { apiRequest } from "@/lib/api";
import type {
  DonationMedia,
  DonationMediaContentType,
} from "@/types/donation-media";

type DonationMediaUploadUrl = {
  media_id: number;
  upload_url: string;
  expires_in: number;
};

export function getDonationMedia(
  donationId: number,
): Promise<DonationMedia[]> {
  return apiRequest<DonationMedia[]>(`/donations/${donationId}/media`);
}

export async function uploadDonationMedia(
  donationId: number,
  contentType: DonationMediaContentType,
  file: Blob,
  sortOrder: number,
): Promise<DonationMedia> {
  const upload = await apiRequest<DonationMediaUploadUrl>(
    `/donations/${donationId}/media/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content_type: contentType,
        sort_order: sortOrder,
      }),
    },
  );

  const uploadResponse = await fetch(upload.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Media upload failed. Please try again.");
  }

  return apiRequest<DonationMedia>(
    `/donation-media/${upload.media_id}/complete`,
    { method: "POST" },
  );
}

export function deleteDonationMedia(mediaId: number): Promise<void> {
  return apiRequest<void>(`/donation-media/${mediaId}`, {
    method: "DELETE",
  });
}
