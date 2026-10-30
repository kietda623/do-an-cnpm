import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ApiPath, components } from "@marketplace/api-client";
import Home from "../src/app/(public)/index";
import ProductListRoute from "../src/app/(public)/products/index";
import ProductSearchRoute from "../src/app/(public)/products/search";
import ProductDetailRoute from "../src/app/(public)/products/[productId]";
import PublicShopRoute from "../src/app/(public)/shops/[shopId]";

let mockRouteParams: Record<string, string | undefined> = {};
const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockRequest = jest.fn<Promise<unknown>, [ApiPath, RequestInit?]>();
const mockApi = {
  request: <T,>(path: ApiPath, init?: RequestInit) =>
    mockRequest(path, init) as Promise<T>,
};
let mockUser: { id: string } | null = null;
const mockSession = {
  api: mockApi,
  get user() {
    return mockUser;
  },
};
const queryClients: QueryClient[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock("../src/features/auth/session-provider", () => ({
  useSession: () => mockSession,
}));

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const SHOP_ID = "22222222-2222-4222-8222-222222222222";
const SHOP_B_ID = "33333333-3333-4333-8333-333333333333";
const CATEGORY_ID = "44444444-4444-4444-8444-444444444444";

const asset: components["schemas"]["Asset"] = {
  id: "55555555-5555-4555-8555-555555555555",
  url: "https://cdn.example.test/product.jpg",
  mimeType: "image/jpeg",
  byteSize: 1200,
  width: 600,
  height: 600,
};
const secondAsset: components["schemas"]["Asset"] = {
  ...asset,
  id: "66666666-6666-4666-8666-666666666666",
  url: "https://cdn.example.test/product-side.jpg",
};
const category: components["schemas"]["Category"] = {
  id: CATEGORY_ID,
  name: "Đồ gia dụng",
  visible: true,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};
const productSummary = (
  id: string,
  name: string,
): components["schemas"]["ProductSummary"] => ({
  id,
  shopId: SHOP_ID,
  shopName: "Nhà Bếp Mộc",
  name,
  image: asset,
  minimumPrice: "125000",
  available: true,
  ratingAverage: "4.8",
  ratingCount: 12,
  createdAt: "2026-10-01T00:00:00.000Z",
});
const product: components["schemas"]["DiscoveryProduct"] = {
  id: PRODUCT_ID,
  shopId: SHOP_ID,
  categoryId: CATEGORY_ID,
  name: "Bình giữ nhiệt",
  description: "Thân inox, giữ nhiệt cả ngày.",
  selling: true,
  category: { id: CATEGORY_ID, name: "Đồ gia dụng" },
  shop: { id: SHOP_ID, name: "Nhà Bếp Mộc", slug: "nha-bep-moc" },
  images: [asset, secondAsset],
  minimumPrice: "125000",
  variants: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      sku: "BINH-DEN",
      attributes: { màu: "Đen" },
      price: "125000",
      availableQuantity: 3,
    },
    {
      id: "88888888-8888-4888-8888-888888888888",
      sku: "BINH-DO",
      attributes: { màu: "Đỏ" },
      price: "150000",
      availableQuantity: 1,
    },
  ],
  ratingAverage: "4.8",
  ratingCount: 1,
};
const shop: components["schemas"]["ShopPublic"] = {
  id: SHOP_ID,
  name: "Nhà Bếp Mộc",
  slug: "nha-bep-moc",
  description: "Đồ dùng bếp bền, gọn.",
  logo: asset,
  banner: secondAsset,
};
const review: components["schemas"]["Review"] = {
  id: "99999999-9999-4999-8999-999999999999",
  productId: PRODUCT_ID,
  shopId: SHOP_ID,
  orderItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  buyerDisplayName: "Nguyễn An",
  rating: 5,
  comment: "Đúng mô tả.",
  createdAt: "2026-10-20T00:00:00.000Z",
};
const firstPage = Array.from({ length: 20 }, (_, index) =>
  productSummary(
    `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`,
    `Sản phẩm ${index + 1}`,
  ),
);

function createQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  queryClients.push(queryClient);
  return queryClient;
}

