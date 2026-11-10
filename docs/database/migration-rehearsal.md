# T149 — Migration và backup/restore rehearsal

- **Ngày chạy:** 2026-11-10
- **Phạm vi:** PostgreSQL migrations, các ràng buộc dữ liệu được test trong suite migration, và backup/restore sang database cô lập.
- **Môi trường:** Windows 11, Node.js 24.21.0, pnpm 12.14.0, Prisma 7.10.1, PostgreSQL/`pg_dump`/`pg_restore` 18.1.
- **Kết quả:** PASS trên PostgreSQL 18.1. Không cần corrective migration; không sửa migration đã commit.

## Cô lập dữ liệu

- Khởi tạo PostgreSQL cluster mới tại `%TEMP%\codex-t149-migration-rehearsal-pg`, chỉ bind `127.0.0.1`, cổng `55453`; xác thực `trust` chỉ áp dụng trong cluster tạm này.
- Tạo database chỉ dùng cho rehearsal: `t149_fresh_disposable`, `t149_upgrade_disposable`, `t149_restore_disposable`, và `t149_restore_snapshot_disposable`; tất cả chỉ nằm trong cluster tạm.
- Không dùng `DATABASE_URL` của ứng dụng, database T150, staging hoặc production. Integration helper nhận `TEST_DATABASE_URL` kèm confirmation khớp chính xác tên `_disposable`.
- PostgreSQL cài như Windows service ở cổng khác vẫn chạy độc lập; không kết nối hoặc thay đổi service/database đó.
- `pg_dump` chỉ chứa các fixture rehearsal giả. Dump và cluster data nằm ngoài repo trong `%TEMP%`; cluster đã được stop sau các kiểm tra.

## Kết quả quan sát

| Check | Kết quả |
| --- | --- |
| Cài dependencies theo lockfile | `corepack pnpm install --frozen-lockfile` — PASS, pnpm 12.14.0, không đổi lockfile. |
| Full repository unit suite | Sau `prisma:generate`, `corepack pnpm test` — Turbo 4/4 workspace tasks PASS; API 25/25 suites, 170 passed, 1 skipped; api-client, storefront và ui-web tests cũng PASS. Dùng giá trị RATE_LIMIT test-only theo CI; không dùng URL hoặc secret Redis thật. |
| Fresh install và deploy lặp lại | `database-migrations.spec.ts` — 1 suite / 6 tests PASS. Test reset đúng DB tạm, áp dụng 9 migrations (`0001`–`0009`), deploy lần nữa không có migration pending. |
| Migration status và schema parity | Fresh, upgrade source và restore target đều có 9 migrations đã hoàn tất, 0 hàng migration lỗi; `prisma migrate status` up to date và `prisma migrate diff --exit-code` không thấy khác biệt. `prisma:schema:check` PASS trên cả ba DB. |
| Integrity trên migration mới | Suite xác nhận actor/user FK, unique email/idempotency/default address, check address/asset/idempotency/payment, các partial unique/index thanh toán, JSON snapshot là array và snapshot `PaymentAttempt` không thể bị sửa. Backfill `0009` chạy lặp không tạo thêm hiệu ứng. |
| Upgrade từ phiên bản trước | Dùng thư mục migration tạm chỉ chứa `0001_shared`–`0008_reviews`. Prisma áp dụng đủ 8 migration. Thêm một MOCK order hết hạn có deadline hợp lệ, rồi chạy cấu hình migrations chính thức; Prisma chỉ áp dụng `0009_backfill_expired_order_status`. Kết quả: 9/9 applied, không có hàng lỗi, order thành `CANCELLED`, `version=1`; `migrate status` up to date. |
| Backup và restore | `pg_dump -Fc --no-owner --no-acl` tạo dump 130,640 bytes từ upgrade source; `pg_restore --exit-on-error --no-owner --no-acl` vào database restore mới. Source và restore có cùng summary: `9 migrations / 0 lỗi / 1 user / 1 order / 1 payment / 1 payment attempt / 406 constraints / 114 indexes / CANCELLED-v1 / snapshot []`. Restore giữ nguyên migration ledger và snapshot. |
| Integrity trên bản restore | Các probe cố chèn email sai chuẩn, email trùng, actor FK không tồn tại và sửa snapshot đều bị database từ chối. |

So sánh byte-by-byte giữa hai file `pg_dump --schema-only` không phù hợp trên PostgreSQL 18: dump có token `\restrict` được tạo ngẫu nhiên và PostgreSQL render biểu thức CHECK allowlist tương đương theo dạng khác sau restore. Vì vậy kết luận schema dựa trên `prisma migrate diff --exit-code`, `prisma:schema:check`, số lượng constraint/index và các probe thực thi; cả ba đều khớp. Đây không phải bằng chứng chạy trên PostgreSQL 17.11 của CI; PR CI cần xác nhận tương thích phiên bản đó.

## Lệnh chính đã chạy

