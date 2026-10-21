# Work Breakdown Structure — Marketplace MVP

Planning baseline 2026-10-20; mọi hàng là công việc dự kiến, chưa hoàn thành.
Person-day (PD) = 8 giờ tập trung. Effort gồm lập trình/tài liệu và test tại task;
review chéo, họp, học tập và buffer được trừ riêng trong plan.md.
P0: chặn phụ thuộc/toàn vẹn/release; P1: bắt buộc MVP có thể xếp sau;
P2: cải thiện tùy chọn, không có P2 trong baseline này.
M1–M5 là vai trò giả định, không phải tên người. Reviewer không được là Owner.
Mỗi hàng là một ticket có thể giao; khi tách subtask, tổng estimate không tăng ngầm.
Dependencies là gate tích hợp/nghiệm thu; UI/mock/fixtures có thể chuẩn bị trước. Không nghiệm thu feature khi predecessor chưa đạt.
Task 3–4 PD UI có thể chia theo màn hình mà giữ AC và tổng effort.

| ID | Sprint | Nhóm | Task / mô tả | Owner | Reviewer | Priority | Difficulty | PD | Dependency | Deliverable | Acceptance Criteria | Test Cases chính |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W001 | 1 | Requirement Analysis | Chốt use case/BR theo actor | M1 | M3 | P0 | Medium | 2 | — | SRS + map FR01–50 | 50 FR có actor/AC; chốt expiry/cancel | Review 4 actor/nhánh lỗi |
| W002 | 1 | System Architecture | Public interfaces và auth trust boundaries | M1 | M2 | P0 | High | 2 | W001 | Module interfaces + ADR auth | Không import nội bộ chéo, mô tả web/native auth | Walkthrough ownership/logout |
| W003 | 1 | Database Design | ERD và bất biến checkout/khóa | M2 | M1 | P0 | High | 2.5 | W001 | ERD + ADR database/transaction | UUID/NUMERIC/FK; chống oversell/refund trùng | Tabletop 20 buyers/5 stock |
| W004 | 1 | Backend Infrastructure | DTO/OpenAPI auth/shop/catalog và mock examples | M2 | M4 | P0 | Medium | 2 | W002,W003 | Contract revision + fixtures | Ví dụ schema có 401/403/409/422 | Mock consumer smoke |
| W005 | 1 | Buyer Web | Wireframe hành trình mua/state UI | M3 | M4 | P1 | Medium | 3.5 | W001 | Buyer wireframes | 12 màn hình, đa shop, responsive/a11y | Walkthrough 360/1280 |
| W006 | 1 | Seller Center/Admin | Wireframe quản trị và Desktop reuse | M4 | M3 | P1 | Medium | 3.5 | W001,W002 | Seller/Admin wireframes + reuse ADR | 17 màn hình, scope shop/state rõ | Cross-shop UX review |
| W007 | 1 | Testing | Fixture và test matrix MVP | M5 | M2 | P0 | Medium | 2 | W001,W003 | Test Plan map SC01–10 | Có concurrency/idempotency/native matrix | Review 50 FR + 10 SC |
| W008 | 1 | Deployment | Toolchain, Mac/iOS access và storage/CI | M5 | M4 | P0 | Medium | 1.5 | W002 | Environment/budget evidence | Có đường build/test macOS/iOS và S3 | Kiểm chứng quyền truy cập tài nguyên |
| W009 | 2 | Authentication | User/Session/register/login | M1 | M2 | P0 | High | 2.5 | W003,W004,W017,W011 | Auth service + identity migration | Email unique, hash an toàn, phiên thu hồi được | Login đúng/sai/trùng email |
| W010 | 2 | Authentication | Rotation/logout/password và guards | M1 | M5 | P0 | High | 2 | W009 | RBAC/ownership/session adapters | Logout/khóa có hiệu lực, reuse bị chặn | CSRF/refresh reuse/cross-user |
| W011 | 2 | Backend Infrastructure | Nest shell/validation/error/Swagger/health | M2 | M1 | P0 | Medium | 2 | W004,W017 | API bootstrap + schema generation | Prefix v1, lỗi chuẩn, health DB | Invalid DTO/docs snapshot |
| W012 | 2 | Database Design | Address/default và seed nền tảng | M2 | M5 | P0 | Medium | 2 | W003,W011,W009 | Address migration + demo accounts | Tối đa 1 default, repeat seed không reset | FK/fresh migration/seed twice |
| W013 | 2 | Buyer Web | Storefront auth/profile/address và client | M3 | M1 | P0 | Medium | 4 | W005,W009,W010,W012 | Buyer account pages | Register→login→address→logout chạy thật | US1/validation/empty/error |
| W014 | 2 | Seller Center/Admin | Seller/Admin shells và route auth | M4 | M1 | P0 | Medium | 3.5 | W006,W009,W010 | Hai app shells + shop context | Sai vai trò không đọc dữ liệu | Admin deny Buyer/logout |
| W015 | 2 | Testing | Unit/integration/E2E identity harness | M5 | M1 | P0 | Medium | 2 | W009,W010,W012,W013 | Tests dùng PostgreSQL thật | Auth/address test chạy CI độc lập | US1/auth misuse |
| W016 | 2 | Deployment | Compose và CI lint/type/unit/build | M5 | M2 | P0 | Medium | 2 | W011,W017 | Local Compose + Actions | Fresh clone health, env test riêng | Restart persistence/CI fail gate |
| W017 | 2 | Monorepo Setup | pnpm/Turbo/strict TS/shared config | M2 | M3 | P0 | Medium | 0.5 | W002,W008 | Workspace baseline lockfile | Đúng apps/packages, compiler theo toolchain | Workspace dependency smoke |
| W018 | 3 | Shop Management | Membership/slug/profile/duyệt/khóa | M1 | M4 | P0 | High | 2.5 | W010,W012 | Shop API + migration | Đúng trạng thái/ownership, slug unique | US2/cross-shop/slug duplicate |
| W019 | 3 | Category Management | Cây danh mục/ẩn/audit | M1 | M2 | P0 | Medium | 1.5 | W010,W018 | Category API + audit | Không chu kỳ, ẩn chặn mua mới | Cycle/concurrent hide |
| W020 | 3 | Catalog | Product/variant/giá/SKU/images metadata | M2 | M1 | P0 | High | 2.5 | W018,W019 | Catalog API + migration | SKU unique/shop, snapshot không đổi | US3/price/foreign-shop |
| W021 | 3 | Inventory | Stock adjustment/version/ledger | M2 | M5 | P0 | High | 2 | W020 | Inventory API + ledger | Không âm, không lost update | Concurrent adjust/rollback |
| W022 | 3 | Buyer Web | Home/list/detail/public shop | M3 | M2 | P1 | Medium | 4 | W013,W020 | Buyer discovery slice | Chọn biến thể, hàng ẩn không công khai | US4/out-of-stock/hidden |
| W023 | 3 | Seller Center/Admin | Shop approval/category/product forms | M4 | M1 | P0 | High | 4 | W014,W018,W019,W020 | Seller/Admin catalog screens | Tạo shop→duyệt→đăng variant | Early E2E publish demo |
| W024 | 3 | Backend Infrastructure | S3 upload ownership/MIME/size | M5 | M2 | P0 | Medium | 2 | W008,W010,W020 | Upload adapter + finalize | JPEG/PNG/WebP <=5MB, đúng uploader | Oversize/MIME spoof/foreign object |
| W025 | 3 | Testing | Shop/catalog/upload policy regression | M5 | M1 | P0 | Medium | 2 | W018,W020,W021,W023,W024 | Integration/E2E suites | Khóa/ẩn không public, quyền đúng | US2–4/publish/cross-shop |
| W026 | 4 | Shopping Cart | Giỏ account/group/select/update | M1 | M3 | P0 | Medium | 2.5 | W020,W021 | Cart API + migration | Unique variant/cart, chỉ selected lines | US5.1/duplicate add/owner |
| W027 | 4 | Order Management | Order/payment contracts và state policies | M1 | M2 | P0 | High | 2 | W003,W026 | Contract freeze + policy tests | BR04–09 đủ nhánh/thẩm quyền | Invalid transition table/mocks |
| W028 | 4 | Search & Discovery | Keyword/filter/sort/pagination | M2 | M3 | P0 | Medium | 2 | W020,W019 | Search queries + indexes | Min active variant price, stable ties | US4/range/hidden category |
| W029 | 4 | Inventory | Checkout transaction/concurrency proof | M2 | M1 | P0 | High | 2 | W021,W027 | Transactional integration prototype | 20 buyer/5 stock không oversell | SC003/rollback/concurrent edit |
| W030 | 4 | Buyer Web | Search/filter/cart account integration | M3 | M2 | P0 | Medium | 4 | W022,W026,W028 | Discovery/cart hoàn chỉnh | Selected lines/tổng giỏ/login gate | US4/5.1/empty/error/a11y |
| W031 | 4 | Seller Center/Admin | Stock UI và order contract mocks | M4 | M2 | P0 | Medium | 4 | W023,W021,W027 | Inventory screen + order mocks | Stale conflict reload, shop scope rõ | Concurrent stock UX/mock schema |
| W032 | 4 | Buyer Mobile | Expo/navigation/secure login/discovery spike | M5 | M3 | P1 | Medium | 2 | W008,W010,W028 | Android/iOS thin client | Login→list, không token plain storage | Device session/network smoke |
| W033 | 4 | Testing | Schema drift CI và load baseline | M5 | M2 | P0 | Medium | 2 | W004,W028,W029 | Contract diff gate + 1000-product fixture | Breaking drift bị chặn, có p95 baseline | SC006 rehearsal/fixture review |
| W034 | 5 | Order Management | State machine/cancel/restore inventory | M1 | M2 | P0 | High | 2.5 | W027,W029,W035 | Transitions/cancel/audit API | All-or-nothing hủy tổng; hoàn tồn 1 lần | Partial cancel/retry10 |
| W035 | 5 | Checkout | Order/split/snapshot/idempotency | M2 | M1 | P0 | High | 2.5 | W026,W027,W029 | Order migrations + checkout API | Tạo đơn/trừ tồn/xóa giỏ nguyên tử | US5/SC003/004/price change |
| W036 | 5 | Mock Payment | COD/attempt/allocation/refund/expiry | M2 | M1 | P0 | High | 2 | W035 | Payment API + expiry scheduler | 15 phút, late success compensation, một settlement | US6/timeout/cancel races |
| W037 | 5 | Shipping Simulation | Shipment/events/fail/retry/return | M1 | M4 | P0 | High | 2 | W034,W036 | Shipping API + migration | Guard delivery/completion, return once | US7/late delivery/cancel |
| W038 | 5 | Buyer Web | Checkout/payment/order/cancel UI | M3 | M1 | P0 | High | 4 | W030,W035,W034,W036,W037 | Web multi-shop commerce | Hai shop COD/mock, không trùng tiền/đơn | US5–7/reconnect/retry |
| W039 | 5 | Seller Center/Admin | Order fulfillment/shipping controls | M4 | M1 | P0 | High | 4 | W031,W034,W037 | Seller process + Admin return UI | Chỉ phần shop mình, không arbitrary status | US7/failed delivery/return |
| W040 | 5 | Testing | Concurrency checkout/payment/cancel suite | M5 | M2 | P0 | High | 2.5 | W034,W035,W036,W037 | PostgreSQL race/regression tests | SC003/004, totals exact | 20 buyers/late event/crash |
| W041 | 5 | Deployment | Staging demo end-to-end mua/giao | M5 | M3 | P0 | Medium | 1.5 | W016,W038,W039,W040 | Commerce demo + logs | US1–7 không DB edit | Deploy smoke/persist reload |
| W042 | 6 | Admin Dashboard | User lock/order inquiry/audit API | M1 | M4 | P0 | Medium | 2 | W018,W034,W037 | Admin endpoints + revoke sessions | Khóa chặn login, không sửa transaction final | US9/direct unauthorized |
| W043 | 6 | Reviews & Ratings | Review unique/item + public/Seller list | M1 | M3 | P1 | Medium | 2 | W034,W037 | Review API + migration | Đúng Buyer/COMPLETED/1–5/một lần | US8.1/3/duplicate race |
| W044 | 6 | Seller Dashboard | Counts/revenue/day/month filters | M2 | M4 | P1 | Medium | 2 | W034,W036 | Seller stats + indexes | Asia/Saigon, chỉ COMPLETED, scope shop | US8.2/midnight boundary |
| W045 | 6 | Admin Dashboard | System stats/reconciliation | M2 | M1 | P1 | Medium | 2 | W042,W044 | Admin stats + known fixtures | Không đếm kép Order/SellerOrder | SC008/refund known totals |
| W046 | 6 | Buyer Web | Review UX/a11y và Mobile integration support | M3 | M5 | P1 | Medium | 4 | W038,W043 | Web reviews + shared client updates | Đủ Buyer screens, a11y 360/1280 | US8/10/keyboard/form errors |
| W047 | 6 | Seller Center/Admin | Dashboard/reviews/ops final + Tauri shell | M4 | M5 | P1 | High | 4 | W039,W042,W043,W044,W045 | Ops web + Desktop login proof | Stats đúng, auth qua secure adapter | US8/9/Desktop login |
| W048 | 6 | Buyer Mobile | Detail/cart/checkout/order/account integration | M5 | M3 | P0 | High | 3 | W032,W035,W036,W037,W046 | Buyer Android/iOS core flows | US1/4–7, shared persistent data | Native payment/cancel/network |
| W049 | 6 | Testing | Cross-platform auth/contract smoke | M5 | M1 | P0 | Medium | 1 | W047,W048 | Native security report | Không plain token, scopes/CORS đúng | Native rotation/logout |
| W050 | 7 | Testing | Auth/upload/resource security hardening | M1 | M5 | P0 | High | 2.5 | W042,W049 | Threat tests + fixes | SC007, secrets redacted, rate limit | IDOR/CSRF/refresh reuse/upload spoof |
| W051 | 7 | Documentation | OpenAPI và use-case trace freeze | M1 | M4 | P1 | Low | 1.5 | W043,W045,W050 | API docs + FR matrix | 50 FR map endpoint/tests, no drift | Schema validation/examples smoke |
| W052 | 7 | Testing | Money/stock/state regression + query tuning | M2 | M1 | P0 | High | 3 | W040,W045 | Integrity/performance fixes + evidence | SC003/004/006/008 measured | DB races/p95/known money |
| W053 | 7 | Database Design | Migration/restore rehearsal + ADR update | M2 | M5 | P0 | Medium | 1 | W052 | Migration compatibility/recovery report | Không sửa migration shared, restore đúng | Fresh/upgrade/restore checks |
| W054 | 7 | Buyer Mobile | Native completion và 5-user usability | M3 | M5 | P0 | High | 4 | W046,W048,W043 | Mobile review/all screens + UX fixes | US8/10, SC005:4/5 trong 3 phút | Android/iOS purchase/a11y |
| W055 | 7 | Seller Desktop | Secure sessions/full Seller/Win+Mac build | M4 | M5 | P0 | High | 4 | W047,W049 | Desktop packages + platform evidence | US2/3/7/8 on Windows/macOS | Native logout/stock/fulfill/OS build |
| W056 | 7 | Testing | Full E2E/native matrix và triage | M5 | M3 | P0 | High | 2.5 | W050,W052,W054,W055 | Acceptance report + release blockers | SC001–009 measured or blocked explicitly | Cross-device/retry/permissions |
| W057 | 7 | Deployment | CI native release/backup drill | M5 | M2 | P0 | Medium | 1.5 | W016,W053,W055 | Release candidate pipeline | Secret protected, Win/Mac jobs, restore evidence | Artifacts smoke/rollback rehearsal |
| W058 | 8 | Documentation | Báo cáo SRS/use-case/architecture/security | M1 | M3 | P1 | Medium | 3 | W051,W056 | Final report chapters + diagrams | Tài liệu khớp code, nêu limitations | Peer consistency review |
| W059 | 8 | Database Design | Release migrations/seed/schema handover | M2 | M1 | P0 | Medium | 2 | W053,W056 | Final deterministic seed + schema | Fresh demo khớp totals/stock, repeat safe | US1–9/seed twice |
| W060 | 8 | Deployment | API release image và rollback support | M2 | M5 | P0 | Medium | 1 | W059,W057 | Versioned image/release notes | Pinned digest, health/readiness pass | Previous app/schema compatibility |
| W061 | 8 | Demo & Presentation | Demo script/slides/video/user guide | M3 | M4 | P1 | Medium | 3 | W054,W056,W058 | 15-min demo + fallback video | Hai shop/payment branches/review | New-user dry run/quickstart |
| W062 | 8 | Seller Desktop | Native artifacts verify + Seller/Admin guide | M4 | M3 | P0 | Medium | 3 | W055,W057,W056 | Win/Mac checksums + ops manual | Fresh target machine đúng quyền | Publish→stock→fulfill smoke |
| W063 | 8 | Deployment | HTTPS demo/env/secrets/backup/restore | M5 | M2 | P0 | High | 2 | W057,W059,W060 | Demo instance + deployment runbook | DB private, off-host backup, rollback tested | Health/persistence/restore |
| W064 | 8 | Demo & Presentation | Final acceptance/clean setup/handover | M5 | M1 | P0 | Medium | 1.5 | W061,W062,W063 | Acceptance matrix + limitations | SC010 <=30 phút sau prerequisites, zero P0 | Full demo/clean clone |

