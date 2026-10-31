import React from "react";
import { ApiClientError, type components } from "@marketplace/api-client";
import { focusManager } from "@tanstack/react-query";
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
  makeAddress,
  makeCart,
  makeCartGroup,
  makeCartItem,
  makeOrder,
  makeOrderSummary,
  makePayment,
  makeQuote,
  makeSellerOrder,
  makeShipment,
  mockRequest,
  mockRouter,
  renderCommerce,
  resetCommerceMocks,
  setCommerceUser,
  setCommerceOrderId,
} from "./commerce-test-utils";
import CartRoute from "../src/app/(buyer)/cart";
import CheckoutRoute from "../src/app/(buyer)/checkout";
import OrdersRoute from "../src/app/(buyer)/orders";
import OrderDetailRoute from "../src/app/(buyer)/orders/[orderId]";

type Order = components["schemas"]["Order"];
let detailOrderSequence = 1;

function makeBuyerOrder(overrides: Partial<Order> = {}): Order {
  const id =
    overrides.id ??
    `aaaaaaaa-aaaa-4aaa-8aaa-${String(detailOrderSequence++).padStart(12, "0")}`;
  setCommerceOrderId(id);
  return { ...makeOrder(), ...overrides, id };
}

function mockOrderReads(
  order: Order,
  payments: ReturnType<typeof makePayment>[] = order.payments,
) {
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === `/orders/${order.id}`) return order;
    if (String(path) === `/payments?orderId=${order.id}`) return payments;
    throw new Error(`Unexpected order-detail request: ${path}`);
  });
}

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

test("B08 shows loading until the cart and saved addresses are both loaded", async () => {
  let resolveCart: ((cart: ReturnType<typeof makeCart>) => void) | undefined;
  let resolveAddresses:
    ((addresses: ReturnType<typeof makeAddress>[]) => void) | undefined;
  mockRequest.mockImplementation((path) => {
    if (String(path) === "/cart")
      return new Promise((resolve) => {
        resolveCart = resolve as (cart: ReturnType<typeof makeCart>) => void;
      });
    return new Promise((resolve) => {
      resolveAddresses = resolve as (
        addresses: ReturnType<typeof makeAddress>[],
      ) => void;
    });
  });

  renderCommerce(<CheckoutRoute />);

  expect(screen.getByText("Đang tải thông tin thanh toán…")).toBeTruthy();
  await act(async () => {
    resolveCart?.(makeCart());
    resolveAddresses?.([makeAddress()]);
  });
  expect(await screen.findByText("Thanh toán")).toBeTruthy();
});

test("B08 lets the buyer retry when cart or address loading fails", async () => {
  let cartReads = 0;
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") {
      cartReads += 1;
      if (cartReads === 1) throw new TypeError("offline");
      return makeCart();
    }
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);

  expect(
    await screen.findByText("Không thể tải thông tin thanh toán."),
  ).toBeTruthy();
  fireEvent.press(screen.getByText("Thử lại"));
  expect(await screen.findByText("Thanh toán")).toBeTruthy();
  expect(cartReads).toBeGreaterThanOrEqual(2);
});

test("B08 empty cart and missing address block quote creation", async () => {
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return makeCart([], "0");
    if (String(path) === "/users/me/addresses") return [];
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);

  expect(await screen.findByText("Chưa có sản phẩm được chọn.")).toBeTruthy();
  expect(screen.getByText("Chưa có địa chỉ nhận hàng.")).toBeTruthy();
  expect(screen.getByText("Thêm địa chỉ")).toBeTruthy();
  expect(
    mockRequest.mock.calls.some(([path]) => String(path) === "/checkout/quotes"),
  ).toBe(false);
});

test("B08 selects the saved default address", async () => {
  const firstAddress = makeAddress({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recipientName: "Nguyễn An",
    isDefault: false,
  });
  const defaultAddress = makeAddress({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    recipientName: "Lê Bình",
    isDefault: true,
  });
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return makeCart();
    if (String(path) === "/users/me/addresses")
      return [firstAddress, defaultAddress];
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);

  const selected = await screen.findByLabelText("Địa chỉ của Lê Bình (Mặc định)");
  expect(selected.props.accessibilityState?.checked).toBe(true);
  expect(
    screen.getByLabelText("Địa chỉ của Nguyễn An").props.accessibilityState
      ?.checked,
  ).toBe(false);
});

test("B08 requests only selected cart lines and displays server quote groups", async () => {
  const unselectedItem = makeCartItem({
    id: SECOND_CART_ITEM_ID,
    productName: "Ấm siêu tốc",
    selected: false,
  });
  const cart = makeCart(
    [
      makeCartGroup(
        CART_SHOP_ID,
        "Nhà Bếp Mộc",
        [makeCartItem(), unselectedItem],
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
          }),
        ],
        "125000",
      ),
    ],
    "250000",
  );
  const quote = makeQuote({
    lines: [
      {
        cartItemId: CART_ITEM_ID,
        variantId: "55555555-5555-4555-8555-555555555555",
        shopId: CART_SHOP_ID,
        quantity: 1,
        unitPrice: "125000",
        lineTotal: "125000",
      },
      {
        cartItemId: "88888888-8888-4888-8888-888888888888",
        variantId: "55555555-5555-4555-8555-555555555555",
        shopId: SECOND_CART_SHOP_ID,
        quantity: 1,
        unitPrice: "90000",
        lineTotal: "90000",
      },
    ],
    groups: [
      {
        shopId: CART_SHOP_ID,
        subtotal: "125000",
        shippingFee: "10000",
        total: "135000",
      },
      {
        shopId: SECOND_CART_SHOP_ID,
        subtotal: "90000",
        shippingFee: "15000",
        total: "105000",
      },
    ],
    total: "240000",
  });
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return cart;
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    if (String(path) === "/checkout/quotes") return quote;
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);
  fireEvent.press(await screen.findByText("Tạo báo giá"));

  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      "/checkout/quotes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          cartItemIds: [CART_ITEM_ID, "88888888-8888-4888-8888-888888888888"],
          addressId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          paymentMethod: "COD",
        }),
      }),
    ),
  );
  expect(screen.getAllByText("Hạt Mây")).toHaveLength(2);
  expect(screen.getByText("Phí giao hàng: 10.000₫")).toBeTruthy();
  expect(screen.getByText("Phí giao hàng: 15.000₫")).toBeTruthy();
  expect(screen.getByText("Tổng cộng: 240.000₫")).toBeTruthy();
  expect(
    mockRequest.mock.calls.some(([, init]) =>
      String(init?.body).includes(SECOND_CART_ITEM_ID),
    ),
  ).toBe(false);
});

