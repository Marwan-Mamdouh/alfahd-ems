import axios from "axios";

/** HTTP status of a failed request, or `undefined` when no response arrived (network error). */
export function httpStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

/** `Retry-After` in whole seconds, or null when absent/invalid. */
export function retryAfterSeconds(err: unknown): number | null {
  if (!axios.isAxiosError(err)) return null;
  const seconds = Number(err.response?.headers?.["retry-after"]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** The server's `message` (string or class-validator array), or null. */
export function serverMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const message = (err.response?.data as { message?: unknown } | undefined)?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join("، ");
  return null;
}

/**
 * Extracts a user-facing error message from an API error (specifically for 409 Conflict and 400 validation blockers)
 * or a standard Error instance. Falls back to defaultMessage when no message is available.
 */
export function extractErrorMessage(err: unknown, defaultMessage: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(", ") : data.message;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return defaultMessage;
}

