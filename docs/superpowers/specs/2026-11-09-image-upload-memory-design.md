# Image Upload Memory Hardening Design

**Status:** Approved
**Target baseline:** GitHub `main` at `44abf5aaf40eb4ffcf49feb67fc5b5637cdb39a1`. The current workspace branch is an ancestor of that baseline and must be synced before implementation.

## Intent

Prevent image uploads from allocating a full raw-pixel buffer in the API process while preserving the current upload contract and full image decode validation.

## Current behavior

`apps/api/src/modules/catalog/media/asset.service.ts` accepts JPEG, PNG and WebP files up to 5 MiB, validates their signature, and asks Sharp to decode up to 40 million pixels. The current `.raw().toBuffer()` materializes an RGBA buffer even though the caller only reads its dimensions. At 40 million pixels, the raw output is about 160 MB per upload before decoder overhead.

## Goals

- Preserve accepted MIME types, the 5 MiB file limit, the 40,000,000-pixel ceiling, stored original bytes, and returned metadata.
- Continue rejecting truncated or otherwise undecodable images before storing an Asset.
- Avoid materializing decoded pixels as one JavaScript `Buffer`.
- Preserve current S3 and local-storage rollback behavior.

## Non-goals

- Do not change the API contract, image formats, object keys, persisted dimensions, image transformations, or public URLs.
- Do not add an image processing service or resize user uploads.
- Do not change the 40-million-pixel ceiling without a separate product decision.

## Approaches

1. **Lower the pixel ceiling.** Simple and reduces memory, but rejects images the current implementation accepts and changes the established limit.
2. **Read only image metadata.** Avoids the large output buffer, but does not prove that the complete image can be decoded.
3. **Decode through a bounded stream and discard output.** Keeps full-decode validation and the existing ceiling while applying stream backpressure instead of retaining all raw pixels. **Selected.**

## Design

Keep validation in `AssetService`; replace the raw-buffer decode with a Sharp pipeline that applies EXIF orientation, encodes to PNG, then streams that encoded output into a bounded writable sink that discards it. Do not request raw pixel output: on the project's Sharp version, streaming raw output used memory comparable to collecting the raw pixels in a Buffer. Capture output width and height from the Sharp `info` event, and keep the original upload buffer as the bytes stored by the existing adapter. The temporary PNG is validation output only and is never stored. Maintain `limitInputPixels: 40_000_000`, `failOn: "warning"`, and EXIF orientation handling. The pipeline must finish successfully before either local or S3 storage begins.

### Verification-driven refinement

On 2026-11-09, a fresh-process 40 MP smoke comparison found that streaming `.raw()` output still raised peak RSS by about 182 MB, while streaming PNG-encoded output raised peak RSS by about 33 MB for a solid PNG fixture. A 40 MP high-entropy JPEG fixture under the 5 MiB upload limit measured about 133 MB peak growth through PNG streaming versus about 175 MB with raw `.toBuffer()`. The latter shows that PNG streaming removes the full collected raw output but cannot eliminate Sharp/libvips' native working memory for difficult inputs. The official [Sharp constructor documentation](https://sharp.pixelplumbing.com/api-constructor/) describes its supported compressed image stream formats and `info` event; the [output documentation](https://sharp.pixelplumbing.com/api-output/) states raw pixel data is only supported for buffer output.

Add focused unit coverage around `AssetService.upload` for valid decode metadata, invalid/truncated data, pixel-limit rejection, and cleanup/no persistence after decoder failure. A bounded-memory check must establish that the implementation no longer calls `.raw().toBuffer()`; a full-size image fixture may be used for a one-off verification if it can run within the available test memory budget.

## Acceptance criteria

- Valid JPEG, PNG, and WebP uploads still return the same metadata and store the original bytes.
- A corrupt or truncated image returns the existing validation error and leaves no object or Asset row behind.
- A file over 5 MiB, a MIME/signature mismatch, and an image above 40,000,000 pixels remain rejected.
- No raw-pixel output is requested or collected in the application layer.

## Calls left to the implementer

- Choose a Node writable sink that discards chunks and respects backpressure; stream encoded PNG output, not raw pixels, and do not use a collecting sink.
- Reuse the existing storage compensation paths and add tests at the current API test seam rather than restructuring the media module.