test("B08 shows per-line server issues and does not infer quote totals", async () => {
  const quote = makeQuote({
    total: "110000",
    valid: false,
    issues: [
      {
        cartItemId: CART_ITEM_ID,
        code: "INSUFFICIENT_STOCK",
        message: "Tồn kho không đủ cho sản phẩm này.",
      },
    ],
  });
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return makeCart();
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    if (String(path) === "/checkout/quotes") return quote;
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);
  fireEvent.press(await screen.findByText("Tạo báo giá"));

  expect(
    await screen.findByText(/Tồn kho không đủ cho sản phẩm này\./),
  ).toBeTruthy();
  expect(screen.getByText("Tổng cộng: 110.000₫")).toBeTruthy();
  expect(screen.getByLabelText("Đặt hàng").props.accessibilityState?.disabled).toBe(
    true,
  );
});

test("B08 disables a quote that has expired according to its server deadline", async () => {
  const quote = makeQuote({ expiresAt: "2020-01-01T00:00:00.000Z" });
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return makeCart();
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    if (String(path) === "/checkout/quotes") return quote;
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);
  fireEvent.press(await screen.findByText("Tạo báo giá"));

  expect(await screen.findByText("Báo giá đã hết hạn.")).toBeTruthy();
  expect(
    screen.getByLabelText("Đặt hàng").props.accessibilityState?.disabled,
  ).toBe(true);
  expect(
    screen.getByText(
      `Báo giá có hiệu lực đến ${new Date(quote.expiresAt).toLocaleString("vi-VN")}`,
    ),
  ).toBeTruthy();
});

test("B08 invalidates the quote when address or payment method changes", async () => {
  const firstAddress = makeAddress();
  const secondAddress = makeAddress({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    recipientName: "Lê Bình",
    isDefault: false,
  });
  const quoteResponses = [makeQuote(), makeQuote(), makeQuote()];
  let quoteReads = 0;
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return makeCart();
    if (String(path) === "/users/me/addresses")
      return [firstAddress, secondAddress];
    if (String(path) === "/checkout/quotes")
      return quoteResponses[quoteReads++]!;
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);
  fireEvent.press(await screen.findByText("Tạo báo giá"));
  expect(await screen.findByText("Tổng cộng: 135.000₫")).toBeTruthy();

  fireEvent.press(screen.getByLabelText("Địa chỉ của Lê Bình"));
  expect(screen.queryByText(/Tổng cộng:/)).toBeNull();
  fireEvent.press(screen.getByText("Tạo báo giá"));
  await waitFor(() => expect(quoteReads).toBe(2));
  expect(mockRequest.mock.calls.filter(([path]) => path === "/checkout/quotes")[1]?.[1]?.body).toBe(
    JSON.stringify({
      cartItemIds: [CART_ITEM_ID],
      addressId: secondAddress.id,
      paymentMethod: "COD",
    }),
  );

  fireEvent.press(screen.getByLabelText("Thanh toán thử nghiệm"));
  expect(screen.queryByText(/Tổng cộng:/)).toBeNull();
  fireEvent.press(screen.getByText("Tạo báo giá"));
  await waitFor(() => expect(quoteReads).toBe(3));
  expect(mockRequest.mock.calls.filter(([path]) => path === "/checkout/quotes")[2]?.[1]?.body).toBe(
    JSON.stringify({
      cartItemIds: [CART_ITEM_ID],
      addressId: secondAddress.id,
      paymentMethod: "MOCK",
    }),
  );
});

test("B08 hides an old quote when selected cart lines change", async () => {
  const initialCart = makeCart();
  const changedCart = makeCart(
    [
      makeCartGroup(
        CART_SHOP_ID,
        "Nhà Bếp Mộc",
        [
          makeCartItem({ selected: false }),
          makeCartItem({
            id: SECOND_CART_ITEM_ID,
            selected: true,
            productName: "Ấm siêu tốc",
            currentUnitPrice: "99000",
          }),
        ],
        "99000",
      ),
    ],
    "99000",
  );
  let quoteReads = 0;
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return initialCart;
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    if (String(path) === "/checkout/quotes") {
      quoteReads += 1;
      return makeQuote({ total: quoteReads === 1 ? "135000" : "99000" });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = renderCommerce(<CheckoutRoute />);

  fireEvent.press(await screen.findByText("Tạo báo giá"));
  expect(await screen.findByText("Tổng cộng: 135.000₫")).toBeTruthy();
  act(() => {
    view.queryClient.setQueryData(["cart", "buyer-1"], changedCart);
  });

  await waitFor(() => expect(screen.queryByText(/Tổng cộng:/)).toBeNull());
  expect(screen.queryByLabelText("Đặt hàng")).toBeNull();
  fireEvent.press(screen.getByText("Tạo báo giá"));

  await waitFor(() => expect(quoteReads).toBe(2));
  expect(mockRequest.mock.calls.filter(([path]) => path === "/checkout/quotes")[1]?.[1]?.body).toBe(
    JSON.stringify({
      cartItemIds: [SECOND_CART_ITEM_ID],
      addressId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      paymentMethod: "COD",
    }),
  );
  expect(screen.getByText("Tổng cộng: 99.000₫")).toBeTruthy();
});

test("B08 confirms all-or-none checkout with server quote and invalidates Buyer reads", async () => {
  const quote = makeQuote();
  const order = makeOrder();
  let cartReads = 0;
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") {
      cartReads += 1;
      return makeCart();
    }
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    if (String(path) === "/checkout/quotes") return quote;
    if (String(path) === "/checkout") return order;
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = renderCommerce(<CheckoutRoute />);
  view.queryClient.setQueryData(["orders", "buyer-1"], []);

  fireEvent.press(await screen.findByText("Tạo báo giá"));
  fireEvent.press(await screen.findByLabelText("Đặt hàng"));

  await waitFor(() =>
    expect(mockRouter.push).toHaveBeenCalledWith(`/orders/${order.id}`),
  );
  const checkoutCall = mockRequest.mock.calls.find(
    ([path]) => String(path) === "/checkout",
  );
  expect(checkoutCall?.[1]).toEqual(
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ quoteId: quote.quoteId }),
      headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
    }),
  );
  expect(cartReads).toBeGreaterThanOrEqual(2);
  expect(
    view.queryClient.getQueryState(["orders", "buyer-1"])?.isInvalidated,
  ).toBe(true);
});

