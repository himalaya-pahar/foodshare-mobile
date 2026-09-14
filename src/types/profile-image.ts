export const PROFILE_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProfileImageContentType =
  (typeof PROFILE_IMAGE_CONTENT_TYPES)[number];

export interface ProfileImage {
  id: number;
  user_id: number;
  media_url: string;
  created_at: string;
  updated_at: string;
}