## Capacity totals

| Sprint | M1 | M2 | M3 | M4 | M5 | Total PD |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 | 4.5 | 3.5 | 3.5 | 3.5 | 19 |
| 2 | 4.5 | 4.5 | 4 | 3.5 | 4 | 20.5 |
| 3 | 4 | 4.5 | 4 | 4 | 4 | 20.5 |
| 4 | 4.5 | 4 | 4 | 4 | 4 | 20.5 |
| 5 | 4.5 | 4.5 | 4 | 4 | 4 | 21 |
| 6 | 4 | 4 | 4 | 4 | 4 | 20 |
| 7 | 4 | 4 | 4 | 4 | 4 | 20 |
| 8 | 3 | 3 | 3 | 3 | 3.5 | 15.5 |

Total planned: 157 PD. Không có thành viên vượt 4.5 PD/sprint.



## Coverage 22 nhóm công việc nguồn

Các nhãn chi tiết trong WBS có thể tách domain nhỏ hơn22 nhóm; mapping đầy đủ:

| Nhóm yêu cầu | Work packages |
| --- | --- |
| 1 Requirement Analysis | W001 |
| 2 System Architecture | W002, W006 |
| 3 Database Design | W003, W012, W020–021, W035–037, W043, W053, W059 |
| 4 Monorepo Setup | W017 |
| 5 Backend Infrastructure | W004, W011, W024 |
| 6 Authentication/Authorization | W009–010, W050 |
| 7 Shop Management | W018, W023 |
| 8 Category/Product Management | W019–020, W022–025, W028 |
| 9 Inventory | W021, W029, W031 |
| 10 Shopping Cart | W026, W030 |
| 11 Checkout/Order Management | W027, W034–035, W038–040 |
| 12 Mock Payment | W036, W038, W040 |
| 13 Shipping Simulation | W037, W039–040 |
| 14 Buyer Web | W005, W013, W022, W030, W038, W046 |
| 15 Seller Center | W006, W014, W023, W031, W039, W044, W047 |
| 16 Admin Dashboard | W006, W014, W023, W042, W045, W047 |
| 17 Buyer Mobile | W032, W046, W048–049, W054 |
| 18 Seller Desktop | W008, W047, W049, W055, W057, W062 |
| 19 Testing | W007, W015, W025, W029, W033, W040, W049–057 |
| 20 Deployment | W008, W016, W041, W057, W060, W063 |
| 21 Documentation | W001–008, W051, W053, W058–059, W061–064 |
| 22 Demo/Presentation | W041, W056, W061, W064 |

Reviews là feature bắt buộc FR40–42, được tách W043/W046/W054 dù không có nhãn riêng
trong22 nhóm nguồn; được nghiệm thu cùng Buyer/Seller/Testing. Không cộng lại effort theo
mapping này vì một task xuất hiện ở nhiều nhóm là cùng một work package.

