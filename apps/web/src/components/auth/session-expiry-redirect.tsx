"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AUTH_CHANNEL,
  SESSION_EXPIRED_EVENT,
  SESSION_INVALIDATED_MESSAGE,
} from "@/core/auth/auth-events";
import { isPublicPath, loginUrlWithRedirect } from "@/core/auth/routes";
import { useAuthStore } from "@/core/auth/auth.store";

export function SessionExpiryRedirect() {
  const router = useRouter();

  useEffect(() => {
    const goToLogin = () => {
      const { pathname } = window.location;
      // Already on a public page: nothing to protect, and navigating would wipe
      // the page the user is using (e.g. a reset-password link).
      if (isPublicPath(pathname)) return;
      router.replace(loginUrlWithRedirect(pathname));
    };

    // Same-tab expiry: dispatched by the axios interceptor when a refresh fails.
    const handleSessionExpired = () => {
      goToLogin();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    // Cross-tab: another tab logged out, so this one must drop its token too.
    // Guarded because an unguarded `new BroadcastChannel` throws a ReferenceError
    // where the API is unavailable (older Safari, insecure context), and a throw
    // inside this effect would tear down the tree — taking the same-tab listener
    // above and `{children}` with it. Degrading cross-tab sync beats a white screen.
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(AUTH_CHANNEL);

    const handleBroadcast = (event: MessageEvent<unknown>) => {
      if (event.data !== SESSION_INVALIDATED_MESSAGE) return;

      useAuthStore.getState().clearSession();
      goToLogin();
    };

    channel.addEventListener("message", handleBroadcast);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      channel.removeEventListener("message", handleBroadcast);
      channel.close();
    };
  }, [router]);

  return null;
}
