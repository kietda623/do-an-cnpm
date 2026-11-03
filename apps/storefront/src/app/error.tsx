"use client";

import { useEffect } from "react";
import { Button, RefreshCw } from "@marketplace/ui-web";

export default function ErrorBoundary({
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
    <main className="mp-storefront__main">
      <div className="mp-container mp-loading-page">
        <div className="mp-alert mp-alert--error" role="alert">
          <div className="mp-alert__body">
            <p className="mp-alert__title">Đã xảy ra lỗi</p>
            <div className="mp-alert__text">
              Không thể hiển thị nội dung này. Vui lòng thử lại.
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          leadingIcon={<RefreshCw size={16} />}
          onClick={reset}
        >
          Thử lại
        </Button>
      </div>
    </main>
  );
}
