import { apiRequest } from "@/lib/api";

/**
 * Three possible scope decisions returned by POST /ai/chat.
 * - in_domain:     grounded answer (may or may not have sources).
 * - out_of_domain: question wasn't about FoodShare; answer is a polite refusal.
 * - no_evidence:   question was on-topic but the knowledge base was too thin;
 *                  answer is a safe-fallback message.
 */
export type ScopeDecision = "in_domain" | "out_of_domain" | "no_evidence";

export interface ChatSource {
  document: string;
  section: string;
}

export interface ChatResponse {
  session_id: string;
  answer: string;
  sources: ChatSource[];
  scope_decision: ScopeDecision;
}

export interface AskAiInput {
  message: string;
  sessionId: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Sends a single message to the FoodShare AI Assistant.
 *
 * Auth: apiRequest attaches the JWT from SecureStore automatically
 * (default `authenticated: true`), so no extra headers are needed here.
 *
 * Cancellation: pass `signal` to abort an in-flight request (e.g. when the
 * chat panel is closed mid-reply).
 */
export function askAi({
  message,
  sessionId,
  signal,
  timeoutMs,
}: AskAiInput): Promise<ChatResponse> {
  return apiRequest<ChatResponse>("/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
    }),
    signal,
    timeoutMs,
  });
}
