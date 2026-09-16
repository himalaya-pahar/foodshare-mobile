import { apiRequest } from "@/lib/api";
import type {
  DonationFeedItem,
  DonationInput,
  DonationUpdateInput,
  PickupRequest,
  PickupRequestInput,
} from "@/types/donation";
import type {
  PaginatedResponse,
  PaginationParams,
} from "@/types/pagination";

type AvailableDonationsQuery = PaginationParams & {
  area?: string;
};

export function getAvailableDonations(
  query: AvailableDonationsQuery = {},
): Promise<PaginatedResponse<DonationFeedItem>> {
  const params = new URLSearchParams({
    limit: String(query.limit ?? 10),
    offset: String(query.offset ?? 0),
  });

  const area = query.area?.trim();

  if (area) {
    params.set("area", area);
  }

  return apiRequest<PaginatedResponse<DonationFeedItem>>(
    `/donations/available?${params.toString()}`,
  );
}

function paginatedPath(path: string, query: PaginationParams): `/${string}` {
  const params = new URLSearchParams({
    limit: String(query.limit ?? 20),
    offset: String(query.offset ?? 0),
  });

  return `${path}?${params.toString()}` as `/${string}`;
}

export function getRestaurantDonations(
  query: PaginationParams = {},
): Promise<PaginatedResponse<DonationFeedItem>> {
  return apiRequest<PaginatedResponse<DonationFeedItem>>(
    paginatedPath("/donations/my", query),
  );
}

export function getDonationById(
  donationId: number,
): Promise<DonationFeedItem> {
  return apiRequest<DonationFeedItem>(`/donations/${donationId}`);
}

export function createDonation(
  donation: DonationInput,
): Promise<DonationFeedItem> {
  return apiRequest<DonationFeedItem>("/donations/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(donation),
  });
}

export function updateDonation(
  donationId: number,
  donation: DonationUpdateInput,
): Promise<DonationFeedItem> {
  return apiRequest<DonationFeedItem>(`/donations/${donationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(donation),
  });
}

export function cancelDonation(donationId: number): Promise<DonationFeedItem> {
  return apiRequest<DonationFeedItem>(`/donations/${donationId}/cancel`, {
    method: "POST",
  });
}

export function getDonationPickupRequests(
  donationId: number,
  query: PaginationParams = {},
): Promise<PaginatedResponse<PickupRequest>> {
  return apiRequest<PaginatedResponse<PickupRequest>>(
    paginatedPath(`/donations/${donationId}/pickup-requests`, query),
  );
}

export function createPickupRequest(
  donationId: number,
  request: PickupRequestInput,
): Promise<PickupRequest> {
  return apiRequest<PickupRequest>(
    `/donations/${donationId}/pickup-requests`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

export function getMyPickupRequests(
  query: PaginationParams = {},
): Promise<PaginatedResponse<PickupRequest>> {
  return apiRequest<PaginatedResponse<PickupRequest>>(
    paginatedPath("/pickup-requests/my", query),
  );
}

export function acceptPickupRequest(
  requestId: number,
): Promise<PickupRequest> {
  return apiRequest<PickupRequest>(`/pickup-requests/${requestId}/accept`, {
    method: "POST",
  });
}

export function rejectPickupRequest(
  requestId: number,
): Promise<PickupRequest> {
  return apiRequest<PickupRequest>(`/pickup-requests/${requestId}/reject`, {
    method: "POST",
  });
}

export function withdrawPickupRequest(
  requestId: number,
): Promise<PickupRequest> {
  return apiRequest<PickupRequest>(`/pickup-requests/${requestId}/withdraw`, {
    method: "POST",
  });
}

export function collectPickupRequest(
  requestId: number,
): Promise<PickupRequest> {
  return apiRequest<PickupRequest>(`/pickup-requests/${requestId}/collect`, {
    method: "POST",
  });
}

export function completeDonation(
  donationId: number,
): Promise<DonationFeedItem> {
  return apiRequest<DonationFeedItem>(`/donations/${donationId}/complete`, {
    method: "POST",
  });
}