function renderRoute(element: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  mockRouteParams = {};
  mockUser = null;
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRequest.mockReset();
  mockRequest.mockImplementation(async (path, init) => {
    const value = String(path);
    const url = new URL(value, "https://example.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/categories") return [category];
    if (
      url.pathname === "/products" &&
      url.searchParams.get("shopId") === SHOP_ID
    )
      return [productSummary(PRODUCT_ID, "Bình giữ nhiệt")];
    if (
      url.pathname === "/products" &&
      url.searchParams.get("shopId") === SHOP_B_ID
    )
      return [productSummary(PRODUCT_ID, "Sản phẩm shop B")];
    if (url.pathname === "/products" && method === "GET") {
      return url.searchParams.get("page") === "2"
        ? [productSummary(PRODUCT_ID, "Sản phẩm trang hai")]
        : firstPage;
    }
    if (url.pathname === `/products/${PRODUCT_ID}`) return product;
    if (url.pathname === `/products/${PRODUCT_ID}/reviews`) return [review];
    if (url.pathname === "/cart/items" && method === "POST")
      return { id: "cart" };
    if (url.pathname === `/shops/${SHOP_ID}`) return shop;
    if (url.pathname === `/shops/${SHOP_B_ID}`)
      return { ...shop, id: SHOP_B_ID, name: "Cửa hàng B" };
    throw new Error(`Unexpected catalog request: ${value}`);
  });
});

afterEach(async () => {
  cleanup();
  for (const queryClient of queryClients) queryClient.clear();
  queryClients.length = 0;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
});

test("B01 home displays public categories and products and searches from the search field", async () => {
  renderRoute(<Home />);

  expect(await screen.findByText("Đồ gia dụng")).toBeTruthy();
  expect(await screen.findByText("Sản phẩm 1")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Tìm sản phẩm"), "bình giữ nhiệt");
  fireEvent.press(screen.getByText("Tìm kiếm"));

  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/products/search",
    params: { q: "bình giữ nhiệt" },
  });
}, 15_000);

test("B03 product list keeps pagination and sort in the route parameters", async () => {
  mockRouteParams = { page: "1", sort: "NEWEST" };
  renderRoute(<ProductListRoute />);

  expect(await screen.findByText("Sản phẩm 1")).toBeTruthy();
  expect(screen.getByText("Trang 1")).toBeTruthy();
  fireEvent.press(screen.getByText("Trang sau"));

  expect(mockRouter.replace).toHaveBeenCalledWith(
    expect.objectContaining({
      pathname: "/products",
      params: expect.objectContaining({ page: "2" }),
    }),
  );
});

test("B04 invalid price range is reported and does not fetch an invalid listing", async () => {
  mockRouteParams = { minPrice: "500000", maxPrice: "100000" };
  renderRoute(<ProductSearchRoute />);

  expect(
    await screen.findByText(
      "Giá phải là số nguyên tối đa 18 chữ số và giá từ không được lớn hơn giá đến.",
    ),
  ).toBeTruthy();
  expect(
    mockRequest.mock.calls.some(([path]) =>
      String(path).startsWith("/products?"),
    ),
  ).toBe(false);
});

test("B04 valid search filters are reflected in the route and API request", async () => {
  const view = renderRoute(<ProductSearchRoute />);
  await screen.findByLabelText("Danh mục Đồ gia dụng");
  fireEvent.changeText(screen.getByLabelText("Tìm sản phẩm"), "bình giữ nhiệt");
  fireEvent.press(screen.getByLabelText("Danh mục Đồ gia dụng"));
  fireEvent.press(screen.getByLabelText("Sắp xếp Giá tăng dần"));
  fireEvent.changeText(screen.getByLabelText("Giá từ"), "100000");
  fireEvent.changeText(screen.getByLabelText("Giá đến"), "200000");
  fireEvent.press(screen.getByText("Áp dụng bộ lọc"));

  expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: "/products/search",
    params: {
      q: "bình giữ nhiệt",
      categoryId: CATEGORY_ID,
      minPrice: "100000",
      maxPrice: "200000",
      sort: "PRICE_ASC",
      page: "1",
    },
  });
  mockRouteParams = {
    q: "bình giữ nhiệt",
    categoryId: CATEGORY_ID,
    minPrice: "100000",
    maxPrice: "200000",
    sort: "PRICE_ASC",
    page: "1",
  };
  view.rerender(
    <QueryClientProvider client={view.queryClient}>
      <ProductSearchRoute />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(
      mockRequest.mock.calls.some(([path]) => {
        const url = new URL(String(path), "https://example.test");
        return (
          url.pathname === "/products" &&
          url.searchParams.get("q") === "bình giữ nhiệt" &&
          url.searchParams.get("categoryId") === CATEGORY_ID &&
          url.searchParams.get("minPrice") === "100000" &&
          url.searchParams.get("maxPrice") === "200000" &&
          url.searchParams.get("sort") === "PRICE_ASC" &&
          url.searchParams.get("pageSize") === "20"
        );
      }),
    ).toBe(true),
  );
});

