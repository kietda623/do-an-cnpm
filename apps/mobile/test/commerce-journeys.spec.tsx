import React from "react";
import { ApiClientError } from "@marketplace/api-client";
import {
  act,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  CART_ITEM_ID,
  CART_SHOP_ID,
  SECOND_CART_ITEM_ID,
  SECOND_CART_SHOP_ID,
  cleanupCommerceTests,
  makeCart,
  makeCartGroup,
  makeCartItem,
  mockRequest,
  mockRouter,
  renderCommerce,
  resetCommerceMocks,
  setCommerceUser,
} from "./commerce-test-utils";
import CartRoute from "../src/app/(buyer)/cart";

beforeEach(() => {
  resetCommerceMocks();
  setCommerceUser({ id: "buyer-1" });
});

afterEach(async () => {
  await cleanupCommerceTests();
});

test("B07 shows loading while the account cart is being fetched", async () => {
  let resolveCart: ((cart: ReturnType<typeof makeCart>) => void) | undefined;
  mockRequest.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveCart = resolve as (cart: ReturnType<typeof makeCart>) => void;
      }),
  );

  renderCommerce(<CartRoute />);

  expect(screen.getByText("Đang tải giỏ hàng…")).toBeTruthy();
  await act(async () => resolveCart?.(makeCart()));
  expect(await screen.findByText("Bình giữ nhiệt")).toBeTruthy();
});

test("B07 groups cart lines by shop and shows server subtotals and stock issues", async () => {
  const groupedCart = makeCart(
    [
      makeCartGroup(
        CART_SHOP_ID,
        "Nhà Bếp Mộc",
        [
          makeCartItem(),
          makeCartItem({
            id: SECOND_CART_ITEM_ID,
            productName: "Ấm siêu tốc",
            sku: "AM-01",
            selected: false,
            availableQuantity: 1,
            quantity: 2,
            purchasable: false,
            unavailableReason: "INSUFFICIENT_STOCK",
          }),
        ],
        "125000",
      ),
      makeCartGroup(
        SECOND_CART_SHOP_ID,
        "Hạt Mây",
        [
          makeCartItem({
            id: "88888888-8888-4888-8888-888888888888",
            shopId: SECOND_CART_SHOP_ID,
            productName: "Cà phê rang",
            sku: "CF-01",
            selected: true,
            currentUnitPrice: "125000",
          }),
        ],
        "125000",
      ),
    ],
    "250000",
  );
  mockRequest.mockResolvedValue(groupedCart);

  renderCommerce(<CartRoute />);

  expect(await screen.findByText("Nhà Bếp Mộc")).toBeTruthy();
  expect(screen.getByText("Hạt Mây")).toBeTruthy();
  expect(screen.getByText("Bình giữ nhiệt")).toBeTruthy();
  expect(screen.getByText("Ấm siêu tốc")).toBeTruthy();
  expect(screen.getByText("Cà phê rang")).toBeTruthy();
  expect(screen.getByText("Số lượng vượt tồn kho")).toBeTruthy();
  expect(screen.getByText("Tổng đã chọn")).toBeTruthy();
  expect(screen.getByText("250.000₫")).toBeTruthy();
  expect(mockRequest).toHaveBeenCalledWith(
    "/cart",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test("B07 empty cart offers a browse action", async () => {
  mockRequest.mockResolvedValue(makeCart([], "0"));

  renderCommerce(<CartRoute />);

  expect(await screen.findByText("Giỏ hàng đang trống.")).toBeTruthy();
  fireEvent.press(screen.getByText("Tiếp tục mua sắm"));
  expect(mockRouter.push).toHaveBeenCalledWith("/products");
});

test("B07 selection changes are sent to the server and update the cached cart", async () => {
  const initialCart = makeCart();
  const updatedCart = makeCart(
    [
      makeCartGroup(
        CART_SHOP_ID,
        "Nhà Bếp Mộc",
        [makeCartItem({ selected: false })],
        "0",
      ),
    ],
    "0",
  );
  mockRequest.mockImplementation(async (path, init) =>
    String(path) === "/cart/items/" + CART_ITEM_ID && init?.method === "PATCH"
      ? updatedCart
      : initialCart,
  );
  const view = renderCommerce(<CartRoute />);

  fireEvent.press(await screen.findByLabelText("Chọn Bình giữ nhiệt"));

  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      `/cart/items/${CART_ITEM_ID}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ selected: false }),
      }),
    ),
  );
  await waitFor(() =>
    expect(view.queryClient.getQueryData(["cart", "buyer-1"])).toEqual(
      updatedCart,
    ),
  );
  expect(screen.getByText("0₫")).toBeTruthy();
});

test("B07 quantity controls enforce the positive and available-stock bounds", async () => {
  const initialCart = makeCart();
  const quantityTwo = makeCart(
    [
      makeCartGroup(
        CART_SHOP_ID,
        "Nhà Bếp Mộc",
        [makeCartItem({ quantity: 2 })],
        "250000",
      ),
    ],
    "250000",
  );
  mockRequest.mockImplementation(async (path, init) =>
    String(path) === `/cart/items/${CART_ITEM_ID}` && init?.method === "PATCH"
      ? quantityTwo
      : initialCart,
  );

  renderCommerce(<CartRoute />);

  const decrement = await screen.findByLabelText("Giảm số lượng Bình giữ nhiệt");
  expect(decrement.props.accessibilityState?.disabled).toBe(true);
  fireEvent.press(screen.getByLabelText("Tăng số lượng Bình giữ nhiệt"));
  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      `/cart/items/${CART_ITEM_ID}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ quantity: 2 }),
      }),
    ),
  );
  expect(
    (await screen.findByLabelText("Tăng số lượng Bình giữ nhiệt")).props
      .accessibilityState?.disabled,
  ).toBe(true);
});

