export type DonationStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "COLLECTED"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type PickupRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "COLLECTED";

export interface DonationFeedItem {
  id: number;
  restaurant_id: number;
  food_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  prepared_at: string;
  pickup_deadline: string;
  pickup_area: string;
  pickup_address: string;
  storage_notes: string | null;
  allergen_info: string | null;
  status: DonationStatus;
  created_at: string;
  updated_at: string;
}

export type DonationInput = {
  food_name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  prepared_at: string;
  pickup_deadline: string;
  pickup_area: string;
  pickup_address: string;
  storage_notes?: string | null;
  allergen_info?: string | null;
};

export type DonationUpdateInput = Partial<DonationInput>;

export interface PickupRequest {
  id: number;
  donation_id: number;
  ngo_id: number;
  ngo_organization_name?: string | null;
  ngo_full_name?: string | null;
  estimated_pickup_at: string;
  message: string | null;
  status: PickupRequestStatus;
  requested_at: string;
  updated_at: string;
}

export type PickupRequestInput = {
  estimated_pickup_at: string;
  message?: string | null;
};
