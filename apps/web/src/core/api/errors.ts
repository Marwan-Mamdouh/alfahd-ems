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
