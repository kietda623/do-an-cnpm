import { ApiClientError } from "@marketplace/api-client";

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    const payload = error.payload;
    if (typeof payload === "object" && payload !== null && "error" in payload) {
      const apiError = payload.error;
      if (
        typeof apiError === "object" &&
        apiError !== null &&
        "message" in apiError &&
        typeof apiError.message === "string"
      )
        return apiError.message;
    }
  }
  return fallback;
}
