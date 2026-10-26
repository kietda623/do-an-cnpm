import { RoleGate } from "@marketplace/ui-web";
import { ReturnConfirmation } from "../../../features/orders/return-confirmation";

export default function ReturnsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <RoleGate role="ADMIN">
        <h1 className="text-3xl font-semibold">Hàng giao trả về</h1>
        <ReturnConfirmation />
      </RoleGate>
    </main>
  );
}
