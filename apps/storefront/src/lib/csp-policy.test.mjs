import assert from "node:assert/strict";
import test from "node:test";
import { createCspPolicy } from "./csp-policy.mjs";

function directives(policy) {
  return Object.fromEntries(
    policy
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

test("production CSP uses a nonce and excludes unsafe script execution", () => {
  const sourceMap = directives(
    createCspPolicy({
      nonce: "bm9uY2VWYWx1ZTEyMw==",
      requestUrl: "https://shop.example.test/",
      apiUrl: "https://api.example.test/api/v1",
      assetUrl: "https://cdn.example.test/bucket",
      development: false,
    }),
  );

  assert.ok(sourceMap["script-src"].includes("'nonce-bm9uY2VWYWx1ZTEyMw=='"));
  assert.ok(sourceMap["script-src"].includes("'strict-dynamic'"));
  assert.ok(!sourceMap["script-src"].includes("'unsafe-inline'"));
  assert.ok(!sourceMap["script-src"].includes("'unsafe-eval'"));
  assert.deepEqual(sourceMap["connect-src"], [
    "'self'",
    "https://api.example.test",
  ]);
  assert.ok(sourceMap["img-src"].includes("https://api.example.test"));
  assert.ok(sourceMap["img-src"].includes("https://cdn.example.test"));
  assert.ok(
    !sourceMap["img-src"].includes("https://cdn.example.test.evil.test"),
  );
  assert.ok(sourceMap["upgrade-insecure-requests"]);
});

test("development CSP permits eval and only its own development websocket", () => {
  const sourceMap = directives(
    createCspPolicy({
      nonce: "ZGV2Tm9uY2U0NTY=",
      requestUrl: "http://127.0.0.1:3100/",
      apiUrl: "http://localhost:4000/api/v1",
      development: true,
    }),
  );

  assert.ok(sourceMap["script-src"].includes("'unsafe-eval'"));
  assert.ok(sourceMap["connect-src"].includes("ws://127.0.0.1:3100"));
  assert.ok(!sourceMap["connect-src"].includes("ws:"));
  assert.ok(!sourceMap["upgrade-insecure-requests"]);
});

test("development CSP permits both loopback spellings for the API", () => {
  const aliases = [
    ["http://127.0.0.1:3100/", "http://localhost:4000/api/v1"],
    ["http://localhost:3100/", "http://127.0.0.1:4000/api/v1"],
  ];

  for (const [requestUrl, apiUrl] of aliases) {
    const sourceMap = directives(
      createCspPolicy({
        nonce: "ZGV2Tm9uY2U0NTY=",
        requestUrl,
        apiUrl,
        development: true,
      }),
    );

    assert.ok(sourceMap["connect-src"].includes("http://localhost:4000"));
    assert.ok(sourceMap["connect-src"].includes("http://127.0.0.1:4000"));
  }
});

test("rejects insecure production URLs, credentials, and invalid nonce characters", () => {
  assert.throws(() =>
    createCspPolicy({
      nonce: "bm9uY2VWYWx1ZTEyMw==",
      requestUrl: "https://shop.example.test/",
      apiUrl: "http://api.example.test/api/v1",
      development: false,
    }),
  );
  assert.throws(() =>
    createCspPolicy({
      nonce: "bm9uY2VWYWx1ZTEyMw==",
      requestUrl: "https://shop.example.test/",
      apiUrl: "https://user@api.example.test/",
      assetUrl: "https://user@cdn.example.test/",
      development: false,
    }),
  );
  assert.throws(() =>
    createCspPolicy({
      nonce: "bad nonce",
      requestUrl: "https://shop.example.test/",
      apiUrl: "https://api.example.test/",
      development: false,
    }),
  );
});
