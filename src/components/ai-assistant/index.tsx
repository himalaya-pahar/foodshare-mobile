import { useCallback, useState } from "react";

import { useAuth } from "@/providers/auth-provider";

import { AiChatPanel } from "./ai-chat-panel";
import { AiFab } from "./ai-fab";
import { useAiChat } from "./use-ai-chat";

/**
 * Mounts the AI Assistant for approved users only.
 *
 * The chat hook (`useAiChat`) lives here in the always-mounted parent so its
 * state — messages, sessionId, in-flight controller — survives the panel
 * being closed and reopened. Only the Modal panel itself is lazy-mounted;
 * its `chat` prop is the live hook state, so reopening shows the previous
 * conversation and continues the same backend session.
 *
 * The FAB is conditionally rendered (not just hidden) so it can't intercept
 * phantom taps that pass through the panel's transparent backdrop on Android.
 */
export function AiAssistant() {
  const { status, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const handleUnauthorized = useCallback(() => {
    setOpen(false);
    void signOut();
  }, [signOut]);

  const chat = useAiChat({ onUnauthorized: handleUnauthorized });

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => {
    chat.cancelInflight();
    setOpen(false);
  }, [chat]);

  const isApproved =
    user?.status === "active" ||
    (!user?.status && user?.approval_status === "APPROVED");

  if (status !== "signedIn" || !isApproved) {
    return null;
  }

  return (
    <>
      {!open ? <AiFab onPress={handleOpen} /> : null}
      {open ? <AiChatPanel open onClose={handleClose} chat={chat} /> : null}
    </>
  );
}