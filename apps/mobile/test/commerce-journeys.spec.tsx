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
  makeAddress,
  makeCart,
  makeCartGroup,
  makeCartItem,
  makeOrder,
  makeQuote,
  mockRequest,
  mockRouter,
  renderCommerce,
  resetCommerceMocks,
  setCommerceUser,
} from "./commerce-test-utils";
import CartRoute from "../src/app/(buyer)/cart";
import CheckoutRoute from "../src/app/(buyer)/checkout";

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
