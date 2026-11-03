import { Skeleton } from "@marketplace/ui-web";

export default function Loading() {
  return (
    <div className="mp-page mp-loading-page" role="status">
      <span className="mp-visually-hidden">Đang tải nội dung…</span>
      <Skeleton className="mp-skeleton--line" />
      <Skeleton className="mp-skeleton--block" />
      <Skeleton className="mp-skeleton--block" />
    </div>
  );
}