test("B08 retry after a network error reuses the checkout key and request body", async () => {
  const quote = makeQuote();
  const order = makeOrder();
  let checkoutAttempts = 0;
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return makeCart();
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    if (String(path) === "/checkout/quotes") return quote;
    if (String(path) === "/checkout") {
      checkoutAttempts += 1;
      if (checkoutAttempts === 1) throw new TypeError("offline");
      return order;
    }
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);
  fireEvent.press(await screen.findByText("Tạo báo giá"));
  fireEvent.press(await screen.findByLabelText("Đặt hàng"));
  expect(
    await screen.findByText("Không thể xác nhận đơn hàng. Vui lòng thử lại."),
  ).toBeTruthy();
  fireEvent.press(screen.getByText("Thử đặt hàng lại"));

  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
  const checkoutCalls = mockRequest.mock.calls.filter(
    ([path]) => String(path) === "/checkout",
  );
  expect(checkoutCalls).toHaveLength(2);
  expect(checkoutCalls[1]?.[1]?.headers).toEqual(checkoutCalls[0]?.[1]?.headers);
  expect(checkoutCalls[1]?.[1]?.body).toBe(checkoutCalls[0]?.[1]?.body);
});

test("B08 PRICE_CHANGED requires an explicit new quote and has no replacement quote", async () => {
  const quoteResponses = [makeQuote(), makeQuote({ total: "150000" })];
  let quoteReads = 0;
  let checkoutReads = 0;
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === "/cart") return makeCart();
    if (String(path) === "/users/me/addresses") return [makeAddress()];
    if (String(path) === "/checkout/quotes")
      return quoteResponses[quoteReads++]!;
    if (String(path) === "/checkout") {
      checkoutReads += 1;
      throw new ApiClientError("PRICE_CHANGED", 409, {
        error: { code: "PRICE_CHANGED", message: "Giá đã thay đổi" },
      });
    }
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<CheckoutRoute />);
  fireEvent.press(await screen.findByText("Tạo báo giá"));
  fireEvent.press(await screen.findByLabelText("Đặt hàng"));

  expect(
    await screen.findByText(
      "Giá hoặc tồn kho đã thay đổi. Hãy tạo và xem lại báo giá mới.",
    ),
  ).toBeTruthy();
  expect(quoteReads).toBe(1);
  expect(checkoutReads).toBe(1);
  fireEvent.press(screen.getByText("Tạo báo giá mới"));

  await waitFor(() => expect(quoteReads).toBe(2));
  expect(screen.getByText("Tổng cộng: 150.000₫")).toBeTruthy();
  expect(checkoutReads).toBe(1);
});

test("B09 shows loading while the buyer's orders are being fetched", async () => {
  let resolveOrders: ((orders: ReturnType<typeof makeOrderSummary>[]) => void) | undefined;
  mockRequest.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOrders = resolve as (
          orders: ReturnType<typeof makeOrderSummary>[],
        ) => void;
      }),
  );

  renderCommerce(<OrdersRoute />);

  expect(screen.getByText("Đang tải đơn hàng…")).toBeTruthy();
  await act(async () => resolveOrders?.([makeOrderSummary()]));
  expect(await screen.findByText("MP-2026-00001")).toBeTruthy();
});

test("B09 empty order history offers product discovery", async () => {
  mockRequest.mockResolvedValue([]);

  renderCommerce(<OrdersRoute />);

  expect(await screen.findByText("Bạn chưa có đơn hàng nào.")).toBeTruthy();
  fireEvent.press(screen.getByText("Khám phá sản phẩm"));
  expect(mockRouter.push).toHaveBeenCalledWith("/products");
});

