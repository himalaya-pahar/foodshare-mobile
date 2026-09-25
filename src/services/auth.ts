import { ApiError, apiRequest } from "../lib/api";
import {
  deleteAccessToken,
  getAccessToken,
  saveAccessToken,
} from "../lib/token-storage";
import type {
  LoginResponse,
  ProfileUpdate,
  ResendVerificationResponse,
  SignupRequest,
  User,
  VerifyEmailResponse,
} from "../types/auth";

export function signup(data: SignupRequest): Promise<User> {
  return apiRequest<User>("/signup", {
    method: "POST",
    authenticated: false,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

/**
 * Calls backend to verify user's email using the token received in the link.
 * GET /auth/verify-email?token=<token>
 */
export function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  return apiRequest<VerifyEmailResponse>(
    `/auth/verify-email?token=${encodeURIComponent(token.trim())}`,
    {
      method: "GET",
      authenticated: false,
    },
  );
}

/**
 * Requests a new verification email with rate limiting/cooldown.
 * POST /auth/resend-verification
 */
export function resendVerificationEmail(
  email: string,
): Promise<ResendVerificationResponse> {
  return apiRequest<ResendVerificationResponse>("/auth/resend-verification", {
    method: "POST",
    authenticated: false,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export function getCurrentUser(): Promise<User> {
  return apiRequest<User>("/users/me");
}

export function updateMyProfile(data: ProfileUpdate): Promise<User> {
  return apiRequest<User>("/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function login(
  email: string,
  password: string,
): Promise<User> {
  const form = new URLSearchParams();

  form.set("username", email.trim().toLowerCase());
  form.set("password", password);

  const response = await apiRequest<LoginResponse>("/login", {
    method: "POST",
    authenticated: false,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (
    typeof response?.access_token !== "string" ||
    !response.access_token ||
    typeof response.token_type !== "string" ||
    response.token_type.toLowerCase() !== "bearer"
  ) {
    throw new Error("The server returned an invalid login response.");
  }

  await saveAccessToken(response.access_token);

  try {
    return await getCurrentUser();
  } catch (error) {
    await deleteAccessToken();
    throw error;
  }
}

export async function restoreSession(): Promise<User | null> {
  const token = await getAccessToken();

  if (!token) {
    return null;
  }

  try {
    return await getCurrentUser();
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      await deleteAccessToken();
      return null;
    }

    // Keep the token when a temporary network/server failure occurs.
    throw error;
  }
}

export function logout(): Promise<void> {
  return deleteAccessToken();
}
