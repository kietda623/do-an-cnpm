import Link from "next/link";
import { EmptyState, ShieldAlert } from "@marketplace/ui-web";

export default function NotFound() {
  return (
    <div className="mp-page mp-loading-page">
      <EmptyState
        icon={<ShieldAlert size={24} />}
        title="Không tìm thấy trang này."
        description="Trang quản trị có thể đã đổi địa chỉ hoặc bản ghi không còn tồn tại."
      />
      <Link className="mp-button mp-button--primary mp-button--md" href="/">
        <span className="mp-button__label">Về tổng quan</span>
      </Link>
    </div>
  );
}
