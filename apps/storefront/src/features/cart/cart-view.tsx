import Link from "next/link";
import { formatVnd } from "../money";

export type CartItemViewModel = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  attributes: Record<string, string>;
  currentUnitPrice: string;
  quantity: number;
  selected: boolean;
  availableQuantity: number;
  purchasable: boolean;
  unavailableReason: string | null;
};
export type CartGroupViewModel = {
  shopId: string;
  shopName: string;
  items: CartItemViewModel[];
  selectedSubtotal: string;
};

export function CartGroupView({
  group,
  disabled,
  onUpdate,
  onRemove,
}: {
  group: CartGroupViewModel;
  disabled: boolean;
  onUpdate: (item: CartItemViewModel, changes: { quantity?: number; selected?: boolean }) => void;
  onRemove: (item: CartItemViewModel) => void;
}) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 font-semibold">{group.shopName}</h2>
      <div className="divide-y">
        {group.items.map((item) => (
          <article key={item.id} className="flex flex-wrap items-center gap-3 py-4">
            <input
              aria-label={`Chọn ${item.productName}`}
              type="checkbox"
              checked={item.selected}
              disabled={disabled}
              onChange={(event) => onUpdate(item, { selected: event.target.checked })}
            />
            <div className="min-w-40 flex-1">
              <Link className="font-medium underline" href={`/products/${item.productId}`}>
                {item.productName}
              </Link>
              <p className="text-sm text-neutral-600">
                {Object.values(item.attributes).join(" / ") || item.sku}
              </p>
              <p className="font-semibold">{formatVnd(item.currentUnitPrice)}</p>
              {!item.purchasable && (
                <p className="text-sm text-red-700">
                  {item.unavailableReason === "INSUFFICIENT_STOCK"
                    ? "Số lượng vượt tồn kho"
                    : "Sản phẩm hiện không khả dụng"}
                </p>
              )}
            </div>
            <label className="text-sm">
              Số lượng
              <input
                aria-label={`Số lượng ${item.productName}`}
                className="ml-2 h-10 w-20 rounded border px-2"
                type="number"
                min={1}
                max={999}
                value={item.quantity}
                disabled={disabled}
                onChange={(event) => {
                  const quantity = Number(event.target.value);
                  if (quantity >= 1 && quantity <= 999) onUpdate(item, { quantity });
                }}
              />
            </label>
            <button
              className="text-sm underline"
              disabled={disabled}
              onClick={() => onRemove(item)}
            >
              Xóa
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
