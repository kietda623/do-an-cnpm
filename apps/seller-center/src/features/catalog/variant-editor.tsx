"use client";

import { useId, useRef } from "react";
import {
  Button,
  CheckboxField,
  Plus,
  TextField,
  Trash2,
} from "@marketplace/ui-web";
import {
  emptyVariant,
  MAX_INITIAL_STOCK,
  MAX_VARIANTS,
  type VariantDraft,
} from "./variant-draft";

export function VariantEditor({
  variants,
  onChange,
  disabled,
}: {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  disabled: boolean;
}) {
  const headingId = useId();
  const nextVariantId = useRef(2);
  const nextAttributeId = useRef(2);

  function update(id: string, patch: Partial<VariantDraft>) {
    onChange(
      variants.map((variant) =>
        variant.id === id ? { ...variant, ...patch } : variant,
      ),
    );
  }

  return (
    <section className="mp-variant-editor" aria-labelledby={headingId}>
      <header className="mp-variant-editor__head">
        <h3 id={headingId}>Biến thể sản phẩm</h3>
        <span className="mp-muted">
          {variants.length}/{MAX_VARIANTS}
        </span>
      </header>
      <p className="mp-muted mp-variant-editor__hint">
        Mỗi biến thể có mã SKU riêng. Sản phẩm không có màu hoặc kích thước vẫn
        cần một biến thể. Phân loại có thể để trống nếu không có lựa chọn riêng.
      </p>
      <div className="mp-variant-editor__list">
        {variants.map((variant, index) => (
          <fieldset
            className="mp-variant-editor__row"
            key={variant.id}
            disabled={disabled}
          >
            <legend>Biến thể {index + 1}</legend>
            <TextField
              label="Mã SKU"
              name={`${variant.id}-sku`}
              value={variant.sku}
              onChange={(event) =>
                update(variant.id, { sku: event.target.value })
              }
              required
              maxLength={100}
              placeholder="VD: AO-DEN-M"
              autoFocus={
                variant.id !== "variant-1" && index === variants.length - 1
              }
            />
            <div className="mp-variant-editor__numbers">
              <TextField
                label="Giá bán (₫)"
                name={`${variant.id}-price`}
                value={variant.price}
                onChange={(event) =>
                  update(variant.id, { price: event.target.value })
                }
                inputMode="numeric"
                pattern="[0-9]+"
                maxLength={18}
                required
                placeholder="VD: 150000"
              />
              <TextField
                label="Tồn kho ban đầu"
                name={`${variant.id}-stock`}
                type="number"
                min={0}
                max={MAX_INITIAL_STOCK}
                step={1}
                required
                value={variant.stock}
                onChange={(event) =>
                  update(variant.id, { stock: event.target.value })
                }
              />
            </div>
            <div className="mp-variant-editor__attributes">
              {variant.attributes.map((attribute, attributeIndex) => (
                <div
                  className="mp-variant-editor__attribute"
                  key={attribute.id}
                >
                  <TextField
                    label="Tên phân loại"
                    name={`${attribute.id}-name`}
                    value={attribute.name}
                    onChange={(event) =>
                      update(variant.id, {
                        attributes: variant.attributes.map((item) =>
                          item.id === attribute.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                    required={Boolean(attribute.value.trim())}
                    placeholder="Màu sắc"
                  />
                  <TextField
                    label="Giá trị"
                    name={`${attribute.id}-value`}
                    value={attribute.value}
                    onChange={(event) =>
                      update(variant.id, {
                        attributes: variant.attributes.map((item) =>
                          item.id === attribute.id
                            ? { ...item, value: event.target.value }
                            : item,
                        ),
                      })
                    }
                    required={Boolean(attribute.name.trim())}
                    placeholder="Đỏ"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Xóa phân loại ${attributeIndex + 1} của biến thể ${index + 1}`}
                    onClick={() =>
                      update(variant.id, {
                        attributes: variant.attributes.filter(
                          (item) => item.id !== attribute.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leadingIcon={<Plus size={16} />}
                onClick={() =>
                  update(variant.id, {
                    attributes: [
                      ...variant.attributes,
                      {
                        id: `${variant.id}-attribute-${nextAttributeId.current++}`,
                        name: "",
                        value: "",
                      },
                    ],
                  })
                }
              >
                Thêm phân loại
              </Button>
            </div>
            <div className="mp-variant-editor__actions">
              <CheckboxField
                label="Đang bán"
                checked={variant.selling}
                onChange={(event) =>
                  update(variant.id, { selling: event.target.checked })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Xóa biến thể ${index + 1}`}
                disabled={variants.length === 1}
                onClick={() =>
                  onChange(variants.filter((item) => item.id !== variant.id))
                }
              >
                Xóa biến thể
              </Button>
            </div>
          </fieldset>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        leadingIcon={<Plus size={16} />}
        disabled={disabled || variants.length >= MAX_VARIANTS}
        onClick={() => {
          if (variants.length < MAX_VARIANTS)
            onChange([
              ...variants,
              emptyVariant(`variant-${nextVariantId.current++}`),
            ]);
        }}
      >
        Thêm biến thể
      </Button>
    </section>
  );
}
