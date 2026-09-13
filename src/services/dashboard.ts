import { apiRequest } from "@/lib/api";
import type {
  DonationSummary,
  PickupRequestSummary,
} from "@/types/dashboard";
import type { PaginatedResponse, PaginationParams } from "@/types/pagination";

function pagePath(
  path: "/donations/my" | "/pickup-requests/my",
  query: PaginationParams,
): `/${string}` {
  const params = new URLSearchParams({
    limit: String(query.limit ?? 20),
    offset: String(query.offset ?? 0),
  });

  return `${path}?${params.toString()}`;
}

export function getMyDonations(
  query: PaginationParams = {},
): Promise<PaginatedResponse<DonationSummary>> {
  return apiRequest<PaginatedResponse<DonationSummary>>(
    pagePath("/donations/my", query),
  );
}

export function getMyPickupRequests(
  query: PaginationParams = {},
): Promise<PaginatedResponse<PickupRequestSummary>> {
  return apiRequest<PaginatedResponse<PickupRequestSummary>>(
    pagePath("/pickup-requests/my", query),
  );
}
