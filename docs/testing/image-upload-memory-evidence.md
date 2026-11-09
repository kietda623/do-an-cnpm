# Image Upload Memory Hardening Evidence

## Environment

- Source baseline: `main@44abf5aaf40eb4ffcf49feb67fc5b5637cdb39a1`
- Runtime: Windows, Node.js `v24.21.0`, pnpm `12.14.0`, Sharp `0.35.5`
- The fresh-process smoke imports the built `AssetService`, uses its local-storage path and a fake asset repository, and deletes the temporary stored asset after each run. Fixture generation runs in a separate process.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Asset upload regressions | `corepack pnpm@12.14.0 --filter @marketplace/api test "--testMatch=**/*.spec.ts" "--testPathIgnorePatterns=test[/\\]integration" --testPathPatterns=asset-storage.spec.ts` | PASS, 1 suite / 11 tests |
| API unit suite | `corepack pnpm@12.14.0 --filter @marketplace/api test "--testMatch=**/*.spec.ts" "--testPathIgnorePatterns=test[/\\]integration"` | PASS, 19 suites / 98 tests |
| Workspace lint | `corepack pnpm@12.14.0 lint:workspaces` | PASS, 9 tasks |
| Workspace typecheck | `corepack pnpm@12.14.0 typecheck` | PASS, 9 tasks |
| Workspace build | `corepack pnpm@12.14.0 build` | PASS, 4 tasks |
| Decoder source scan | `rg -n '\.raw\(\)|\.toBuffer\(' apps/api/src/modules/catalog/media/asset.service.ts` | No matches |

The Jest commands include relative test globs because this Windows worktree lives under `.codex`; Jest's default absolute glob discovers zero tests from that path. No repository Jest configuration was changed.

## Fresh-process memory smoke

A 2 ms sampler tracked `process.memoryUsage().rss` after module loading and fixture loading, while a built `AssetService.upload()` decoded each image. These measurements are observations, not CI thresholds.

| Fixture | Encoded input | Dimensions | RSS before | Sampled peak | RSS after | Peak delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Solid PNG | 131,078 B | 5,000 × 8,000 | 95,719,424 B | 131,096,576 B | 97,464,320 B | 35,377,152 B |
| High-entropy JPEG | 3,414,417 B | 5,000 × 8,000 | 98,365,440 B | 228,229,120 B | 100,061,184 B | 129,863,680 B |

For comparison, before the refinement the same solid PNG through `AssetService` with raw output streaming reached 275,103,744 B from a 95,432,704 B baseline (179,671,040 B peak growth). A direct Sharp raw `.toBuffer()` run on the high-entropy JPEG reached 231,854,080 B from 56,553,472 B (175,300,608 B peak growth). The final PNG stream reduced peak growth by about 144 MB on the solid fixture and about 45 MB on the high-entropy fixture. The high-entropy case still uses substantial native working memory.

The final decoder streams temporary PNG-encoded output into a 64 KiB writable sink and discards it. It stores the exact original uploaded bytes. The smoke covers the built service path in a fresh Node process rather than booting the full Nest HTTP server. RSS sampling can miss short-lived spikes; native decoder memory also depends on image content.
