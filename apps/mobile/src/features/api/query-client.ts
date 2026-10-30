import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@marketplace/api-client";
import {
  SessionChangedError,
  SessionStorageError,
} from "@marketplace/api-client/auth/expo-session";

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (
    error instanceof SessionChangedError ||
    error instanceof SessionStorageError
  )
    return false;
  if (error instanceof ApiClientError)
    return error.status >= 500 && failureCount < 2;
  if (error instanceof DOMException && error.name === "AbortError")
    return false;
  return error instanceof TypeError && failureCount < 2;
}

export function createMobileQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const mobileQueryClient = createMobileQueryClient();