test("B07 delete removes a line and reloads the server cart", async () => {
  let cartReads = 0;
  mockRequest.mockImplementation(async (path, init) => {
    if (String(path) === "/cart" && init?.method !== "DELETE") {
      cartReads += 1;
      return cartReads === 1 ? makeCart() : makeCart([], "0");
    }
    return undefined;
  });

  renderCommerce(<CartRoute />);
  fireEvent.press(await screen.findByLabelText("Xóa Bình giữ nhiệt"));

  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      `/cart/items/${CART_ITEM_ID}`,
      expect.objectContaining({ method: "DELETE" }),
    ),
  );
  expect(await screen.findByText("Giỏ hàng đang trống.")).toBeTruthy();
  expect(cartReads).toBeGreaterThanOrEqual(2);
});

test("B07 fetch failure can be retried", async () => {
  mockRequest
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(makeCart());

  renderCommerce(<CartRoute />);

  expect(await screen.findByText("Không thể tải giỏ hàng.")).toBeTruthy();
  fireEvent.press(screen.getByText("Thử lại"));
  expect(await screen.findByText("Bình giữ nhiệt")).toBeTruthy();
});

test("B07 forbidden cart access is shown without pretending it is empty", async () => {
  mockRequest.mockRejectedValue(new ApiClientError("Not allowed", 403));

  renderCommerce(<CartRoute />);

  expect(await screen.findByText("Bạn không có quyền xem giỏ hàng.")).toBeTruthy();
  expect(screen.queryByText("Giỏ hàng đang trống.")).toBeNull();
});

test("B07 account switch loads the other buyer cart without showing cached data", async () => {
  const buyerCart = makeCart(
    [
      makeCartGroup(CART_SHOP_ID, "Giỏ của buyer 1", [makeCartItem()], "125000"),
    ],
    "125000",
  );
  const otherBuyerCart = makeCart(
    [
      makeCartGroup(
        SECOND_CART_SHOP_ID,
        "Giỏ của buyer 2",
        [
          makeCartItem({
            id: SECOND_CART_ITEM_ID,
            shopId: SECOND_CART_SHOP_ID,
            productName: "Sản phẩm buyer 2",
          }),
        ],
        "125000",
      ),
    ],
    "125000",
  );
  let cartReads = 0;
  mockRequest.mockImplementation(async (path) => {
    if (String(path) !== "/cart") throw new Error(`Unexpected request: ${path}`);
    cartReads += 1;
    return cartReads === 1 ? buyerCart : otherBuyerCart;
  });
  const view = renderCommerce(<CartRoute />);

  expect(await screen.findByText("Giỏ của buyer 1")).toBeTruthy();
  setCommerceUser({ id: "buyer-2" });
  view.rerender(<CartRoute />);

  expect(await screen.findByText("Giỏ của buyer 2")).toBeTruthy();
  expect(screen.queryByText("Giỏ của buyer 1")).toBeNull();
  expect(view.queryClient.getQueryData(["cart", "buyer-1"])).toEqual(
    buyerCart,
  );
});
