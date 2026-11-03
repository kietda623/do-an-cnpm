import Link from "next/link";
import { EmptyState, Store } from "@marketplace/ui-web";

export default function NotFound() {
  return (
    <div className="mp-page mp-loading-page">
      <EmptyState
        icon={<Store size={24} />}
        title="Không tìm thấy trang này."
        description="Trang quản lý có thể đã đổi địa chỉ hoặc cửa hàng không còn tồn tại."
      />
      <Link className="mp-button mp-button--primary mp-button--md" href="/shops">
        <span className="mp-button__label">Về danh sách cửa hàng</span>
      </Link>
    </div>
  );
}
