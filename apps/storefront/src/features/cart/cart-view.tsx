"use client";

import Link from "next/link";
import { CheckboxField, Minus, Plus, Store, Trash2, formatVnd } from "@marketplace/ui-web";

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
    <section className="mp-cart-group" aria-labelledby={`cart-shop-${group.shopId}`}>
      <header className="mp-cart-group__head">
        <h2 id={`cart-shop-${group.shopId}`}>
          <Store size={16} aria-hidden="true" />
          {group.shopName}
        </h2>
        <Link href={`/shops/${group.shopId}`}>Xem cửa hàng</Link>
      </header>
      <ul className="mp-cart-group__items">
        {group.items.map((item) => (
          <li key={item.id} className="mp-cart-item">
            <CheckboxField
              aria-label={`Chọn ${item.productName}`}
              checked={item.selected}
              disabled={disabled}
              onChange={(event) => onUpdate(item, { selected: event.target.checked })}
              label={<span className="mp-visually-hidden">Chọn {item.productName}</span>}
            />
            <div className="mp-cart-item__media" aria-hidden="true">
              <span>{item.productName.slice(0, 1)}</span>
            </div>
            <div className="mp-cart-item__info">
              <Link className="mp-cart-item__name" href={`/products/${item.productId}`}>
                {item.productName}
              </Link>
              <p className="mp-cart-item__variant">
                {Object.values(item.attributes).join(" / ") || item.sku}
              </p>
              <p className="mp-cart-item__unit" data-numeric>
                {formatVnd(item.currentUnitPrice)}
              </p>
              {!item.purchasable && (
                <p className="mp-cart-item__warning" role="status">
                  {item.unavailableReason === "INSUFFICIENT_STOCK"
                    ? "Số lượng vượt tồn kho"
                    : "Sản phẩm hiện không khả dụng"}
                </p>
              )}
            </div>
            <div className="mp-qty">
              <button
                type="button"
                aria-label={`Giảm số lượng ${item.productName}`}
                disabled={disabled || item.quantity <= 1}
                onClick={() => onUpdate(item, { quantity: item.quantity - 1 })}
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <input
                aria-label={`Số lượng ${item.productName}`}
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
              <button
                type="button"
                aria-label={`Tăng số lượng ${item.productName}`}
                disabled={disabled || item.quantity >= 999}
                onClick={() => onUpdate(item, { quantity: item.quantity + 1 })}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
            <p className="mp-cart-item__total" data-numeric>
              {formatVnd((BigInt(item.currentUnitPrice) * BigInt(item.quantity)).toString())}
            </p>
            <button
              type="button"
              className="mp-cart-item__remove"
              disabled={disabled}
              onClick={() => onRemove(item)}
              aria-label={`Xóa ${item.productName}`}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>Xóa</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