```powershell
# Chỉ tạo cluster local riêng; không trỏ các lệnh này tới DB đang dùng bởi ứng dụng.
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$cluster = Join-Path $env:TEMP 'codex-t149-migration-rehearsal-pg'
$port = 55453
& "$pgBin\initdb.exe" -D $cluster -U postgres --auth-local=trust --auth-host=trust -E UTF8
& "$pgBin\pg_ctl.exe" -D $cluster -o "-h 127.0.0.1 -p $port" -l (Join-Path $cluster 'postgres.log') start

# Tạo fresh DB trước khi helper reset/deploy. Kiểm tra tên chưa tồn tại trong cluster mới.
& "$pgBin\createdb.exe" -h 127.0.0.1 -p $port -U postgres --template=template0 t149_fresh_disposable

# Helper kiểm tra hậu tố disposable và confirmation chính xác trước reset.
$env:TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55453/t149_fresh_disposable?schema=public'
$env:TEST_DATABASE_NAME_CONFIRMATION = 't149_fresh_disposable'
corepack pnpm --filter @marketplace/api prisma:generate
corepack pnpm --filter @marketplace/api test:integration --testPathPatterns=database-migrations.spec.ts

# Tạo 3 database còn lại trong cluster mới, sau khi xác nhận chúng chưa tồn tại.
foreach ($name in @('t149_upgrade_disposable', 't149_restore_disposable', 't149_restore_snapshot_disposable')) {
  & "$pgBin\createdb.exe" -h 127.0.0.1 -p $port -U postgres --template=template0 $name
}
```

Để mô phỏng upgrade, copy đúng tám thư mục migration `0001`–`0008` sang `$env:TEMP\t149-legacy-migrations-through-0008`; không copy `0009`. Tạo file tạm `apps/api/prisma.t149-legacy.config.ts`:

```ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: process.env.T149_LEGACY_MIGRATIONS_PATH! },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
```

```powershell
$legacyPath = Join-Path $env:TEMP 't149-legacy-migrations-through-0008'
New-Item -ItemType Directory -Path $legacyPath
$names = @('0001_shared', '0002_identity_assets', '0003_shops', '0004_catalog_inventory',
  '0005_cart_orders', '0006_payments', '0007_shipments', '0008_reviews')
foreach ($name in $names) {
  Copy-Item "apps/api/prisma/migrations/$name" $legacyPath -Recurse
}
$env:T149_LEGACY_MIGRATIONS_PATH = $legacyPath
$env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55453/t149_upgrade_disposable?schema=public'
Push-Location apps/api
corepack pnpm exec prisma migrate deploy --config prisma.t149-legacy.config.ts
# Query _prisma_migrations here: expect 8 finished rows.

$buyerSql = @'
INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
VALUES ('t149-upgrade@example.test', 'hash', 'T149 Upgrade Buyer');
'@
& "$pgBin\psql.exe" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres `
  -d t149_upgrade_disposable -c $buyerSql

# Use psql -c with this single SQL statement so both timestamps are identical.
$expiredOrderSql = @'
WITH t AS (SELECT transaction_timestamp() AS created_at)
INSERT INTO "marketplace_orders" (
  "buyer_user_id", "public_number", "recipient_snapshot", "payment_method",
  "original_total", "created_at", "payment_deadline"
)
SELECT u."id", 'T149-UPGRADE-EXPIRED', '{}'::jsonb, 'MOCK', 1000,
       t.created_at - interval '30 minutes', t.created_at - interval '15 minutes'
FROM "users" u CROSS JOIN t
WHERE u."email_normalized" = 't149-upgrade@example.test';
'@
& "$pgBin\psql.exe" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres `
  -d t149_upgrade_disposable -c $expiredOrderSql
corepack pnpm exec prisma migrate deploy --config prisma.config.ts
# Query ledger and fixture: expect 9 finished rows and CANCELLED/version 1.

# Add the payment snapshot fixture before taking the backup.
$snapshotSql = @'
INSERT INTO "payments" ("order_id", "method")
SELECT "id", 'MOCK'::"payment_method" FROM "marketplace_orders"
WHERE "public_number" = 'T149-UPGRADE-EXPIRED';
INSERT INTO "payment_attempts" (
  "payment_id", "attempt_number", "provider", "status",
  "target_seller_orders_snapshot", "amount", "operation_key"
)
SELECT p."id", 1, 'MOCK', 'FAILED', '[]'::jsonb, 1000, 'T149-upgrade-snapshot'
FROM "payments" p JOIN "marketplace_orders" o ON o."id" = p."order_id"
WHERE o."public_number" = 'T149-UPGRADE-EXPIRED';
'@
& "$pgBin\psql.exe" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres `
  -d t149_upgrade_disposable -c $snapshotSql
Pop-Location
```

Sau khi upgrade và tạo fixture xong, backup DB nguồn rồi restore vào DB đích trống. Tiếp theo kiểm tra migration status và schema parity trên fresh, upgrade, và restore DB; không reset database trong bước này:

```powershell
& "$pgBin\pg_dump.exe" -Fc --no-owner --no-acl -h 127.0.0.1 -p $port -U postgres `
  -d t149_upgrade_disposable -f (Join-Path $env:TEMP 't149-upgrade-with-snapshot.dump')
& "$pgBin\pg_restore.exe" --exit-on-error --no-owner --no-acl -h 127.0.0.1 -p $port -U postgres `
  -d t149_restore_snapshot_disposable (Join-Path $env:TEMP 't149-upgrade-with-snapshot.dump')

