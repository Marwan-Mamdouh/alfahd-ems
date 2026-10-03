import type { UserDto } from '@alfahd/types';

import { api, unwrap } from '@/core/api/axios-instance';
import { ENDPOINTS } from '@/core/api/endpoints';
import { httpStatus } from '@/core/api/errors';
import type { ApiResponse } from '@/core/api/types';

/** Shared React Query key for `GET /users` — one cache entry, one fetch. */
export const USERS_QUERY_KEY = ['users'] as const;

/**
 * Fetch all users.
 *
 * `GET /users` is ADMIN-only and returns the full array with no pagination
 * (R10), so sorting and filtering happen client-side over this result.
 *
 * FR-026: on failure log the endpoint path and status code ONLY. Never the access
 * token, the refresh cookie, a submitted password, or the response body — the
 * body of `GET /users` contains every staff email address.
 */
export async function fetchUsers(): Promise<UserDto[]> {
  try {
    const response = await api.get<ApiResponse<UserDto[]>>(ENDPOINTS.settings.users);

    return unwrap(response);
  } catch (err) {
    console.error(`[users] GET ${ENDPOINTS.settings.users} failed`, { status: httpStatus(err) });
    throw err;
  }
}