test("B09 sends status and payment filters to the server", async () => {
  mockRequest.mockResolvedValue([makeOrderSummary()]);

  renderCommerce(<OrdersRoute />);
  await screen.findByText("MP-2026-00001");
  fireEvent.press(screen.getByLabelText("Trạng thái: Đã giao"));
  expect(screen.getByLabelText("Thanh toán: Đã thanh toán")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Thanh toán: Đã thanh toán"));

  await waitFor(() => {
    const paths = mockRequest.mock.calls.map(([path]) => String(path));
    expect(paths.some((path) => new URL(path, "https://example.test").searchParams.get("status") === "DELIVERED")).toBe(true);
    expect(paths.some((path) => new URL(path, "https://example.test").searchParams.get("paymentStatus") === "PAID")).toBe(true);
  });
});

test("B09 converts inclusive ISO date filters to RFC3339 UTC bounds", async () => {
  mockRequest.mockResolvedValue([]);

  renderCommerce(<OrdersRoute />);
  await screen.findByText("Bạn chưa có đơn hàng nào.");
  fireEvent.changeText(screen.getByLabelText("Từ ngày"), "2026-10-20");
  fireEvent.changeText(screen.getByLabelText("Đến ngày"), "2026-10-21");
  fireEvent.press(screen.getByText("Lọc theo ngày"));

  await waitFor(() => {
    const paths = mockRequest.mock.calls.map(([path]) => String(path));
    const filteredPath = paths.find((path) => path.includes("from="));
    expect(filteredPath).toBeTruthy();
    const params = new URL(filteredPath!, "https://example.test").searchParams;
    expect(params.get("from")).toBe("2026-10-20T00:00:00.000Z");
    expect(params.get("to")).toBe("2026-10-21T23:59:59.999Z");
  });
});

test("B09 rejects an invalid date range without sending it", async () => {
  mockRequest.mockResolvedValue([]);

  renderCommerce(<OrdersRoute />);
  await screen.findByText("Bạn chưa có đơn hàng nào.");
  fireEvent.changeText(screen.getByLabelText("Từ ngày"), "2026-02-30");
  fireEvent.press(screen.getByText("Lọc theo ngày"));

  expect(await screen.findByText("Nhập ngày hợp lệ theo định dạng YYYY-MM-DD.")).toBeTruthy();
  expect(mockRequest.mock.calls.some(([path]) => String(path).includes("from="))).toBe(false);
});

test("B09 pages through server results with page size 20", async () => {
  const firstPage = Array.from({ length: 20 }, (_, index) =>
    makeOrderSummary({ orderNumber: `MP-P1-${String(index + 1).padStart(2, "0")}` }),
  );
  const secondPage = [makeOrderSummary({ orderNumber: "MP-P2-01" })];
  mockRequest.mockImplementation(async (path) => {
    const page = new URL(String(path), "https://example.test").searchParams.get("page");
    return page === "2" ? secondPage : firstPage;
  });

  renderCommerce(<OrdersRoute />);
  expect(await screen.findByText("MP-P1-01")).toBeTruthy();
  fireEvent.press(screen.getByText("Trang sau"));
  expect(await screen.findByText("MP-P2-01")).toBeTruthy();
  expect(screen.queryByText("MP-P1-01")).toBeNull();
  expect(screen.getByText("Trang 2")).toBeTruthy();
  expect(screen.getByLabelText("Trang sau").props.accessibilityState?.disabled).toBe(true);
  fireEvent.press(screen.getByText("Trang trước"));
  expect(await screen.findByText("MP-P1-01")).toBeTruthy();
  expect(
    mockRequest.mock.calls.some(
      ([path]) => new URL(String(path), "https://example.test").searchParams.get("pageSize") === "20",
    ),
  ).toBe(true);
});

test("B09 displays payment and partial-cancellation labels from the server", async () => {
  const order = makeOrderSummary({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    orderNumber: "MP-PARTIAL-1",
    status: "CANCELLED",
    partiallyCancelled: true,
    paymentStatus: "PARTIALLY_REFUNDED",
    originalTotal: "250000",
    outstandingAmount: "100000",
  });
  mockRequest.mockResolvedValue([order]);

  renderCommerce(<OrdersRoute />);

  expect(await screen.findByText("MP-PARTIAL-1")).toBeTruthy();
  expect(screen.getByText("Đã hủy một phần")).toBeTruthy();
  expect(screen.getByText("Đã hoàn một phần")).toBeTruthy();
  expect(screen.getByText("Tổng đơn: 250.000₫ · Còn phải trả: 100.000₫")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Đơn hàng MP-PARTIAL-1"));
  expect(mockRouter.push).toHaveBeenCalledWith(`/orders/${order.id}`);
});

test("B09 lets the buyer retry after a list request fails", async () => {
  let reads = 0;
  mockRequest.mockImplementation(async () => {
    reads += 1;
    if (reads === 1) throw new TypeError("offline");
    return [makeOrderSummary()];
  });

  renderCommerce(<OrdersRoute />);
  expect(await screen.findByText("Không thể tải đơn hàng.")).toBeTruthy();
  fireEvent.press(screen.getByText("Thử lại"));
  expect(await screen.findByText("MP-2026-00001")).toBeTruthy();
  expect(reads).toBeGreaterThanOrEqual(2);
});

test("B09 shows a forbidden state instead of treating 403 as an empty list", async () => {
  mockRequest.mockRejectedValue(
    new ApiClientError("FORBIDDEN", 403, {
      error: { code: "FORBIDDEN", message: "Hidden server detail" },
    }),
  );

  renderCommerce(<OrdersRoute />);

  expect(await screen.findByText("Bạn không có quyền xem đơn hàng.")).toBeTruthy();
  expect(screen.queryByText("Bạn chưa có đơn hàng nào.")).toBeNull();
  expect(screen.queryByText("Hidden server detail")).toBeNull();
});

test("B09 account switch uses a separate query and never shows the previous buyer's rows", async () => {
  let resolveBuyerTwo:
    | ((orders: ReturnType<typeof makeOrderSummary>[]) => void)
    | undefined;
  mockRequest.mockImplementationOnce(async () => [
    makeOrderSummary({ orderNumber: "BUYER-ONE-ORDER" }),
  ]).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveBuyerTwo = resolve as (
          orders: ReturnType<typeof makeOrderSummary>[],
        ) => void;
      }),
  );
  const view = renderCommerce(<OrdersRoute />);

  expect(await screen.findByText("BUYER-ONE-ORDER")).toBeTruthy();
  setCommerceUser({ id: "buyer-2" });
  act(() => view.rerender(<OrdersRoute />));
  expect(screen.queryByText("BUYER-ONE-ORDER")).toBeNull();
  await act(async () =>
    resolveBuyerTwo?.([makeOrderSummary({ orderNumber: "BUYER-TWO-ORDER" })]),
  );
  expect(await screen.findByText("BUYER-TWO-ORDER")).toBeTruthy();
  expect(screen.queryByText("BUYER-ONE-ORDER")).toBeNull();
  expect(view.queryClient.getQueryData(["orders", "buyer-1", expect.anything()])).toBeUndefined();
});

