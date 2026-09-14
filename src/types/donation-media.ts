export const DONATION_MEDIA_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
] as const;

export type DonationMediaContentType =
  (typeof DONATION_MEDIA_CONTENT_TYPES)[number];

export type DonationMediaType = "IMAGE" | "VIDEO";

export interface DonationMedia {
  id: number;
  donation_id: number;
  media_type: DonationMediaType;
  media_url: string;
  sort_order: number;
  created_at: string;
}
