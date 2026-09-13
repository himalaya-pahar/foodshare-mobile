import { apiRequest } from "@/lib/api";
import type {
  AdminStats,
  AdminUser,
  ApprovalDecision,
  ApprovalUpdate,
} from "@/types/admin";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";

type AdminUsersQuery = PaginationParams & {
  q?: string;
};

function usersPath(
  path: "/admin/users" | "/admin/users/pending",
  query: AdminUsersQuery,
): `/${string}` {
  const params = new URLSearchParams();

  params.set("limit", String(query.limit ?? 20));
  params.set("offset", String(query.offset ?? 0));

  const search = query.q?.trim();
  if (search) {
    params.set("q", search);
  }

  return `${path}?${params.toString()}`;
}

export function getAdminUsers(
  query: AdminUsersQuery = {},
): Promise<PaginatedResponse<AdminUser>> {
  return apiRequest<PaginatedResponse<AdminUser>>(
    usersPath("/admin/users", query),
  );
}

export function getPendingUsers(
  query: AdminUsersQuery = {},
): Promise<PaginatedResponse<AdminUser>> {
  return apiRequest<PaginatedResponse<AdminUser>>(
    usersPath("/admin/users/pending", query),
  );
}

export function getAdminStats(): Promise<AdminStats> {
  return apiRequest<AdminStats>("/admin/stats");
}

export function updateUserApproval(
  userId: number,
  decision: ApprovalDecision,
): Promise<AdminUser> {
  const body: ApprovalUpdate = {
    approval_status: decision,
  };

  return apiRequest<AdminUser>(`/admin/users/${userId}/approval`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await apiRequest<unknown>(`/admin/users/${userId}`, {
    method: "DELETE",
  });
}
