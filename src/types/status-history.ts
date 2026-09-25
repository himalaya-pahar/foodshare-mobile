export type AuditEntityType = "DONATION" | "PICKUP_REQUEST";

export interface StatusHistoryItem {
  id: number;
  donation_id: number;
  pickup_request_id: number | null;
  actor_id: number;
  entity_type: AuditEntityType;
  action: string;
  old_status: string | null;
  new_status: string | null;
  note: string | null;
  created_at: string;
}

export type WorkflowStatus =
  | "PENDING"
  | "ACCEPTED"
  | "AVAILABLE"
  | "RESERVED"
  | "COLLECTED"
  | "COMPLETED";

export type JourneyStatus =
  | WorkflowStatus
  | "CANCELLED"
  | "EXPIRED"
  | "REJECTED"
  | "WITHDRAWN";

export interface HistoryFlow {
  donation_id: number;
  pickup_request_id: number | null;
  food_name: string | null;
  posted_at: string | null;
  donor_user_id?: number | null;
  donor_organization_name: string | null;
  receiver_user_id?: number | null;
  receiver_organization_name: string | null;
  current_status: JourneyStatus | null;
  status_timestamps: Partial<Record<JourneyStatus, string>>;
  quantity?: number | null;
  unit?: string | null;
  pickup_address?: string | null;
  pickup_area?: string | null;
  pickup_deadline?: string | null;
  prepared_at?: string | null;
  storage_notes?: string | null;
  allergen_info?: string | null;
  description?: string | null;
}
