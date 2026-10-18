import type { Response } from 'supertest';

/**
 * Helper to unwrap and type the response body, avoiding manual casting in test assertions.
 */
export function typedBody<T>(res: Response): T {
  return res.body as T;
}

/**
 * Unwrap the standard API envelope: { data: T }.
 */
export function envelopeData<T>(res: Response): T {
  return (res.body as { data: T }).data;
}
