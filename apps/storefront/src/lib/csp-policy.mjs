function httpOrigin(value, label, development) {
  const url = new URL(value);
  if (
    (url.protocol !== "https:" && !(development && url.protocol === "http:")) ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error(
      `${label} must be a credential-free ${development ? "HTTP(S)" : "HTTPS"} URL`,
    );
  }
  return url.origin;
}

/** @typedef {{ nonce: string, requestUrl: string, apiUrl: string, assetUrl?: string, development: boolean }} CspPolicyOptions */

/** @param {CspPolicyOptions} options */
export function createCspPolicy({
  nonce,
  requestUrl,
  apiUrl,
  assetUrl,
  development,
}) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(nonce)) {
    throw new Error("CSP nonce contains invalid characters");
  }

  const pageUrl = new URL(requestUrl);
  httpOrigin(pageUrl.origin, "Storefront", development);
  const apiUrlValue = new URL(apiUrl);
  const apiOrigin = httpOrigin(apiUrl, "API", development);
  const assetOrigin = assetUrl
    ? httpOrigin(assetUrl, "Asset", development)
    : undefined;

  const connectSources = new Set(["'self'", apiOrigin]);
  if (development) {
    const loopbackHosts = new Set(["localhost", "127.0.0.1"]);
    if (
      loopbackHosts.has(pageUrl.hostname) &&
      loopbackHosts.has(apiUrlValue.hostname)
    ) {
      const apiAlias = new URL(apiOrigin);
      apiAlias.hostname =
        apiUrlValue.hostname === "localhost" ? "127.0.0.1" : "localhost";
      connectSources.add(apiAlias.origin);
    }

    const websocketProtocol = pageUrl.protocol === "https:" ? "wss:" : "ws:";
    connectSources.add(`${websocketProtocol}//${pageUrl.host}`);
  }

  const imageSources = new Set(["'self'", "data:", "blob:", apiOrigin]);
  if (assetOrigin) imageSources.add(assetOrigin);

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (development) scriptSources.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    // Existing buyer components use React style attributes for chart heights and grid ordering.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${[...imageSources].join(" ")}`,
    "font-src 'self'",
    "frame-src 'none'",
    `connect-src ${[...connectSources].join(" ")}`,
  ];

  if (!development) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}
