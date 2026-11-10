export const MAX_VARIANTS = 100;
export const MAX_INITIAL_STOCK = 2_147_483_647;

export type AttributeDraft = { id: string; name: string; value: string };
export type VariantDraft = {
  id: string;
  sku: string;
  price: string;
  stock: string;
  selling: boolean;
  attributes: AttributeDraft[];
};

export function emptyVariant(id: string): VariantDraft {
  return {
    id,
    sku: "",
    price: "",
    stock: "0",
    selling: true,
    attributes: [{ id: `${id}-attribute-1`, name: "", value: "" }],
  };
}

// Preserve exact integer VND strings and the existing API's stock/selling keys.
export function variantsPayload(drafts: VariantDraft[]) {
  if (!drafts.length || drafts.length > MAX_VARIANTS) {
    throw new Error(`Sản phẩm cần từ 1 đến ${MAX_VARIANTS} biến thể.`);
  }
  const skus = new Set<string>();
  const combinations = new Set<string>();
  const result = drafts.map((draft, index) => {
    const prefix = `Biến thể ${index + 1}`;
    const sku = draft.sku.trim();
    if (!sku || sku.length > 100)
      throw new Error(`${prefix}: mã SKU cần từ 1 đến 100 ký tự.`);
    const normalizedSku = sku.toUpperCase();
    if (skus.has(normalizedSku))
      throw new Error(`${prefix}: mã SKU bị trùng với biến thể khác.`);
    skus.add(normalizedSku);

    const price = draft.price.trim();
    if (
      !/^\d+$/.test(price) ||
      BigInt(price) <= 0n ||
      BigInt(price) > 999_999_999_999_999_999n
    ) {
      throw new Error(
        `${prefix}: Giá bán phải là số đồng nguyên lớn hơn 0, tối đa 18 chữ số.`,
      );
    }
    const stock = Number(draft.stock);
    if (
      !/^\d+$/.test(draft.stock) ||
      !Number.isInteger(stock) ||
      stock > MAX_INITIAL_STOCK
    ) {
      throw new Error(
        `${prefix}: tồn kho phải là số nguyên từ 0 đến ${MAX_INITIAL_STOCK}.`,
      );
    }

    const names = new Set<string>();
    const entries: [string, string][] = [];
    for (const attribute of draft.attributes) {
      const name = attribute.name.trim();
      const value = attribute.value.trim();
      if (!name && !value) continue;
      if (!name || !value)
        throw new Error(`${prefix}: nhập đủ tên và giá trị phân loại.`);
      if (names.has(name))
        throw new Error(`${prefix}: tên phân loại “${name}” bị trùng.`);
      names.add(name);
      entries.push([name, value]);
    }
    const attributes = Object.fromEntries(entries);
    const key = JSON.stringify(
      Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))),
    );
    if (combinations.has(key)) {
      throw new Error(
        `${prefix}: phân loại trùng với biến thể khác. Hãy dùng màu sắc, kích thước hoặc phân loại khác nhau.`,
      );
    }
    combinations.add(key);
    return { sku, attributes, price, stock, selling: draft.selling };
  });
  if (!result.some((variant) => variant.selling)) {
    throw new Error("Cần ít nhất một biến thể đang bán để đăng sản phẩm.");
  }
  return result;
}
