import assert from "node:assert/strict";
import test from "node:test";
import { createConfigOverride, validateStorefrontUrl } from "./run-tauri.mjs";

test("accepts an HTTPS storefront URL and preserves its path", () => {
  assert.equal(
    validateStorefrontUrl("https://shop.example.test/store", {
      development: false,
    }),
    "https://shop.example.test/store",
  );
});

test("normalizes the URL and rejects credentials, query, and fragment", () => {
  assert.equal(
    validateStorefrontUrl("https://SHOP.example.test:443/store/", {
      development: false,
    }),
    "https://shop.example.test/store/",
  );
  for (const url of [
    "https://user@shop.example.test/",
    "https://shop.example.test/?next=/admin",
    "https://shop.example.test/#fragment",
  ]) {
    assert.throws(() => validateStorefrontUrl(url, { development: false }));
  }
});

test("rejects non-HTTPS production origins and nonstandard HTTPS ports", () => {
  for (const url of [
    "",
    "http://shop.example.test/",
    "https://shop.example.test:8443/",
    "https://localhost/",
    "https://localhost./",
    "https://127.0.0.2/",
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "file:///tmp/storefront",
  ]) {
    assert.throws(() => validateStorefrontUrl(url, { development: false }));
  }
  assert.throws(() => validateStorefrontUrl(undefined, { development: false }));
});

test("allows only the local HTTP storefront during explicit development", () => {
  assert.equal(
    validateStorefrontUrl("http://localhost:3000/", { development: true }),
    "http://localhost:3000/",
  );
  assert.equal(
    validateStorefrontUrl("http://127.0.0.1:3000/", { development: true }),
    "http://127.0.0.1:3000/",
  );
  for (const url of [
    "http://shop.example.test/",
    "http://localhost:3001/",
    "http://localhost.evil.test:3000/",
    "http://[::1]:3000/",
  ]) {
    assert.throws(() => validateStorefrontUrl(url, { development: true }));
  }
});

test("passes the validated remote URL into Tauri's frontend configuration", () => {
  assert.deepEqual(createConfigOverride("dev", "http://localhost:3000/"), {
    build: {
      frontendDist: "http://localhost:3000/",
      devUrl: "http://localhost:3000/",
    },
  });
  assert.deepEqual(
    createConfigOverride("build", "https://shop.example.test/"),
    {
      build: { frontendDist: "https://shop.example.test/" },
    },
  );
  assert.throws(() =>
    createConfigOverride("preview", "https://shop.example.test/"),
  );
});
