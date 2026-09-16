export type UserRole = "RESTAURANT" | "NGO" | "ADMIN";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  organization_name?: string | null;
  phone?: string | null;
  address?: string | null;
  area?: string | null;
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
