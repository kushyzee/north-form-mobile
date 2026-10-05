/**
 * Error types for the mobile API layer. Four distinct failure modes are kept
 * separate so callers can react appropriately:
 *
 * - `ApiError`            the server returned a non-2xx response with the
 *                         `{ error: { code, message } }` envelope
 * - `NetworkError`        no HTTP response was received at all
 * - `InvalidResponseError` a 2xx response whose body did not match the contract
 * - `UnauthenticatedError` there was no session to send a bearer token with
 */

import type { KnownCartErrorCode } from '@/lib/cart-schema';

export type ApiErrorCode = KnownCartErrorCode | (string & {});

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Could not reach the server. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class InvalidResponseError extends Error {
  constructor(message = 'The server returned an unexpected response.') {
    super(message);
    this.name = 'InvalidResponseError';
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = 'You must be signed in to do that.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Safe message for any error reaching the UI. Prefers the server's
 * customer-safe text; otherwise falls back to a status-appropriate default.
 * Never surfaces raw proxy/HTML response bodies or JSON parse exceptions.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHENTICATED') return 'Please sign in again.';
    return error.message;
  }
  if (error instanceof NetworkError) return error.message;
  if (error instanceof UnauthenticatedError) return error.message;
  if (error instanceof InvalidResponseError) return error.message;
  return 'Something went wrong. Please try again.';
}