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

export interface DonationSummary {
  id: number;
  status: DonationStatus;
}

export interface PickupRequestSummary {
  id: number;
  status: PickupRequestStatus;
}