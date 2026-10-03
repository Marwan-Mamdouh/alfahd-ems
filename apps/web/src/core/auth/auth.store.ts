"use client";

import { create } from "zustand";
import type { UserDto } from "@alfahd/types";

/**
 * In-memory auth state.
 *
 * There is deliberately **no** `persist` middleware and no `document.cookie`
 * write. The access token lives here and nowhere else, so a successful XSS cannot
 * read it out of `localStorage` or `document.cookie`. The refresh token is never
 * held in JavaScript at all — it exists only in the `httpOnly` cookie the API
 * sets, which this code cannot read.
 */
interface AuthState {
  user: UserDto | null;
  accessToken: string | null;

  /** True while the mount-time refresh (see `SessionRestore`) is still in flight. */
  isRestoring: boolean;

  /** Incremented on every clearSession(). An async auth flow captures it before awaiting and aborts if it changed — the session ended mid-flight. */
  sessionEpoch: number;

  /**
   * Store an authenticated session.
   *
   * Two arguments, not three: the old signature took a `refreshToken` and
   * persisted it, which is exactly the exposure this feature removes. The login
   * response still carries `refreshToken` in its body for the mobile client —
   * the web client ignores it.
   */
  setSession: (accessToken: string, user: UserDto | null) => void;
  setUser: (user: UserDto) => void;
  setIsRestoring: (isRestoring: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  // Optimistic default: the app shows a loader until `SessionRestore` reports the
  // real outcome, so a reload does not flash the login screen.
  isRestoring: true,
  sessionEpoch: 0,

  setSession: (accessToken, user) => {
    set({ accessToken, user, isRestoring: false });
  },

  setUser: (user) => {
    set({ user });
  },

  setIsRestoring: (isRestoring) => {
    set({ isRestoring });
  },

  // Clear the store only. The `httpOnly` cookie cannot be removed from
  // JavaScript — that is the point of `httpOnly` — so it is cleared indirectly by
  // calling `POST /auth/logout`, which revokes the server session.
  clearSession: () => {
    set((s) => ({ user: null, accessToken: null, isRestoring: false, sessionEpoch: s.sessionEpoch + 1 }));
  },
}));

/** Check if user is authenticated */
export const selectIsAuthenticated = (state: AuthState) => Boolean(state.accessToken);

/** Get current user role */
export const selectRole = (state: AuthState) => state.user?.role;
