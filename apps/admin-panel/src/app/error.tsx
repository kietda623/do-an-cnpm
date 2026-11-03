"use client";

import { useEffect } from "react";
import { Button, RefreshCw } from "@marketplace/ui-web";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mp-page">
      <div className="mp-alert mp-alert--error" role="alert">
        <div className="mp-alert__body">
          <p className="mp-alert__title">Không tải được trang quản trị</p>
          <div className="mp-alert__text">
            Đã xảy ra lỗi khi tải dữ liệu vận hành. Vui lòng thử lại.
          </div>
        </div>
      </div>
      <div>
        <Button variant="secondary" leadingIcon={<RefreshCw size={16} />} onClick={reset}>
          Thử lại
        </Button>
      </div>
    </div>
  );
}