test("B09 query key is scoped by buyer, filters and page", async () => {
  mockRequest.mockResolvedValue(
    Array.from({ length: 20 }, (_, index) => makeOrderSummary({ orderNumber: `MP-KEY-${index}` })),
  );
  const view = renderCommerce(<OrdersRoute />);

  await screen.findByText("MP-KEY-0");
  fireEvent.press(screen.getByLabelText("Trạng thái: Đã giao"));
  await waitFor(() =>
    expect(screen.getByLabelText("Trang sau").props.accessibilityState?.disabled).toBe(false),
  );
  fireEvent.press(screen.getByLabelText("Trang sau"));

  await waitFor(() => {
    const orderKeys = view.queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey)
      .filter((key) => key[0] === "orders" && key[1] === "buyer-1");
    expect(orderKeys.length).toBeGreaterThanOrEqual(2);
    expect(
      orderKeys.some(
        (key) =>
          JSON.stringify(key).includes('"status":"DELIVERED"') &&
          JSON.stringify(key).includes('"page":2'),
      ),
    ).toBe(true);
  });
});

test("B09 aborts the request when the screen is removed", async () => {
  let requestSignal: AbortSignal | undefined;
  mockRequest.mockImplementationOnce(
    (_path, init) => {
      requestSignal = init?.signal as AbortSignal | undefined;
      return new Promise(() => undefined);
    },
  );
  const view = renderCommerce(<OrdersRoute />);
  await waitFor(() => expect(requestSignal).toBeDefined());

  view.unmount();
  await view.queryClient.cancelQueries({ queryKey: ["orders", "buyer-1"] });

  expect(requestSignal?.aborted).toBe(true);
});

test("B09 refetches when React Query regains focus", async () => {
  let reads = 0;
  mockRequest.mockImplementation(async () => {
    reads += 1;
    return [makeOrderSummary()];
  });
  renderCommerce(<OrdersRoute />);
  await screen.findByText("MP-2026-00001");
  expect(reads).toBe(1);

  act(() => focusManager.setFocused(false));
  act(() => focusManager.setFocused(true));

  await waitFor(() => expect(reads).toBeGreaterThanOrEqual(2));
});

test("B10 renders server snapshots, payments/refunds, tracking and payment deadline", async () => {
  const order = makeBuyerOrder({
    orderNumber: "MP-DETAIL-01",
    status: "SHIPPING",
    partiallyCancelled: false,
    originalTotal: "135000",
    capturedAmount: "135000",
    refundedAmount: "25000",
    outstandingAmount: "25000",
    paymentMethod: "MOCK",
    paymentStatus: "PARTIALLY_REFUNDED",
    paymentDeadline: "2026-11-01T12:00:00.000Z",
    version: 8,
  });
  const sellerOrder = makeSellerOrder({
    orderId: order.id,
    status: "SHIPPING",
    capturedAmount: "135000",
    refundedAmount: "25000",
    outstandingAmount: "25000",
    shipment: makeShipment(),
  });
  order.sellerOrders = [sellerOrder];
  const payment = makePayment({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    orderId: order.id,
    transactionCode: "TXN-LATE-01",
    status: "SUCCEEDED",
    settlementKind: "LATE_COMPENSATION",
    originalAttemptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    amount: "25000",
    allocations: [{ sellerOrderId: sellerOrder.id, amount: "25000" }],
    refunds: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        sellerOrderId: sellerOrder.id,
        amount: "25000",
        reason: "BUYER_CANCELLED",
        createdAt: "2026-11-01T11:00:00.000Z",
      },
    ],
  });
  order.payments = [payment];
  mockOrderReads(order, [payment]);

  renderCommerce(<OrderDetailRoute />);

  expect(await screen.findByText("MP-DETAIL-01")).toBeTruthy();
  expect(screen.getByText("Nhà Bếp Mộc")).toBeTruthy();
  expect(screen.getByText("1 Đường A, Phường 1, Quận 1, TP Hồ Chí Minh")).toBeTruthy();
  expect(screen.getByText("Bình giữ nhiệt × 1 · 125.000₫")).toBeTruthy();
  expect(screen.getByText("Tổng ban đầu: 135.000₫")).toBeTruthy();
  expect(screen.getByText("Đã thu 135.000₫ · Đã hoàn 25.000₫")).toBeTruthy();
  expect(screen.getByText(/Hạn thanh toán:/)).toBeTruthy();
  expect(screen.getByText("Mã vận đơn: SHIP-TEST-001")).toBeTruthy();
  expect(screen.getAllByText("Trạng thái: Đang giao")).toHaveLength(2);
  expect(screen.getByText(/TXN-LATE-01/)).toBeTruthy();
  expect(screen.getByText(/bù trừ thanh toán muộn/i)).toBeTruthy();
  expect(screen.getByText(/Hoàn 25\.000₫/)).toBeTruthy();
  expect(screen.getAllByText(/Còn phải trả: 25\.000₫/)).toHaveLength(3);
});

test.each([
  [403, "FORBIDDEN", "Bạn không có quyền xem đơn hàng này."],
  [404, "NOT_FOUND", "Không tìm thấy đơn hàng."],
] as const)("B10 presents a safe detail error for HTTP %s", async (status, code, message) => {
  const order = makeBuyerOrder();
  mockRequest.mockImplementation(async (path) => {
    if (String(path) === `/orders/${order.id}`)
      throw new ApiClientError(code, status, {
        error: { code, message: "Hidden server details" },
      });
    if (String(path) === `/payments?orderId=${order.id}`) return [];
    throw new Error(`Unexpected request: ${path}`);
  });

  renderCommerce(<OrderDetailRoute />);

  expect(await screen.findByText(message)).toBeTruthy();
  expect(screen.queryByText("Hidden server details")).toBeNull();
});

