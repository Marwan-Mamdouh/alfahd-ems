import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/core/auth/auth.store";
import type { ApiResponse } from "@/core/api/types";
import type { RefreshTokenResponseDto } from "@alfahd/types";
import {
  AUTH_CHANNEL,
  SESSION_EXPIRED_EVENT,
  SESSION_INVALIDATED_MESSAGE,
} from "@/core/auth/auth-events";
import { ENDPOINTS } from "@/core/api/endpoints";

export const api = axios.create({
  // Relative, so every browser call goes through the Next.js rewrite to the
  // dashboard's own origin. That is what makes the httpOnly refresh cookie
  // same-origin, and therefore readable by the proxy guard. A NEXT_PUBLIC_ value
  // would be inlined into the client bundle and leak the internal host.
  baseURL: "/api",
  // Required: without it the browser drops the refresh cookie and `/auth/refresh` 401s.
  withCredentials: true,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Paths that must not carry a bearer header — they establish or reset auth.
 *
 * A `Set` with exact matching, not `includes`: `endpoints.ts` is a large
 * forward-looking registry, and a substring test would silently exempt a future
 * path like `/reports/auth/login-audit`, producing a 401 that looks like an
 * expired session. An unmatched path fails loudly instead.
 */
const UNAUTHENTICATED_PATHS = new Set<string>([
  ENDPOINTS.auth.login,
  ENDPOINTS.auth.forgotPassword,
  ENDPOINTS.auth.resetPassword,
]);

const isAuthEndpoint = (url: string): boolean => UNAUTHENTICATED_PATHS.has(url);

interface RetryableConfig extends AxiosRequestConfig {
  /** Guards the refresh-and-retry path: a request is replayed after 401 at most once. */
  _retry?: boolean;
  /** Counts transient-failure replays for the GET-only auto-retry budget. */
  _getRetryCount?: number;
}

/**
 * Attach the in-memory access token to every request except the ones that
 * establish or reset auth.
 *
 * This interceptor did not exist before: the only place a bearer header was ever
 * set was inside the 401-retry path, so ordinary authenticated requests went out
 * unauthenticated and the server rejected them.
 */
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return config;

  const url = config.url ?? "";
  if (UNAUTHENTICATED_PATHS.has(url)) return config;

  config.headers.Authorization = `Bearer ${accessToken}`;

  return config;
});

/** At most one refresh in flight; concurrent 401s await the same promise. */
let refreshPromise: Promise<string> | null = null;

/** Backoff schedule for the GET-only auto-retry budget (FR-021), in ms. */
const GET_RETRY_DELAYS_MS = [300, 900];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exchange the `httpOnly` refresh cookie for a new access token.
 *
 * Sends an **empty body** — the cookie carries the token and the web client
 * cannot read it. The response is `{ accessToken }` and nothing else: there is no
 * `refreshToken` field and no rotation. Reading `refreshToken` off this response
 * writes `undefined` into the store and forces a logout on the second 401.
 */
async function refreshAccessToken(): Promise<string> {
  // Captured BEFORE the await: if clearSession() runs while the refresh is in
  // flight (logout here or in another tab), the epoch changes and the late
  // token must be discarded rather than resurrecting the ended session.
  const epoch = useAuthStore.getState().sessionEpoch;

  let accessToken: string;
  try {
    const { data } = await axios.post<ApiResponse<RefreshTokenResponseDto>>(
      ENDPOINTS.auth.refresh,
      {},
      { baseURL: "/api", withCredentials: true }
    );
    accessToken = data.data.accessToken;
  } catch {
    useAuthStore.getState().clearSession();
    throw new Error("Session expired");
  }

  if (useAuthStore.getState().sessionEpoch !== epoch) {
    throw new Error("Session ended during refresh");
  }

  // Refresh returns no profile, so keep the user we already have.
  useAuthStore.getState().setSession(accessToken, useAuthStore.getState().user);
  return accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    if (!original) return Promise.reject(error);

    const url = original.url ?? "";
    const is401 = error.response?.status === 401;
    const isUnauthenticatedPath = isAuthEndpoint(url);
    const isRefreshCall = url === ENDPOINTS.auth.refresh;

    // ── 401: single-flight refresh, then replay the request exactly once ──
    if (is401 && !original._retry && !isRefreshCall && !isUnauthenticatedPath) {
      original._retry = true;

      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });

        const newToken = await refreshPromise;
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };

        return api(original);
      } catch {
        // Refresh failed: the session is over. Propagate to this tab and every
        // other tab, then surface the original error.
        clearSessionAndBroadcast();
        return Promise.reject(error);
      }
    }

    // ── Transient-failure auto-retry: GET only (FR-021) ──
    // Never POST/PATCH/DELETE: replaying a mutation after a network timeout can
    // duplicate writes, and the backend has no idempotency key to make it safe.
    const method = (original.method ?? "get").toLowerCase();
    if (method !== "get") return Promise.reject(error);

    // A 401 that already spent its single refresh-and-replay must not be retried
    // again here: that replay used the same (dead) credentials, so further
    // attempts cannot succeed, and it would inflate one logical GET into 5 calls.
    if (is401) return Promise.reject(error);

    // Only transient failures are retried. A 4xx (403/404/400) is a settled
    // answer — replaying it only adds latency before showing the same result.
    const status = error.response?.status;
    if (status !== undefined && status < 500) return Promise.reject(error);

    const attempt = original._getRetryCount ?? 0;
    if (attempt >= GET_RETRY_DELAYS_MS.length) return Promise.reject(error);

    await sleep(GET_RETRY_DELAYS_MS[attempt]);
    original._getRetryCount = attempt + 1;

    return api(original);
  }
);

/**
 * Clear the store and tell every other tab to do the same.
 *
 * Broadcast rather than rely on the `storage` event: nothing is written to
 * `localStorage`, so no storage event is ever emitted and a `storage` listener
 * would silently never fire.
 */
export function clearSessionAndBroadcast(): void {
  useAuthStore.getState().clearSession();

  if (typeof window === "undefined") return;

  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage(SESSION_INVALIDATED_MESSAGE);
    // Close once the message is queued; a channel left open holds a listener.
    channel.close();
  } catch {
    // BroadcastChannel unavailable (old browser, insecure context). The same-tab
    // path below still fires; only cross-tab sync degrades.
  }

  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

/**
 * Revoke the server session and clear local state.
 *
 * The `httpOnly` cookie cannot be deleted from JavaScript — that is what
 * `httpOnly` means. It is cleared by the server's `Set-Cookie` on this response,
 * which is why logout must be a server call and not just `clearSession()`.
 */
export async function logout(): Promise<void> {
  try {
    await api.post(ENDPOINTS.auth.logout);
  } finally {
    // Clear local state even if the network call failed — the user asked to log
    // out, and leaving a token in memory would be worse than a lingering session.
    clearSessionAndBroadcast();
  }
}

export function unwrap<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data;
}
