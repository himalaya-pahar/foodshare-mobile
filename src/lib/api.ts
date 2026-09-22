import { getAccessToken } from "./token-storage";

const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!configuredUrl) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL is missing");
}

const API_BASE_URL = configuredUrl.trim().replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = Omit<RequestInit, "signal"> & {
  authenticated?: boolean;
  /**
   * Optional caller-provided AbortSignal. If the caller's signal is already
   * aborted, the request throws immediately. Otherwise the signal is forwarded
   * to `fetch` so callers (e.g. the AI chat hook) can cancel in-flight work.
   * The internal timeout below still applies.
   */
  signal?: AbortSignal;
  /**
   * Request timeout in milliseconds. Defaults to 30s. Pass a larger value for
   * slow endpoints like the AI assistant (retrieval + generation).
   */
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(data: unknown, status: number): string {
  if (isRecord(data)) {
    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item: unknown) =>
          isRecord(item) && typeof item.msg === "string"
            ? item.msg
            : "Invalid value",
        )
        .join("\n");
    }
  }

  return `Request failed (${status})`;
}

export async function apiRequest<T>(
  path: `/${string}`,
  options: ApiOptions = {},
): Promise<T> {
  const { authenticated = true, signal, timeoutMs = 30_000, ...requestOptions } = options;

  // Honor an already-aborted caller signal without making a network request.
  if (signal?.aborted) {
    throw new Error("Request was cancelled.");
  }

  const headers = new Headers(requestOptions.headers);

  headers.set("Accept", "application/json");

  if (authenticated) {
    const token = await getAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } else {
    headers.delete("Authorization");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller aborts, propagate it to our internal controller too.
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // Hosting errors may return HTML instead of JSON.
      }
    }

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(data, response.status),
        response.status,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (data === undefined) {
      throw new ApiError("Unexpected server response", response.status);
    }

    return data as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Request timed out. Please try again.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}