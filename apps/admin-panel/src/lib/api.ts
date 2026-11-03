import { WebSession } from "@marketplace/api-client";

export const webSession = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
);
