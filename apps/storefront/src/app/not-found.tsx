import Link from "next/link";
import { EmptyState, Search } from "@marketplace/ui-web";

export default function NotFound() {
  return (
    <main className="mp-storefront__main">
      <div className="mp-container mp-loading-page">
        <EmptyState
          icon={<Search size={24} />}
          title="Không tìm thấy trang này."
          description="Liên kết có thể đã đổi hoặc sản phẩm không còn được bán."
        />
        <Link className="mp-button mp-button--primary mp-button--md" href="/">
          <span className="mp-button__label">Về trang chủ</span>
        </Link>
      </div>
    </main>
  );
}
