import type { ChatSource, ScopeDecision } from "@/services/ai";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  scope?: ScopeDecision;
  sources?: ChatSource[];
  /**
   * True when the user bubble's matching assistant reply failed (network or
   * 5xx). The bubble renders an inline "Retry" affordance.
   */
  failed?: boolean;
}

export type ChatStatus = "idle" | "sending" | "error";

export const MAX_MESSAGE_LENGTH = 1000;
