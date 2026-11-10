import { expect, test } from "@playwright/test";

function getNonce(contentSecurityPolicy: string | undefined): string {
  const nonce = contentSecurityPolicy?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce, "CSP should include a per-response script nonce").toBeTruthy();
  return nonce!;
}

test("storefront serves a strict nonce CSP and applies its nonce to the theme script", async ({
  page,
}) => {
  const firstResponse = await page.goto("/");
  expect(firstResponse).not.toBeNull();
  expect(firstResponse!.ok()).toBeTruthy();

  const firstPolicy = firstResponse!.headers()["content-security-policy"];
  const firstNonce = getNonce(firstPolicy);
  expect(firstPolicy).toContain("default-src 'self'");
  expect(firstPolicy).toContain(`'nonce-${firstNonce}'`);
  expect(firstPolicy).toContain("'strict-dynamic'");
  expect(firstPolicy).not.toContain("script-src 'self' 'unsafe-inline'");
  expect(firstPolicy).toContain("connect-src");

  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator("body")).toBeVisible();
  const themeScript = page.locator("head script:not([src])").first();
  await expect(themeScript).toHaveJSProperty("nonce", firstNonce);

  const secondResponse = await page.reload();
  expect(secondResponse).not.toBeNull();
  const secondNonce = getNonce(
    secondResponse!.headers()["content-security-policy"],
  );
  expect(secondNonce).not.toBe(firstNonce);
  await expect(page.locator("head script:not([src])").first()).toHaveJSProperty(
    "nonce",
    secondNonce,
  );
});
