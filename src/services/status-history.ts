import { apiRequest } from "@/lib/api";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";
import type { HistoryFlow, StatusHistoryItem } from "@/types/status-history";

function paginatedPath(path: string, query: PaginationParams): `/${string}` {
  const params = new URLSearchParams({
    limit: String(query.limit ?? 20),
    offset: String(query.offset ?? 0),
  });

  return `${path}?${params.toString()}` as `/${string}`;
}

export function getMyDonationHistory(): Promise<StatusHistoryItem[]> {
  return apiRequest<StatusHistoryItem[]>("/donations/my/history");
}

export function getDonationFlows(
  query: PaginationParams = {},
): Promise<PaginatedResponse<HistoryFlow>> {
  return apiRequest<PaginatedResponse<HistoryFlow>>(
    paginatedPath("/history/donations", query),
  );
}

export function getPickupFlows(
  query: PaginationParams = {},
): Promise<PaginatedResponse<HistoryFlow>> {
  return apiRequest<PaginatedResponse<HistoryFlow>>(
    paginatedPath("/history/pickups", query),
  );
}

export function getDonationHistory(
  donationId: number,
  query: PaginationParams = {},
): Promise<PaginatedResponse<StatusHistoryItem>> {
  return apiRequest<PaginatedResponse<StatusHistoryItem>>(
    paginatedPath(`/donations/${donationId}/history`, query),
  );
}

export function getMyPickupHistory(
  query: PaginationParams = {},
): Promise<PaginatedResponse<StatusHistoryItem>> {
  return apiRequest<PaginatedResponse<StatusHistoryItem>>(
    paginatedPath("/pickup-requests/my/history", query),
  );
}

export function getPickupRequestHistory(
  requestId: number,
): Promise<StatusHistoryItem[]> {
  return apiRequest<StatusHistoryItem[]>(
    `/pickup-requests/${requestId}/history`,
  );
}