test("B10 treats the base payment row as no mock attempt after a cold cache", async () => {
  const order = makeBuyerOrder({ paymentMethod: "MOCK", paymentStatus: "UNPAID" });
  const basePayment = makePayment({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    orderId: order.id,
    transactionCode: order.orderNumber,
    status: "PENDING",
  });
  order.payments = [basePayment];
  mockOrderReads(order, [basePayment]);

  renderCommerce(<OrderDetailRoute />);

  expect(await screen.findByText("Tạo lần thử thanh toán")).toBeTruthy();
  expect(screen.queryByText("Mô phỏng thanh toán thành công")).toBeNull();
  expect(screen.queryByText("Mô phỏng thất bại")).toBeNull();
  expect(screen.queryByText("Hủy lần thử thanh toán")).toBeNull();
});

test.each([
  ["SUCCEEDED", "Mô phỏng thanh toán thành công"],
  ["FAILED", "Mô phỏng thất bại"],
  ["CANCELLED", "Hủy lần thử thanh toán"],
] as const)("B10 posts MOCK result %s with current Order.version", async (outcome, label) => {
  let order = makeBuyerOrder({ paymentMethod: "MOCK", version: 19 });
  const attempt = makePayment({
    id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    orderId: order.id,
    transactionCode: "TXN-PENDING-01",
    status: "PENDING",
  });
  order.payments = [attempt];
  let payments = [attempt];
  const resultCalls: Array<[string, RequestInit?]> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return order;
    if (route === `/payments?orderId=${order.id}`) return payments;
    if (route === `/payments/${attempt.id}/mock-result`) {
      resultCalls.push([route, init]);
      const body = JSON.parse(String(init?.body)) as {
        eventId: string;
        outcome: string;
        expectedVersion: number;
      };
      expect(body.outcome).toBe(outcome);
      payments = [{ ...attempt, status: outcome }];
      order = { ...order, version: order.version + 1, payments };
      return payments[0];
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText(label));

  await waitFor(() => expect(resultCalls).toHaveLength(1));
  const sentBody = JSON.parse(String(resultCalls[0]?.[1]?.body));
  expect(sentBody).toEqual(
    expect.objectContaining({
      outcome,
      expectedVersion: 19,
      eventId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }),
  );
  expect(resultCalls[0]?.[1]?.headers).toEqual({
    "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/i),
  });
  await waitFor(() => expect(mockRequest.mock.calls.filter(([path]) => String(path) === `/orders/${order.id}`).length).toBeGreaterThan(1));
});

test("B10 retries mock-attempt creation with the same key and body", async () => {
  const order = makeBuyerOrder({ paymentMethod: "MOCK" });
  const basePayment = makePayment({
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    orderId: order.id,
    transactionCode: order.orderNumber,
    status: "PENDING",
  });
  const attempt = makePayment({
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
    orderId: order.id,
    transactionCode: "TXN-NEW-01",
    status: "PENDING",
  });
  let payments = [basePayment];
  const attemptCalls: Array<RequestInit | undefined> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return { ...order, payments };
    if (route === `/payments?orderId=${order.id}`) return payments;
    if (route === "/payments/mock-attempts") {
      attemptCalls.push(init);
      if (attemptCalls.length === 1) throw new TypeError("offline");
      payments = [attempt];
      return attempt;
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText("Tạo lần thử thanh toán"));
  expect(await screen.findByText("Không thể bắt đầu thanh toán. Vui lòng thử lại.")).toBeTruthy();
  fireEvent.press(screen.getByText("Thử tạo lần thanh toán lại"));

  await waitFor(() => expect(attemptCalls).toHaveLength(2));
  expect(attemptCalls[1]?.headers).toEqual(attemptCalls[0]?.headers);
  expect(attemptCalls[1]?.body).toBe(attemptCalls[0]?.body);
  expect(JSON.parse(String(attemptCalls[0]?.body))).toEqual({ orderId: order.id });
  expect(screen.queryByText("Thu COD")).toBeNull();
});

test("B10 retries mock-result with the same event, key and body", async () => {
  const order = makeBuyerOrder({ paymentMethod: "MOCK", version: 5 });
  const attempt = makePayment({
    id: "ffffffff-ffff-4fff-8fff-fffffffffff1",
    orderId: order.id,
    transactionCode: "TXN-RETRY-01",
    status: "PENDING",
  });
  let payments = [attempt];
  const resultCalls: Array<RequestInit | undefined> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return order;
    if (route === `/payments?orderId=${order.id}`) return payments;
    if (route === `/payments/${attempt.id}/mock-result`) {
      resultCalls.push(init);
      if (resultCalls.length === 1) throw new TypeError("timeout");
      payments = [{ ...attempt, status: "FAILED" }];
      return payments[0];
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText("Mô phỏng thất bại"));
  expect(await screen.findByText("Không thể cập nhật thanh toán. Vui lòng thử lại.")).toBeTruthy();
  fireEvent.press(screen.getByText("Thử lại kết quả thanh toán"));

  await waitFor(() => expect(resultCalls).toHaveLength(2));
  expect(resultCalls[1]?.headers).toEqual(resultCalls[0]?.headers);
  expect(resultCalls[1]?.body).toBe(resultCalls[0]?.body);
  const body = JSON.parse(String(resultCalls[0]?.body));
  expect(body).toEqual(expect.objectContaining({ eventId: expect.any(String), outcome: "FAILED", expectedVersion: 5 }));
});

