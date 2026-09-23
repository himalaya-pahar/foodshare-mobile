import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { askAi } from "@/services/ai";

import {
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
  type ChatStatus,
} from "./types";

const MAX_CONVERSATION_MESSAGES = 200;
const AI_REQUEST_TIMEOUT_MS = 90_000;

interface UseAiChatOptions {
  /** Called on 401 so the caller can bounce the user back to login. */
  onUnauthorized?: () => void;
}

interface SendOutcome {
  ok: boolean;
  validationMessage?: string;
}

export function useAiChat(options: UseAiChatOptions = {}) {
  const { onUnauthorized } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const lastUserTextRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Abort any in-flight request when the hook unmounts (e.g. panel closed
  // and PanelHost unmounted). Without this, a pending fetch would resolve
  // later and try to setState on an unmounted component.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const cancelInflight = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus((prev) => (prev === "sending" ? "idle" : prev));
  }, []);

  const reset = useCallback(() => {
    cancelInflight();
    setMessages([]);
    setSessionId(null);
    setStatus("idle");
    setError(null);
    lastUserTextRef.current = null;
  }, [cancelInflight]);

  const markUserBubbleFailed = useCallback(
    (messageId: string, errorMessage: string) => {
      setStatus("error");
      setError(errorMessage);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, failed: true } : m,
        ),
      );
    },
    [],
  );

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, message];
      if (next.length <= MAX_CONVERSATION_MESSAGES) return next;
      const overflow = next.length - MAX_CONVERSATION_MESSAGES;
      let dropCount = overflow;
      // If the first message is an assistant reply (orphan from a prior
      // cancellation), drop it first so we don't leave a reply without its
      // question.
      if (next[0].role === "assistant") dropCount += 1;
      return next.slice(dropCount);
    });
  }, []);

  const send = useCallback(
    async (text: string): Promise<SendOutcome> => {
      const trimmed = text.trim();

      if (trimmed.length === 0) {
        return { ok: false, validationMessage: "Message can't be empty." };
      }

      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        return {
          ok: false,
          validationMessage: `Message is too long (${trimmed.length}/${MAX_MESSAGE_LENGTH}).`,
        };
      }

      // Spam guard — ref-based so send() stays referentially stable.
      if (controllerRef.current) return { ok: false };

      setError(null);
      setStatus("sending");
      lastUserTextRef.current = trimmed;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        text: trimmed,
      };
      appendMessage(userMessage);

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const response = await askAi({
          message: trimmed,
          sessionId,
          signal: controller.signal,
          timeoutMs: AI_REQUEST_TIMEOUT_MS,
        });

        appendMessage({
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          text: response.answer,
          scope: response.scope_decision,
        });
        setSessionId(response.session_id);
        setStatus("idle");
        controllerRef.current = null;
        return { ok: true };
      } catch (err) {
        controllerRef.current = null;

        if (controller.signal.aborted) {
          setStatus("idle");
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
          return { ok: false };
        }

        if (err instanceof ApiError) {
          if (err.status === 401) {
            setStatus("idle");
            onUnauthorized?.();
            return { ok: false };
          }

          if (err.status === 422) {
            setStatus("idle");
            setError(err.message);
            setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
            return { ok: false, validationMessage: err.message };
          }

          markUserBubbleFailed(userMessage.id, err.message);
          return { ok: false };
        }

        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        markUserBubbleFailed(userMessage.id, message);
        return { ok: false };
      }
    },
    [sessionId, onUnauthorized, appendMessage, markUserBubbleFailed],
  );

  const retry = useCallback(async (): Promise<SendOutcome> => {
    const text = lastUserTextRef.current;
    if (!text) return { ok: false };

    setMessages((prev) => prev.filter((m) => !(m.role === "user" && m.failed)));

    return send(text);
  }, [send]);

  return {
    messages,
    sessionId,
    status,
    error,
    send,
    retry,
    reset,
    cancelInflight,
  };
}

export type UseAiChat = ReturnType<typeof useAiChat>;