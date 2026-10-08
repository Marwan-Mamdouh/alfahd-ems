"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { UserDto } from "@alfahd/types";
import { api, unwrap } from "@/core/api/axios-instance";
import { ENDPOINTS } from "@/core/api/endpoints";
import type { ApiResponse } from "@/core/api/types";
import type { RefreshTokenResponseDto } from "@alfahd/types";
import { useAuthStore } from "@/core/auth/auth.store";
import { isPublicPath, loginUrlWithRedirect } from "@/core/auth/routes";
import { LoadingState } from "@/components/shared/states";

/**
 * Recover display fields from the access token's JWT payload.
 *
 * This is **not** a security check — the server already verified the token when
 * it issued it. It exists only because `POST /auth/refresh` returns
 * `{ accessToken }` and nothing else, and there is **no profile endpoint**: the
 * `auth.me` entry in `endpoints.ts` points at a route the backend does not
 * implement, so calling it 404s.
 *
 * The two tempting alternatives are both wrong: extending
 * `RefreshTokenResponseDto` with a `user` field would change a frozen contract
 * and break the mobile client, and calling `GET /auth/me` 404s.
 *
 * `createdAt` is not in the JWT either, so it is left empty here — the users
 * table renders the created-date column from `GET /users`, not from the store.
 */
function userFromToken(accessToken: string): UserDto | null {
  const [, payload] = accessToken.split(".");
  if (!payload) return null;

  try {
    // JWT payloads are base64url; `atob` needs standard base64.
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

    const { sub, email, role } = JSON.parse(atob(padded)) as {
      sub?: string;
      email?: string;
      role?: UserDto["role"];
    };

    if (!sub || !email || !role) return null;

    return { id: sub, email, role, isActive: true, createdAt: "" };
  } catch {
    return null;
  }
}

/**
 * Restore the session on mount.
 *
 * The access token lives in memory only, so a page reload starts with nothing.
 * This calls `POST /auth/refresh` exactly once per page load — the `httpOnly`
 * cookie carries the token — and rebuilds the store from the result.
 *
 * The `useRef` guard is essential: without it the restore would re-fire on
 * every re-render and produce a retry loop against `/auth/refresh`.
 */
export function SessionRestore({ children }: { children?: React.ReactNode }) {
  const isRestoring = useAuthStore((s) => s.isRestoring);
  const hasAttempted = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const restore = async () => {
      try {
        const epoch = useAuthStore.getState().sessionEpoch;
        // Empty body — the refresh token is in the cookie and cannot be read here.
        const response = await api.post<ApiResponse<RefreshTokenResponseDto>>(
          ENDPOINTS.auth.refresh,
          {}
        );

        const { accessToken } = unwrap(response);

        // A login completed or a logout happened while this was in flight — the
        // store already reflects a newer decision, so do not overwrite it.
        const state = useAuthStore.getState();
        if (state.sessionEpoch !== epoch || state.accessToken !== null) {
          state.setIsRestoring(false);
          return;
        }

        useAuthStore.getState().setSession(accessToken, userFromToken(accessToken));
      } catch {
        // No cookie, expired cookie, revoked session, or a transient network/5xx
        // failure. Clear THIS tab only. Never broadcast: a restore failure in one
        // tab says nothing about other tabs' sessions, and broadcasting here would
        // log out every open tab on a single network blip.
        useAuthStore.getState().clearSession();

        // Public pages (login, forgot-password, reset-password) must stay put — a
        // logged-out visitor is their expected audience. Only a protected page
        // needs to send the user to login, and it must keep the return path.
        const { pathname } = window.location;
        if (!isPublicPath(pathname)) {
          router.replace(loginUrlWithRedirect(pathname));
        }
      }
    };

    void restore();
  }, [router]);

  // Gate `children` behind the restore rather than rendering the loader beside
  // them. Pages fetch data on mount, and with no access token yet those calls
  // would 401 and trigger a second refresh — the exact flash and extra network
  // call this component exists to prevent.
  if (isRestoring) return <LoadingState label="جارٍ استعادة الجلسة..." />;

  return <>{children}</>;
}
