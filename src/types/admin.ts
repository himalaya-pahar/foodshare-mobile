import type { ApprovalStatus, UserRole, UserStatus } from "@/types/auth";

export type ApprovalDecision = "APPROVED" | "REJECTED";

export interface ApprovalUpdate {
  approval_status: ApprovalDecision;
}

export interface AdminUser {
  id: number;
  full_name: string;
  organization_name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  approval_status?: ApprovalStatus;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  pending_users: number;
  approved_users: number;
  restaurant_users: number;
  ngo_users: number;
}
