"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthUser } from "@/core/api/types";
import { SESSION_COOKIE_NAME } from "@/core/auth/routes";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;

  setSession: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      // Set access & refresh tokens
      setSession: (accessToken, refreshToken) => {
        set({
          accessToken,
          refreshToken,
        });

        // Cookie used as a simple session flag for middleware
        document.cookie = `${SESSION_COOKIE_NAME}=1; path=/; max-age=604800; samesite=strict`;
      },

      // Set authenticated user
      setUser: (user) => {
        set({
          user,
        });
      },

      // Clear all authentication data
      clearSession: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        });

        // Remove session cookie
        document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=strict`;
      },
    }),
    {
      name: "fahd-auth",

      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

// Check if user is authenticated
export const selectIsAuthenticated = (state: AuthState) => Boolean(state.accessToken);

// Get current user role
export const selectRole = (state: AuthState) => state.user?.role;
