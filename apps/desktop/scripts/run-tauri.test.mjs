import assert from "node:assert/strict";
import test from "node:test";
import * as runTauri from "./run-tauri.mjs";

const { DEFAULT_DEMO_STOREFRONT_URL, validateStorefrontUrl } = runTauri;

test("defaults the demo storefront to the local Windows development server", () => {
  assert.equal(DEFAULT_DEMO_STOREFRONT_URL, "http://localhost:3000");
  assert.equal(validateStorefrontUrl(), "http://localhost:3000/");
});

test("accepts only the local demo origin and normalizes its path", () => {
  assert.equal(
    validateStorefrontUrl("http://LOCALHOST:3000/store/"),
    "http://localhost:3000/store/",
  );
  for (const url of [
    "http://shop.example.test/",
    "https://shop.example.test/",
    "http://localhost:3001/",
    "http://localhost.evil.test:3000/",
    "http://127.0.0.1:3000/",
    "http://[::1]:3000/",
    "http://user@localhost:3000/",
    "http://localhost:3000/?next=/admin",
    "http://localhost:3000/#fragment",
  ]) {
    assert.throws(() => validateStorefrontUrl(url));
  }
});
