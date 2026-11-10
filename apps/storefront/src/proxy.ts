import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createCspPolicy } from "./lib/csp-policy.mjs";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(18).toString("base64");
  const policy = createCspPolicy({
    nonce,
    requestUrl: request.url,
    apiUrl,
    assetUrl:
      process.env.ASSET_PUBLIC_READ_BASE ?? process.env.S3_PUBLIC_READ_BASE,
    development: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