test.each([
  ["FAILED", "Mô phỏng thất bại"],
  ["CANCELLED", "Hủy lần thử thanh toán"],
] as const)("B10 starts a new payment attempt after a terminal %s attempt", async (terminalOutcome, resultLabel) => {
  let order = makeBuyerOrder({ paymentMethod: "MOCK", version: 7 });
  const basePayment = makePayment({
    id: "11111111-2222-4333-8444-555555555550",
    orderId: order.id,
    transactionCode: order.orderNumber,
    status: "PENDING",
  });
  const firstAttempt = makePayment({
    id: "11111111-2222-4333-8444-555555555553",
    orderId: order.id,
    transactionCode: "TXN-FIRST-01",
    status: "PENDING",
  });
  const terminalAttempt = makePayment({
    id: "11111111-2222-4333-8444-555555555551",
    orderId: order.id,
    transactionCode: `TXN-${terminalOutcome}-01`,
    status: terminalOutcome,
  });
  const newAttempt = makePayment({
    id: "11111111-2222-4333-8444-555555555552",
    orderId: order.id,
    transactionCode: "TXN-NEW-02",
    status: "PENDING",
  });
  let payments = [basePayment];
  const attemptCalls: Array<RequestInit | undefined> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return { ...order, payments };
    if (route === `/payments?orderId=${order.id}`) return payments;
    if (route === "/payments/mock-attempts") {
      attemptCalls.push(init);
      if (attemptCalls.length === 1) {
        payments = [firstAttempt];
        return firstAttempt;
      }
      payments = [terminalAttempt, newAttempt];
      return newAttempt;
    }
    if (route === `/payments/${firstAttempt.id}/mock-result`) {
      payments = [terminalAttempt];
      order = { ...order, version: order.version + 1, payments };
      return terminalAttempt;
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  expect(await screen.findByText("Tạo lần thử thanh toán")).toBeTruthy();
  fireEvent.press(screen.getByText("Tạo lần thử thanh toán"));
  await screen.findByText(resultLabel);
  fireEvent.press(screen.getByText(resultLabel));
  await screen.findByText("Tạo lần thử thanh toán");
  fireEvent.press(screen.getByText("Tạo lần thử thanh toán"));

  await waitFor(() => expect(attemptCalls).toHaveLength(2));
  const firstKey = new Headers(attemptCalls[0]?.headers).get("Idempotency-Key");
  const secondKey = new Headers(attemptCalls[1]?.headers).get("Idempotency-Key");
  expect(firstKey).toMatch(/^[0-9a-f-]{36}$/i);
  expect(secondKey).toMatch(/^[0-9a-f-]{36}$/i);
  expect(secondKey).not.toBe(firstKey);
  await screen.findByText(/TXN-NEW-02/);
  expect(screen.getByText("Mô phỏng thất bại")).toBeTruthy();
});

test.each([
  ["UNPAID", "0", "COD chưa thu"],
  ["PAID", "135000", "COD đã thu"],
] as const)("B10 labels COD %s without a Buyer collection request", async (paymentStatus, capturedAmount, label) => {
  const order = makeBuyerOrder({
    paymentMethod: "COD",
    paymentStatus,
    capturedAmount,
    outstandingAmount: paymentStatus === "PAID" ? "0" : "135000",
  });
  mockOrderReads(order, order.payments);

  renderCommerce(<OrderDetailRoute />);

  expect(await screen.findByText(label)).toBeTruthy();
  expect(screen.queryByText("Mô phỏng thanh toán thành công")).toBeNull();
  expect(
    mockRequest.mock.calls.some(([path]) => String(path).includes("collection")),
  ).toBe(false);
});

test("B10 sends whole-order cancellation with the MarketplaceOrder version", async () => {
  let order = makeBuyerOrder({ version: 23, status: "PENDING" });
  const parts = [
    makeSellerOrder({ orderId: order.id, version: 4 }),
    makeSellerOrder({
      id: "22222222-3333-4444-8555-666666666661",
      orderId: order.id,
      shopNameSnapshot: "Hạt Mây",
      version: 9,
    }),
  ];
  order.sellerOrders = parts;
  const cancelCalls: Array<[string, RequestInit?]> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return order;
    if (route === `/payments?orderId=${order.id}`) return [];
    if (route === `/orders/${order.id}/cancel`) {
      cancelCalls.push([route, init]);
      order = {
        ...order,
        status: "CANCELLED",
        version: order.version + 1,
        sellerOrders: order.sellerOrders.map((part) => ({ ...part, status: "CANCELLED" })),
      };
      return { orderId: order.id, status: "CANCELLED", cancelledSellerOrderIds: parts.map((part) => part.id) };
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText("Hủy toàn đơn"));
  fireEvent.changeText(screen.getByLabelText("Lý do hủy"), "Đổi ý");
  fireEvent.press(screen.getByText("Xác nhận hủy"));

  await waitFor(() => expect(cancelCalls).toHaveLength(1));
  expect(cancelCalls[0]?.[1]?.body).toBe(JSON.stringify({ reason: "Đổi ý", expectedVersion: 23 }));
  expect(cancelCalls[0]?.[1]?.headers).toEqual({
    "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/i),
  });
  await waitFor(() => expect(order.status).toBe("CANCELLED"));
});

test("B10 sends part cancellation with the SellerOrder version", async () => {
  const order = makeBuyerOrder({ status: "PENDING", version: 40 });
  const part = makeSellerOrder({ version: 13 });
  order.sellerOrders = [
    part,
    makeSellerOrder({
      id: "33333333-4444-4555-8666-777777777771",
      orderId: order.id,
      status: "CONFIRMED",
      shopNameSnapshot: "Hạt Mây",
    }),
  ];
  const cancelCalls: Array<[string, RequestInit?]> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return order;
    if (route === `/payments?orderId=${order.id}`) return [];
    if (route === `/orders/${order.id}/seller-orders/${part.id}/cancel`) {
      cancelCalls.push([route, init]);
      return { orderId: order.id, sellerOrderId: part.id, status: "CANCELLED" };
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText("Hủy riêng Nhà Bếp Mộc"));
  fireEvent.changeText(screen.getByLabelText("Lý do hủy"), "Không còn nhu cầu");
  fireEvent.press(screen.getByText("Xác nhận hủy"));

  await waitFor(() => expect(cancelCalls).toHaveLength(1));
  expect(cancelCalls[0]?.[0]).toBe(`/orders/${order.id}/seller-orders/${part.id}/cancel`);
  expect(cancelCalls[0]?.[1]?.body).toBe(JSON.stringify({ reason: "Không còn nhu cầu", expectedVersion: 13 }));
});

test("B10 cancellation retry reuses its idempotency key and body", async () => {
  const order = makeBuyerOrder({ status: "PENDING", version: 6 });
  order.sellerOrders = [makeSellerOrder({ orderId: order.id })];
  const cancelCalls: Array<RequestInit | undefined> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return order;
    if (route === `/payments?orderId=${order.id}`) return [];
    if (route === `/orders/${order.id}/cancel`) {
      cancelCalls.push(init);
      if (cancelCalls.length === 1) throw new TypeError("timeout");
      return { orderId: order.id, status: "CANCELLED", cancelledSellerOrderIds: [] };
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText("Hủy toàn đơn"));
  fireEvent.changeText(screen.getByLabelText("Lý do hủy"), "Đổi ý");
  fireEvent.press(screen.getByText("Xác nhận hủy"));
  expect(await screen.findByText("Không thể hủy đơn. Vui lòng thử lại.")).toBeTruthy();
  fireEvent.press(screen.getByText("Thử hủy lại"));

  await waitFor(() => expect(cancelCalls).toHaveLength(2));
  expect(cancelCalls[1]?.headers).toEqual(cancelCalls[0]?.headers);
  expect(cancelCalls[1]?.body).toBe(cancelCalls[0]?.body);
});

test("B10 whole-cancel 409 names blocking seller shops and refetches", async () => {
  const order = makeBuyerOrder({ status: "PENDING", version: 12 });
  const pending = makeSellerOrder({ orderId: order.id });
  const blocked = makeSellerOrder({
    id: "44444444-5555-4666-8777-888888888881",
    orderId: order.id,
    shopNameSnapshot: "Hạt Mây",
  });
  order.sellerOrders = [pending, blocked];
  let orderReads = 0;
  mockRequest.mockImplementation(async (path) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) {
      orderReads += 1;
      return order;
    }
    if (route === `/payments?orderId=${order.id}`) return [];
    if (route === `/orders/${order.id}/cancel`)
      throw new ApiClientError("ORDER_NOT_CANCELLABLE", 409, {
        error: {
          code: "ORDER_NOT_CANCELLABLE",
          message: "Some seller orders have entered fulfillment.",
          details: [
            { field: "blockingSellerOrderIds", code: "ORDER_IN_PROGRESS", message: blocked.id },
          ],
        },
      });
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText("Hủy toàn đơn"));
  fireEvent.changeText(screen.getByLabelText("Lý do hủy"), "Đổi ý");
  fireEvent.press(screen.getByText("Xác nhận hủy"));

  expect(await screen.findByText(/Cửa hàng đang xử lý: Hạt Mây/)).toBeTruthy();
  await waitFor(() => expect(orderReads).toBeGreaterThan(1));
});

