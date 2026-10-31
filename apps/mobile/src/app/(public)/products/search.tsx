import React from "react";
import { ProductBrowser } from "../../../features/catalog/product-browser";

export default function ProductSearchRoute() {
  return (
    <ProductBrowser
      pathname="/products/search"
      title="Tìm kiếm và lọc sản phẩm"
    />
  );
}
