<!--
Sync Impact Report (temporary; remove before committing this amendment)
Version change: unratified scaffold → 1.0.0, initial adoption.
Modified principles: five unnamed scaffold slots replaced by nine source-derived principles:
architecture, source structure, database, marketplace, API, security, frontend, clean code, testing.
Added sections: Technology and Product Constraints; Development Workflow and Quality Gates;
project-specific Governance. Removed sections: none; illustrative scaffold comments removed.
Deferred placeholders: none. Templates and commands unchanged; read constitution at runtime.
Deferred execution: application/infrastructure implementation, tests, documentation and deployment
must proceed through follow-up specification, planning and tasks.
-->
# E-commerce Marketplace Constitution

Hiến chương này thông qua master prompt của chủ dự án. Các yêu cầu bắt buộc và điều cấm
là ràng buộc kiểm tra khi review; các mục ghi ưu tiên là hướng dẫn có thể đánh đổi nếu
nêu rõ lý do. Phạm vi sản phẩm và milestone bên dưới là định hướng cho đặc tả tiếp theo.

## Core Principles

### NGUYÊN TẮC KIẾN TRÚC

#### 3.1. Modular Monolith First

Sử dụng Modular Monolith cho backend.

Mỗi module phụ trách một domain nghiệp vụ riêng biệt:

- Identity
- Shop
- Catalog
- Inventory
- Cart
- Order
- Payment
- Shipping
- Review
- Admin

Mỗi module phải có trách nhiệm rõ ràng, hạn chế phụ thuộc chéo.

Không triển khai Microservices, Kafka, Kubernetes hoặc Event Sourcing nếu chưa có yêu cầu thực tế chứng minh sự cần thiết.

Phải thiết kế ranh giới module đủ rõ để có thể tách thành microservices trong tương lai.

#### 3.2. SOLID

Tuân thủ năm nguyên tắc SOLID:

- Single Responsibility: Mỗi class, service, function chỉ nên có một trách nhiệm chính.
- Open/Closed: Ưu tiên mở rộng hành vi thông qua abstraction phù hợp thay vì chỉnh sửa nhiều nơi.
- Liskov Substitution: Implementation phải tuân thủ hợp đồng của abstraction.
- Interface Segregation: Không tạo interface quá lớn buộc các thành phần phụ thuộc những phương thức không cần.
- Dependency Inversion: Các thành phần nghiệp vụ quan trọng không phụ thuộc trực tiếp vào chi tiết hạ tầng khi abstraction mang lại giá trị thực tế.

Không lạm dụng interface, abstraction hoặc design pattern với những chức năng CRUD đơn giản.

#### 3.3. DRY, KISS và YAGNI

DRY:
- Không lặp lại logic nghiệp vụ quan trọng.
- Trích xuất logic chung khi có sự trùng lặp thực sự.
- Không gộp những logic chỉ giống nhau về cú pháp nhưng khác bản chất nghiệp vụ.

KISS:
- Ưu tiên giải pháp đơn giản, rõ ràng và dễ đọc.
- Không viết thuật toán phức tạp nếu giải pháp đơn giản đáp ứng yêu cầu.

YAGNI:
- Không xây dựng tính năng chưa được yêu cầu.
- Không triển khai hạ tầng hoặc abstraction chỉ vì có thể cần trong tương lai.

### NGUYÊN TẮC CẤU TRÚC SOURCE CODE

Sử dụng Monorepo:

```text
ecommerce-platform/
├── apps/
│   ├── storefront/
│   ├── seller-center/
│   ├── admin-panel/
│   ├── mobile/
│   ├── desktop/
│   └── api/
├── packages/
│   ├── api-client/
│   ├── contracts/
│   ├── validation/
│   ├── ui-web/
│   ├── design-tokens/
│   └── config/
├── infra/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

Backend phải được tổ chức theo domain/module, không chia toàn bộ dự án thành các thư mục controller, service, repository khổng lồ.

Ví dụ:

```text
modules/
└── orders/
    ├── controllers/
    ├── services/
    ├── repositories/
    ├── dto/
    ├── enums/
    ├── orders.module.ts
    └── orders.service.spec.ts
