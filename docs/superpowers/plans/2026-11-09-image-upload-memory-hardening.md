# Image Upload Memory Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Write tests first and verify each task before moving on.

**Goal:** Preserve the current image upload behavior while avoiding a full raw-pixel buffer allocation during decode.

**Architecture:** Keep the existing `AssetService.upload()` interface and S3/local storage adapters. Replace Sharp's collecting raw-buffer call with a full decode encoded as PNG and piped through a bounded writable sink; the sink discards chunks while Sharp reports oriented dimensions. Do not stream raw pixel output because fresh-process measurements showed it retained image-sized memory.

**Tech Stack:** Node.js 24.18.0, NestJS 12.2.0, Sharp 0.35.5, Jest 30.5.2, pnpm 12.14.0.

**Spec:** `docs/superpowers/specs/2026-11-09-image-upload-memory-design.md` (approved; target baseline `main@44abf5aaf40eb4ffcf49feb67fc5b5637cdb39a1`).

## Global Constraints

- Sync the implementation branch to the approved target baseline before changing code; the current workspace branch is 110 commits behind it.
- Preserve JPEG/PNG/WebP, the 5 MiB encoded-file ceiling, `limitInputPixels: 40_000_000`, EXIF rotation, and existing 422/415 error behavior.
- Store the original uploaded bytes; do not resize, transcode, or change asset metadata or public URLs.
- Preserve local-file cleanup and S3 compensation when persistence fails.
- Do not change Prisma schema, migrations, or OpenAPI contracts for this work.

## Review Focus

- A truncated image must return `422 INVALID_IMAGE` before writing an object or Asset row.
- A valid image must return dimensions after EXIF orientation and retain the original encoded bytes.
- A file over 5 MiB and MIME/signature mismatch must remain rejected before decode/storage.
- Images over 40,000,000 pixels must remain rejected; keep the accepted ceiling unchanged.
- Full decode must stream encoded PNG output into a discard sink; do not request raw pixel output or collect decoded output in a JavaScript `Buffer`.

---

### Task 1: Pin upload validation behavior

**Files:**
- Modify: `apps/api/test/asset-storage.spec.ts`
- Test: `apps/api/test/asset-storage.spec.ts`

**Interfaces:**
- Consumes: `AssetService.upload(userId, file, purpose, shopId?)`.
- Produces: assertions for metadata, original bytes, decoder rejection, and no side effects before successful decode.

- [x] **Step 1: Add regression cases**

  Add tests that assert a valid PNG returns its decoded width/height and writes bytes identical to the uploaded buffer; an EXIF-rotated JPEG returns oriented dimensions; a truncated PNG rejects with `INVALID_IMAGE` and creates neither a local file nor an Asset row; a MIME/signature mismatch rejects before persistence; and files over 5 MiB or 40,000,000 pixels are rejected.

- [x] **Step 2: Run the focused unit suite and record baseline**

  Run: `pnpm --filter @marketplace/api test --testPathPatterns=asset-storage.spec.ts`  
  Expected: existing cases pass; the new assertions establish the behavior that the streaming implementation must preserve. The memory property is verified separately in Task 3 because RSS thresholds are not stable enough for a CI assertion.

- [x] **Step 3: Commit the regression coverage**

  ```bash
  git add apps/api/test/asset-storage.spec.ts
  git commit -m "test(api): cover image decode rejection and metadata"
  ```

### Task 2: Stream encoded Sharp decode output

**Files:**
- Modify: `apps/api/src/modules/catalog/media/asset.service.ts`
- Test: `apps/api/test/asset-storage.spec.ts`

**Interfaces:**
- Consumes: the existing upload interface and Sharp's stream interface.
- Produces: the same dimensions or existing validation exception, without collecting decoded pixels.

- [x] **Step 1: Replace `.raw().toBuffer()` with a bounded encoded-output stream**

  Pipe `sharp(file.buffer, options).rotate().png()` to a `Writable` sink with a small `highWaterMark`; discard each encoded chunk and await `node:stream/promises` `pipeline()` completion. Capture width and height from Sharp's `info` event. Keep `failOn: "warning"` and `limitInputPixels: 40_000_000`. Do not call `.raw()`, `.toBuffer()`, or another output-collecting API. Do not start local or S3 storage until the pipeline completes successfully.

- [x] **Step 2: Run the focused unit suite**

  Run: `pnpm --filter @marketplace/api test --testPathPatterns=asset-storage.spec.ts`  
  Expected: PASS, including no Asset/object creation for corrupt image data and byte-for-byte preservation for valid uploads.

- [x] **Step 3: Commit the streaming decoder change**

  ```bash
  git add apps/api/src/modules/catalog/media/asset.service.ts apps/api/test/asset-storage.spec.ts
  git commit -m "fix(api): stream image decode output"
  ```

### Task 3: Verify memory and workspace behavior

**Files:**
- Verify: `apps/api/src/modules/catalog/media/asset.service.ts`
- Verify: `apps/api/test/asset-storage.spec.ts`

**Interfaces:**
- Consumes: the completed upload path from Tasks 1–2.
- Produces: reproducible evidence that the decoder no longer materializes a raw pixel buffer.

- [x] **Step 1: Run the API unit tests**

  Run: `pnpm --filter @marketplace/api test`  
  Expected: all API unit tests pass.

- [x] **Step 2: Inspect for raw-buffer collection and run one 40 MP smoke check**

  Confirm the decoder does not request `.raw()` or collect output with `.toBuffer()`. Run a generated 40,000,000-pixel solid PNG and a high-entropy JPEG under the 5 MiB limit through a fresh Node process importing the built `AssetService`; record baseline, peak and final RSS for each. Compare with a raw-output baseline, but do not add a fixed RSS threshold to CI. Record that native processing memory remains input-dependent.

- [x] **Step 3: Run workspace checks**

  Run: `pnpm lint:workspaces`, `pnpm typecheck`, `pnpm build`  
  Expected: all workspace tasks pass.

- [x] **Step 4: Record evidence**

  Add the focused unit, memory-smoke, lint, typecheck, and build results to `docs/testing/image-upload-memory-evidence.md`. Do not claim the change is verified without observed output.
