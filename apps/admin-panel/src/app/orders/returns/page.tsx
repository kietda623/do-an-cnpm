import { PageHeader, RoleGate } from "@marketplace/ui-web";
import { ReturnConfirmation } from "../../../features/orders/return-confirmation";

export default function ReturnsPage() {
  return (
    <div className="mp-page mp-admin-page">
      <RoleGate role="ADMIN">
        <PageHeader
          title="Xác nhận hàng hoàn về"
          description="Đối soát kiện giao thất bại đã quay về kho và hủy phần đơn tương ứng."
        />
        <ReturnConfirmation />
      </RoleGate>
    </div>
  );
}
