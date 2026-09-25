export type UserRole = "RESTAURANT" | "NGO" | "ADMIN";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type UserStatus =
  | "pending_email"
  | "pending_admin"
  | "active"
  | "rejected";

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  approval_status?: ApprovalStatus; // preserved for backwards compatibility
  organization_name?: string | null;
  phone?: string | null;
  address?: string | null;
  area?: string | null;
}

export interface VerifyEmailResponse {
  message: string;
  email_verified: boolean;
  status: UserStatus;
}

export interface ResendVerificationResponse {
  message: string;
}

export interface SignupRequest {
  full_name: string;
  email: string;
  password: string;
  role: Exclude<UserRole, "ADMIN">;
  organization_name?: string | null;
  phone?: string | null;
  address?: string | null;
  area?: string | null;
}

export type ProfileUpdate = {
  full_name: string;
  organization_name?: string | null;
  phone?: string | null;
  address?: string | null;
  area?: string | null;
};

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