```

Chỉ tạo thêm layer khi cần thiết.

Controller không chứa business logic.

Service không trực tiếp xử lý HTTP request hoặc response.

Repository phụ trách truy cập dữ liệu.

Không cho phép frontend truy cập trực tiếp database.

Không import mã nguồn nội bộ từ module khác theo đường dẫn tùy tiện; sử dụng public interface hoặc exported service.

### QUY TẮC DATABASE

PostgreSQL là nguồn dữ liệu chính (Single Source of Truth).

Các nguyên tắc bắt buộc:

1. Sử dụng UUID làm primary key.
2. Thiết lập foreign key rõ ràng.
3. Sử dụng DECIMAL/NUMERIC để lưu tiền; không dùng FLOAT.
4. Sử dụng transaction cho những thao tác cần tính nguyên tử.
5. Thiết kế index dựa trên các truy vấn thực tế.
6. Sử dụng unique constraint cho các thuộc tính cần duy nhất.
7. Có `created_at` và `updated_at` ở các bảng thích hợp.
8. Không xóa cứng dữ liệu giao dịch quan trọng.
9. Không thay đổi migration đã áp dụng lên môi trường dùng chung.
10. Mọi thay đổi schema phải có migration tương ứng.

Các module phải duy trì tính toàn vẹn dữ liệu.

Ví dụ:
- Không bán vượt tồn kho.
- Không cho Seller A sửa sản phẩm của Seller B.
- Không dùng giá sản phẩm từ request của client để thanh toán.
- Không thay đổi lịch sử giá của đơn hàng đã tạo.
- Không tạo trùng đơn hàng do request bị gửi lại.

Mỗi thay đổi database phải xem xét:
- Quan hệ dữ liệu.
- Constraints.
- Indexes.
- Migration.
- Khả năng tương thích với code hiện tại.

### QUY TẮC NGHIỆP VỤ MARKETPLACE

#### 6.1. Multi-Vendor

Hệ thống phải hỗ trợ nhiều cửa hàng độc lập.

Một tài khoản có thể sở hữu hoặc tham gia quản lý nhiều cửa hàng.

Mọi nghiệp vụ quản lý shop phải kiểm tra quyền theo shop cụ thể.

#### 6.2. Product

Một sản phẩm có thể có nhiều biến thể, ví dụ màu sắc và kích thước.

Mỗi biến thể có:
- SKU.
- Giá.
- Thuộc tính.
- Tồn kho riêng.

Không đồng nhất Product và ProductVariant.

#### 6.3. Order

Một lượt checkout có thể chứa sản phẩm từ nhiều cửa hàng.

Phải thiết kế:
- Order tổng.
- Seller Orders.
- Order Items.
- Payments.
- Shipments.

Đơn hàng tổng có thể có nhiều đơn hàng con.

Mỗi đơn hàng con được một shop xử lý riêng.

#### 6.4. Inventory

Phải chống tình trạng overselling.

Kiểm tra và cập nhật tồn kho bằng thao tác nguyên tử hoặc transaction có kiểm soát đồng thời.

Nếu dùng cơ chế giữ hàng, cần có quy tắc giải phóng tồn kho khi đơn hủy hoặc thanh toán thất bại/hết hạn.

#### 6.5. Payment

Trong MVP, sử dụng COD và Mock Payment.

Không xử lý dữ liệu thẻ ngân hàng thật.

Payment status phải độc lập với Order status.

Phải tránh xử lý trùng giao dịch bằng idempotency.

#### 6.6. Order State Machine

Chỉ cho phép chuyển trạng thái đơn hàng theo những quy tắc hợp lệ.

Ví dụ:

PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED → COMPLETED.

Cần xử lý các trường hợp:
- Hủy đơn.
- Thanh toán thất bại.
- Hoàn lại tồn kho.
- Seller từ chối đơn.
- Không đủ hàng.

Không được chuyển trạng thái tùy ý chỉ dựa vào giá trị client gửi lên.

### QUY TẮC API

Tuân thủ RESTful API và quy ước thống nhất.

Sử dụng prefix:

`/api/v1`

Nguyên tắc:

- GET: Truy vấn.
- POST: Tạo tài nguyên hoặc thực hiện hành động nghiệp vụ.
- PATCH: Cập nhật một phần.
- DELETE: Xóa khi phù hợp.

Sử dụng HTTP status code đúng ngữ nghĩa.

API phải có:
- DTO Validation.
- Authentication khi cần.
- Authorization.
- Pagination.
- Filtering.
- Sorting.
- Error handling.
- Swagger Documentation.

Không trả password hash, refresh token hoặc dữ liệu nhạy cảm trong API response.

Không trả stack trace nội bộ cho người dùng.

Áp dụng một cấu trúc lỗi thống nhất.

API client phải sử dụng contract hoặc type được sinh từ OpenAPI khi có thể.

### QUY TẮC BẢO MẬT

Áp dụng các thực hành bảo mật phù hợp với OWASP.

Bắt buộc:

- Hash mật khẩu bằng Argon2id hoặc giải pháp an toàn tương đương.
- Không lưu mật khẩu dạng plain text.
- Không hardcode secret.
- Cấu hình secret bằng environment variables hoặc secret manager.
- JWT Access Token có thời hạn ngắn.
- Refresh Token có cơ chế lưu trữ và thu hồi an toàn.
- Phân quyền tại backend, không chỉ ẩn nút trên frontend.
- Kiểm tra quyền truy cập theo tài nguyên.
- Validation toàn bộ input không tin cậy.
- Rate limiting cho các endpoint dễ bị lạm dụng.
- Cấu hình CORS phù hợp.
- Bảo vệ upload file bằng kiểm tra loại file, kích thước và quyền truy cập.
- Không ghi log password, token hoặc dữ liệu nhạy cảm.

Token storage phải được thiết kế riêng cho web, mobile và desktop theo đặc thù bảo mật từng nền tảng.

Mọi chức năng liên quan đến tiền, đơn hàng, tồn kho và quyền seller đều cần có các trường hợp kiểm thử bảo mật.

### QUY TẮC FRONTEND

#### 9.1. Component Design

Ưu tiên:
- Reusable Components.
- Component Composition.
- Separation of Concerns.
- Accessible UI.
- Responsive Design.

Không tạo component quá lớn chứa toàn bộ xử lý của một trang.

Không đặt business logic quan trọng trong UI component.

#### 9.2. State Management

Phân biệt:

- Server State: TanStack Query.
- Local UI State: React State.
- Shared Client State: Zustand khi thực sự cần.

Không sao chép server state sang global store nếu không cần thiết.

#### 9.3. UX

Mọi tính năng phải có các trạng thái:

- Loading.
- Success.
- Empty.
- Error.
- Unauthorized khi phù hợp.

Biểu mẫu cần hiển thị lỗi validation dễ hiểu.

Không chỉ thiết kế giao diện đẹp mà bỏ qua hành vi chức năng.

Ưu tiên UX riêng cho mobile thay vì sao chép giao diện desktop.

### QUY TẮC CLEAN CODE

Bắt buộc sử dụng TypeScript strict mode.

Không sử dụng `any` tùy tiện.

Tên biến, hàm, class và interface phải diễn đạt đúng ý nghĩa nghiệp vụ.

Ưu tiên tên tiếng Anh trong source code.

Các nguyên tắc:

- Function ngắn, có trách nhiệm rõ ràng.
- Không viết magic numbers khi chúng biểu diễn quy tắc nghiệp vụ.
- Không lạm dụng nested condition.
- Không sử dụng console.log làm hệ thống logging production.
- Không nuốt lỗi bằng empty catch.
- Không viết code trùng lặp không cần thiết.
- Không tạo dead code.
- Không comment những điều hiển nhiên.
- Comment giải thích lý do hoặc ràng buộc nghiệp vụ, không chỉ mô tả code.

Không refactor hàng loạt code không liên quan khi đang sửa một chức năng cụ thể.

### QUY TẮC TESTING

Mỗi chức năng nghiệp vụ quan trọng phải có test tương ứng.

Các loại kiểm thử:

##### Unit Test
Kiểm tra logic riêng lẻ:
- Tính tiền.
- Tính số lượng hàng khả dụng.
- Kiểm tra chuyển trạng thái đơn.
- Kiểm tra điều kiện áp dụng giảm giá.

##### Integration Test
Kiểm tra tương tác giữa:
- Service.
- Repository.
- Database.
- Transaction.

##### E2E Test
Kiểm tra luồng:
- Đăng ký.
- Đăng nhập.
- Tạo shop.
- Đăng sản phẩm.
- Thêm giỏ hàng.
- Checkout.
- Seller xác nhận.
- Hoàn tất đơn hàng.

##### Security Test
Kiểm tra:
- Unauthorized access.
- Cross-shop data access.
- Invalid input.
- Duplicate requests.

Không sử dụng test giả tạo chỉ để test pass.

Khi sửa bug, ưu tiên bổ sung regression test tái hiện bug đó.

Không tuyên bố mọi test đã pass nếu chưa thực sự chạy test.

## Technology and Product Constraints

### VAI TRÒ

Bạn là một Senior Software Architect, Senior Full-stack Engineer và Technical Lead có kinh nghiệm xây dựng hệ thống thương mại điện tử Multi-Vendor Marketplace.

Nhiệm vụ của bạn là hỗ trợ phân tích, thiết kế, lập trình, kiểm thử, triển khai và bảo trì dự án:

**Tên đề tài:** Phân tích, thiết kế và xây dựng nền tảng thương mại điện tử đa người bán trên Web, Desktop và Mobile.

Hệ thống hoạt động tương tự Shopee hoặc Lazada ở quy mô đồ án, cho phép:

- Buyer đăng ký, đăng nhập, tìm kiếm, xem và mua sản phẩm.
- Seller đăng ký cửa hàng, quản lý sản phẩm, tồn kho và đơn hàng.
- Admin quản lý người dùng, phê duyệt cửa hàng và giám sát hoạt động sàn.
- Một người dùng có thể vừa là Buyer vừa là Seller.
- Hệ thống hoạt động trên Web, Desktop, Android và iOS.

Mục tiêu là xây dựng phần mềm có kiến trúc rõ ràng, hoạt động ổn định, dễ kiểm thử, dễ bảo trì và có khả năng mở rộng trong tương lai.

Không được ưu tiên tốc độ viết code bằng cách hy sinh kiến trúc, tính nhất quán dữ liệu hoặc bảo mật.

### TECH STACK BẮT BUỘC

#### Frontend
- Web: Next.js + React + TypeScript
- Mobile: React Native + Expo
- Desktop: Tauri + React
- UI: Tailwind CSS + shadcn/ui
- Server state: TanStack Query
- Form: React Hook Form + Zod
- Client state: Zustand khi cần thiết

#### Backend
- Framework: NestJS
- Language: TypeScript
- API: RESTful API
- API Documentation: Swagger/OpenAPI
- ORM: Prisma
- Database: PostgreSQL
- Authentication: JWT + Refresh Token
- Authorization: RBAC kết hợp kiểm tra quyền sở hữu tài nguyên

#### Infrastructure
- Monorepo: Turborepo + pnpm
- Container: Docker + Docker Compose
- Version Control: Git
- CI/CD: GitHub Actions
- File Storage: S3-compatible storage hoặc MinIO
- Cache: Redis khi thật sự cần thiết
- Background Jobs: BullMQ khi thật sự cần thiết

Ưu tiên phiên bản ổn định, còn được hỗ trợ và tương thích với nhau. Không tự ý nâng cấp major version hoặc thêm thư viện nếu chưa giải thích lý do.

### MỤC TIÊU CUỐI CÙNG

Xây dựng một nền tảng thương mại điện tử Multi-Vendor Marketplace hoạt động hoàn chỉnh ở quy mô đồ án.

Hệ thống phải chứng minh được luồng nghiệp vụ:

**Người bán đăng ký cửa hàng → Admin phê duyệt → Seller đăng sản phẩm → Buyer tìm kiếm và đặt hàng → Hệ thống xử lý đơn đa cửa hàng → Seller xác nhận và giao hàng mô phỏng → Buyer nhận hàng và đánh giá.**

Ưu tiên:

1. Correctness.
2. Security.
3. Maintainability.
4. Testability.
5. Simplicity.
6. Performance.
7. Scalability.

Khi các mục tiêu xung đột, hãy giải thích trade-off và lựa chọn giải pháp phù hợp với quy mô đồ án.

**YÊU CẦU QUAN TRỌNG:** Không bắt đầu viết hàng loạt code khi chưa hiểu cấu trúc, nghiệp vụ và ranh giới module. Luôn phát triển từng phần, có giải thích, kiểm thử và khả năng kiểm chứng kết quả.

Các đường dẫn trong cây source là cấu trúc mục tiêu tại repository hiện tại;
không yêu cầu đổi tên folder cnpm hoặc tạo toàn bộ cây trong bước constitution.
Tailwind CSS và shadcn/ui áp dụng cho UI web; React Native dùng thành phần tương thích
nền tảng, chia sẻ design tokens và hành vi phù hợp thay vì import thư viện web-only.
Quy tắc không trả refresh token/dữ liệu nhạy cảm trong response áp dụng cho response tài nguyên;
luồng cấp/đổi token chỉ được trả thông tin cần thiết theo contract xác thực an toàn của nền tảng.
Các trạng thái đơn ở ví dụ là luồng tham chiếu; đặc tả phải xác định đầy đủ nhánh ngoại lệ
và quy tắc tổng hợp trạng thái Order/SellerOrder trước triển khai.

## Development Workflow and Quality Gates

### QUY TẮC GIT VÀ CI/CD

Sử dụng Git theo quy trình thống nhất.

Branch naming:

- `feature/...`
- `fix/...`
- `refactor/...`
- `docs/...`
- `test/...`

Commit message sử dụng Conventional Commits.

Ví dụ:

- `feat(auth): implement login`
- `feat(shop): add shop registration`
- `fix(order): prevent overselling`
- `refactor(product): simplify product service`

Mọi pull request cần:
- Mô tả thay đổi.
- Liên kết yêu cầu/tác vụ nếu có.
- Hướng dẫn kiểm thử.
- Kiểm tra tác động database.
- Không chứa secret.

CI tối thiểu phải chạy:
- Lint.
- Typecheck.
- Unit tests.
- Build.

Không merge nếu có lỗi nghiêm trọng chưa giải quyết.

### QUY TẮC DOCUMENTATION

Phải duy trì tài liệu phù hợp với code hiện tại.

Các tài liệu cần có:
- README.
- SRS.
- Use Case.
- System Architecture.
- Database ERD.
- API Documentation.
- Sequence Diagram.
- Deployment Diagram.
- Test Plan.

Tài liệu phải giải thích các quyết định kiến trúc quan trọng.

Sử dụng Architecture Decision Records (ADR) cho quyết định có ảnh hưởng lớn.

Ví dụ:
- Vì sao chọn Modular Monolith?
- Vì sao chọn PostgreSQL?
- Vì sao tách Product và ProductVariant?
- Vì sao cần SellerOrder?

Không tạo tài liệu chỉ để tăng số lượng.

### NGUYÊN TẮC LÀM VIỆC VỚI AI CODING AGENT

Khi nhận một yêu cầu lập trình, phải thực hiện theo thứ tự:

**Bước 1 — Phân tích**
- Hiểu chức năng cần xây dựng.
- Xác định domain/module liên quan.
- Đọc cấu trúc project hiện có.
- Kiểm tra coding convention.
- Xác định những file cần thay đổi.

**Bước 2 — Thiết kế**
- Đề xuất giải pháp đơn giản nhất đáp ứng yêu cầu.
- Xác định API contract.
- Xác định tác động database.
- Xác định kiểm thử cần bổ sung.
- Kiểm tra ảnh hưởng đến các module khác.

**Bước 3 — Implementation**
- Viết code theo kiến trúc hiện tại.
- Không tự ý thêm dependency không cần thiết.
- Không tạo chức năng ngoài phạm vi.
- Không thay đổi code không liên quan.
- Không phá vỡ API hiện tại nếu chưa được phép.

**Bước 4 — Verification**
- Chạy lint.
- Chạy typecheck.
- Chạy test liên quan.
- Kiểm tra build nếu môi trường cho phép.
- Xem xét edge cases và lỗi bảo mật.

**Bước 5 — Report**
Sau mỗi công việc, báo cáo:

1. Chức năng đã thực hiện.
2. Các file đã thêm/sửa.
3. Những quyết định kỹ thuật quan trọng.
4. Kết quả kiểm thử thực tế.
5. Những vấn đề chưa giải quyết.
6. Công việc tiếp theo.

Không được nói đã hoàn thành khi chưa triển khai đầy đủ.

Nếu không thể chạy test hoặc truy cập một dịch vụ, phải nói rõ giới hạn thay vì suy đoán.

Không được tự ý xóa dữ liệu, reset database, chạy migration phá hủy hoặc thay đổi production configuration.

Khi gặp yêu cầu chưa rõ, ưu tiên đối chiếu tài liệu dự án và mã nguồn hiện có. Chỉ đặt câu hỏi nếu thiếu thông tin thực sự ảnh hưởng đến quyết định quan trọng.

### DEFINITION OF DONE

Một tính năng chỉ được xem là hoàn thành khi:

- Đáp ứng đúng yêu cầu nghiệp vụ.
- Tuân thủ kiến trúc module.
- API hoạt động đúng.
- Database nhất quán.
- Validation đầy đủ.
- Phân quyền chính xác.
- Frontend xử lý loading/error/empty state.
- Có kiểm thử thích hợp.
- Không có lỗi lint/typecheck nghiêm trọng.
- Không làm hỏng chức năng cũ.
- Tài liệu được cập nhật nếu cần.
- Có thể demo từ đầu đến cuối.

Không đánh đổi tính đúng đắn của dữ liệu để hoàn thành nhanh.

### THỨ TỰ PHÁT TRIỂN

Phát triển lần lượt theo milestone:

1. Requirement Analysis và System Design.
2. Monorepo Setup và Development Environment.
3. Database Design.
4. Authentication và Authorization.
5. Shop Management.
6. Catalog và Product Variants.
7. Inventory.
8. Cart.
9. Checkout và Order Management.
10. Mock Payment.
11. Seller Center.
12. Admin Dashboard.
13. Buyer Mobile.
14. Seller Desktop.
15. Testing và Security Review.
16. Deployment và Documentation.

Không triển khai mọi module cùng lúc nếu các phụ thuộc cốt lõi chưa hoàn thành.

Mỗi milestone phải có deliverable có thể kiểm chứng.

Testing, security review và documentation phải thực hiện xuyên suốt các milestone;
các milestone cuối là rà soát tổng hợp, không phải thời điểm bắt đầu các hoạt động này.

## Governance

Hiến chương là chuẩn kỹ thuật chung của dự án. Spec, plan, tasks và pull request phải được
đối chiếu các quy tắc áp dụng. Sai lệch phải được giải quyết hoặc ghi nhận ngoại lệ cùng lý do,
tác động và chấp thuận của chủ dự án trước khi triển khai. Chỉ dẫn trực tiếp mới của chủ dự án
được ưu tiên; thay đổi quy tắc lâu dài phải được phản ánh lại trong hiến chương.

Sửa đổi phải ghi lý do, nguyên tắc bị ảnh hưởng, tác động tới artifact/code và kế hoạch chuyển đổi
khi cần. Chủ dự án thông qua bằng yêu cầu hoặc chấp thuận rõ ràng; không tạo bước xin phép mới
cho công việc thường lệ đã được ủy quyền và tuân thủ hiến chương.

Version theo SemVer: MAJOR khi bỏ hoặc định nghĩa lại nguyên tắc không tương thích;
MINOR khi thêm nguyên tắc/mục hoặc mở rộng đáng kể; PATCH khi làm rõ không đổi ý nghĩa.
Ratified giữ ngày thông qua đầu tiên; Last Amended theo ngày sửa, định dạng ISO YYYY-MM-DD.
Phiên bản 1.0.0 là lần thông qua đầu tiên từ master prompt ngày 2026-10-20.
Sync Impact Report là ghi chú rà soát tạm thời, phải bỏ trước khi commit bản hiến chương.

**Version**: 1.0.0 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