test.each([
  ["DELIVERED", "0", true],
  ["DELIVERED", "1000", false],
  ["PACKING", "0", false],
] as const)("B10 receive action requires delivered and settled state (%s, %s)", async (status, outstandingAmount, visible) => {
  const order = makeBuyerOrder();
  order.sellerOrders = [makeSellerOrder({ orderId: order.id, status, outstandingAmount })];
  mockOrderReads(order);

  renderCommerce(<OrderDetailRoute />);

  if (visible) {
    expect(await screen.findByText("Tôi đã nhận đủ hàng")).toBeTruthy();
  } else {
    await screen.findByText(order.orderNumber);
    expect(screen.queryByText("Tôi đã nhận đủ hàng")).toBeNull();
  }
});

test("B10 receive retry reuses key/body and sends SellerOrder.version", async () => {
  let order = makeBuyerOrder({ status: "DELIVERED", version: 30 });
  const part = makeSellerOrder({
    orderId: order.id,
    status: "DELIVERED",
    outstandingAmount: "0",
    version: 17,
  });
  order.sellerOrders = [part];
  const receiveCalls: Array<RequestInit | undefined> = [];
  mockRequest.mockImplementation(async (path, init) => {
    const route = String(path);
    if (route === `/orders/${order.id}`) return order;
    if (route === `/payments?orderId=${order.id}`) return [];
    if (route === `/orders/${order.id}/seller-orders/${part.id}/receive`) {
      receiveCalls.push(init);
      if (receiveCalls.length === 1) throw new TypeError("timeout");
      order = {
        ...order,
        status: "COMPLETED",
        sellerOrders: [{ ...part, status: "COMPLETED", version: part.version + 1 }],
      };
      return order.sellerOrders[0];
    }
    throw new Error(`Unexpected request: ${route}`);
  });

  renderCommerce(<OrderDetailRoute />);
  fireEvent.press(await screen.findByText("Tôi đã nhận đủ hàng"));
  expect(await screen.findByText("Không thể xác nhận đã nhận hàng. Vui lòng thử lại.")).toBeTruthy();
  fireEvent.press(screen.getByText("Thử xác nhận đã nhận lại"));

  await waitFor(() => expect(receiveCalls).toHaveLength(2));
  expect(receiveCalls[1]?.headers).toEqual(receiveCalls[0]?.headers);
  expect(receiveCalls[1]?.body).toBe(receiveCalls[0]?.body);
  expect(JSON.parse(String(receiveCalls[0]?.body))).toEqual({ expectedVersion: 17 });
});