test("B05 variant selection changes price and stock and loads public reviews", async () => {
  mockRouteParams = { productId: PRODUCT_ID };
  renderRoute(<ProductDetailRoute />);

  expect(await screen.findByText("Bình giữ nhiệt")).toBeTruthy();
  expect(screen.getByText("125.000₫")).toBeTruthy();
  expect(await screen.findByText(/Nguyễn An/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Xem ảnh 2"));
  expect(screen.getByLabelText("Ảnh sản phẩm Bình giữ nhiệt 2/2")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Phân loại Đỏ"));

  expect(screen.getByText("150.000₫")).toBeTruthy();
  expect(screen.getByText("Còn 1 sản phẩm")).toBeTruthy();
});

test("B05 guest purchase action returns to the product after login", async () => {
  mockRouteParams = { productId: PRODUCT_ID };
  renderRoute(<ProductDetailRoute />);
  expect(await screen.findByText("Bình giữ nhiệt")).toBeTruthy();

  fireEvent.press(screen.getByText("Đăng nhập để mua"));

  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/login",
    params: { returnTo: `/products/${PRODUCT_ID}` },
  });
});

test("B05 signed-in buyer adds the selected variant and invalidates their cart", async () => {
  mockRouteParams = { productId: PRODUCT_ID };
  mockUser = { id: "buyer-1" };
  const { queryClient } = renderRoute(<ProductDetailRoute />);
  queryClient.setQueryData(["cart", "buyer-1"], { id: "existing-cart" });
  expect(await screen.findByText("Bình giữ nhiệt")).toBeTruthy();
  fireEvent.press(screen.getByText("Thêm vào giỏ hàng"));

  expect(await screen.findByText("Đã thêm vào giỏ")).toBeTruthy();
  expect(mockRequest).toHaveBeenCalledWith(
    "/cart/items",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        variantId: "77777777-7777-4777-8777-777777777777",
        quantity: 1,
      }),
    }),
  );
  await waitFor(() =>
    expect(queryClient.getQueryState(["cart", "buyer-1"])?.isInvalidated).toBe(
      true,
    ),
  );
});

test("B06 public shop displays its public catalog without private contact fields", async () => {
  mockRouteParams = { shopId: SHOP_ID };
  renderRoute(<PublicShopRoute />);

  expect(
    await screen.findByRole("header", { name: "Nhà Bếp Mộc" }),
  ).toBeTruthy();
  expect(await screen.findByText("Đồ dùng bếp bền, gọn.")).toBeTruthy();
  expect(await screen.findByText("Bình giữ nhiệt")).toBeTruthy();
  expect(screen.queryByText(/contact|phone|địa chỉ riêng/i)).toBeNull();
});

test("a delayed old shop response is aborted and cannot replace the current shop", async () => {
  let resolveOldShop:
    ((value: components["schemas"]["ShopPublic"]) => void) | undefined;
  let oldShopSignal: AbortSignal | null = null;
  mockRequest.mockImplementation((path, init) => {
    const value = String(path);
    const url = new URL(value, "https://example.test");
    if (url.pathname === `/shops/${SHOP_ID}`) {
      oldShopSignal = init?.signal ?? null;
      return new Promise((resolve) => {
        resolveOldShop = resolve as (
          value: components["schemas"]["ShopPublic"],
        ) => void;
      });
    }
    if (url.pathname === `/shops/${SHOP_B_ID}`)
      return Promise.resolve({ ...shop, id: SHOP_B_ID, name: "Cửa hàng B" });
    if (url.pathname === "/products" && url.searchParams.has("shopId"))
      return Promise.resolve([productSummary(PRODUCT_ID, "Sản phẩm shop B")]);
    return Promise.resolve([category]);
  });
  mockRouteParams = { shopId: SHOP_ID };
  const queryClient = createQueryClient();
  const page = (routeParams: Record<string, string | undefined>) => {
    mockRouteParams = routeParams;
    return (
      <QueryClientProvider client={queryClient}>
        <PublicShopRoute />
      </QueryClientProvider>
    );
  };
  const { rerender } = render(page(mockRouteParams));

  await waitFor(() => expect(oldShopSignal).not.toBeNull());
  rerender(page({ shopId: SHOP_B_ID }));
  expect(await screen.findByText("Cửa hàng B")).toBeTruthy();
  expect(oldShopSignal?.aborted).toBe(true);

  await act(async () => {
    resolveOldShop?.(shop);
  });
  expect(
    queryClient.getQueryData(["catalog", "shop", SHOP_ID]),
  ).toBeUndefined();
  expect(screen.getByRole("header", { name: "Cửa hàng B" })).toBeTruthy();
});