$dbNames = @('t149_fresh_disposable', 't149_upgrade_disposable', 't149_restore_snapshot_disposable')
foreach ($dbName in $dbNames) {
  $dbUrl = "postgresql://postgres@127.0.0.1:$port/$($dbName)?schema=public"
  $env:DATABASE_URL = $dbUrl
  $env:TEST_DATABASE_URL = $dbUrl
  $env:TEST_DATABASE_NAME_CONFIRMATION = $dbName
  Push-Location apps/api
  corepack pnpm exec prisma migrate status --config prisma.config.ts
  corepack pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code --config prisma.config.ts
  Pop-Location
  corepack pnpm --filter @marketplace/api prisma:schema:check
}
```

Fixture email `t149-upgrade@example.test` is inserted only in the new disposable DB. The following query compares migration history, representative rows, constraints/indexes and persisted snapshots between source and restored DB:

```powershell
$summarySql = @'
SELECT
  (SELECT count(*) FILTER (WHERE finished_at IS NOT NULL) FROM "_prisma_migrations"),
  (SELECT count(*) FILTER (WHERE logs IS NOT NULL) FROM "_prisma_migrations"),
  (SELECT count(*) FROM "users"),
  (SELECT count(*) FROM "marketplace_orders"),
  (SELECT count(*) FROM "payments"),
  (SELECT count(*) FROM "payment_attempts"),
  (SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace),
  (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
  (SELECT status::text || '/' || version::text FROM "marketplace_orders" WHERE public_number='T149-UPGRADE-EXPIRED'),
  (SELECT target_seller_orders_snapshot::text FROM "payment_attempts" WHERE operation_key='T149-upgrade-snapshot');
'@
$sourceSummary = & "$pgBin\psql.exe" -q -F '|' -h 127.0.0.1 -p $port -U postgres `
  -d t149_upgrade_disposable -Atc $summarySql
$restoreSummary = & "$pgBin\psql.exe" -q -F '|' -h 127.0.0.1 -p $port -U postgres `
  -d t149_restore_snapshot_disposable -Atc $summarySql
if (($sourceSummary -join '').Trim() -ne ($restoreSummary -join '').Trim()) {
  throw 'Source/restore summary mismatch'
}
```

The restore integrity probes use the following SQL; each nested block succeeds only when the copied FK, unique, check and snapshot immutability rules reject the invalid write:

```powershell
$probeSql = @'
DO $$
BEGIN
  BEGIN
    INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
    VALUES ('T149-UPGRADE@example.test', 'hash', 'Invalid normalized email');
    RAISE EXCEPTION 'check probe unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
    VALUES ('t149-upgrade@example.test', 'hash', 'Duplicate email');
    RAISE EXCEPTION 'unique probe unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "idempotency_records" ("actor_user_id", "actor_scope", "operation", "idempotency_key", "request_hash")
    VALUES (gen_random_uuid(), 'user:missing', 'restore.probe', 't149-missing-actor', repeat('a', 64));
    RAISE EXCEPTION 'foreign-key probe unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE "payment_attempts"
    SET "target_seller_orders_snapshot" = '[{"changed":true}]'::jsonb
    WHERE "operation_key" = 'T149-upgrade-snapshot';
    RAISE EXCEPTION 'snapshot probe unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'payment attempt target snapshot is immutable' THEN RAISE; END IF;
  END;
END
$$;
'@
```

Run it against the restore database using `psql -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p $port -U postgres -d t149_restore_snapshot_disposable -c $probeSql`. Never run `pg_restore --clean` against the source DB.

## Giới hạn

- Đây là rehearsal schema/backfill/restore trên cluster cùng máy, cùng major PostgreSQL; chưa đo RPO/RTO, mã hóa hay off-host backup.
- Test không bao phủ crash/power-loss trong restore, PostgreSQL 17.11, hay toàn bộ tiêu chí concurrency/checkout của ADR-0003.
- Các tiêu chí đó tiếp tục dựa vào các test/evidence theo task tương ứng; kết quả T149 không thay cho nghiệm thu phát hành.

## Dọn môi trường rehearsal

Sau khi `pg_ctl stop` đúng cluster tạm, chỉ xóa thư mục đã tạo tại `%TEMP%\codex-t149-migration-rehearsal-pg`, thư mục `$env:TEMP\t149-legacy-migrations-through-0008`, các file `t149-*` do rehearsal tạo trong `%TEMP%`, và file `apps/api/prisma.t149-legacy.config.ts` nếu đã tạo cho lần chạy đó. Xác nhận từng đường dẫn đúng chính xác rehearsal artifact trước khi xóa. Không chạy reset/drop/restore trên DB ngoài cluster này.
