import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/core/auth/auth.store";
import type { ApiResponse, LoginResponse } from "@/core/api/types";
import { SESSION_EXPIRED_EVENT } from "@/core/auth/auth-events";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setSession } = useAuthStore.getState();

  if (!refreshToken) throw new Error("No refresh token");

  try {
    const { data } = await axios.post<ApiResponse<LoginResponse>>(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
      { refreshToken }
    );

    setSession(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    useAuthStore.getState().clearSession();
    throw new Error("Session expired");
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    const is401 = error.response?.status === 401;
    const isRefreshCall = original?.url?.includes("/auth/refresh");
    const isLoginCall = original?.url?.includes("/auth/login");

    if (!is401 || !original || original._retry || isRefreshCall || isLoginCall) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const newToken = await refreshPromise;
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
      return api(original);
    } catch {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      return Promise.reject(error);
    }
  }
);

export function unwrap<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data;
}
