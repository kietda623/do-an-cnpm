import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react-native";
import type { ApiPath, components } from "@marketplace/api-client";

type User = { id: string } | null;
type Cart = components["schemas"]["Cart"];
type CartGroup = components["schemas"]["CartGroup"];
type CartItem = components["schemas"]["CartItem"];
type Address = components["schemas"]["Address"];
type CheckoutQuote = components["schemas"]["CheckoutQuote"];
type Order = components["schemas"]["Order"];

export const CART_ITEM_ID = "11111111-1111-4111-8111-111111111111";
export const SECOND_CART_ITEM_ID = "22222222-2222-4222-8222-222222222222";
export const CART_SHOP_ID = "33333333-3333-4333-8333-333333333333";
export const SECOND_CART_SHOP_ID = "44444444-4444-4444-8444-444444444444";
let quoteSequence = 1;

export const mockRouter = { push: jest.fn(), replace: jest.fn() };
export const mockRequest = jest.fn<Promise<unknown>, [ApiPath, RequestInit?]>();
let mockUser: User = null;
const mockApi = {
  request: <T,>(path: ApiPath, init?: RequestInit) =>
    mockRequest(path, init) as Promise<T>,
};
const mockSession = {
  api: mockApi,
  get user() {
    return mockUser;
  },
};
const queryClients: QueryClient[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));
jest.mock("../src/features/auth/session-provider", () => ({
  useSession: () => mockSession,
}));

export function setCommerceUser(user: User) {
  mockUser = user;
}

export function makeCartItem(
  overrides: Partial<CartItem> = {},
): CartItem {
  return {
    id: CART_ITEM_ID,
    variantId: "55555555-5555-4555-8555-555555555555",
    productId: "66666666-6666-4666-8666-666666666666",
    shopId: CART_SHOP_ID,
    productName: "Bình giữ nhiệt",
    sku: "BINH-DEN",
    attributes: { màu: "Đen" },
    currentUnitPrice: "125000",
    quantity: 1,
    selected: true,
    availableQuantity: 2,
    purchasable: true,
    unavailableReason: null,
    ...overrides,
  };
}

export function makeCartGroup(
  shopId: string,
  shopName: string,
  items: CartItem[],
  selectedSubtotal: string,
): CartGroup {
  return { shopId, shopName, items, selectedSubtotal };
}

export function makeCart(
  groups: CartGroup[] = [
    makeCartGroup(
      CART_SHOP_ID,
      "Nhà Bếp Mộc",
      [makeCartItem()],
      "125000",
    ),
  ],
  selectedTotal = "125000",
): Cart {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    groups,
    selectedTotal,
    currency: "VND",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

export function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    recipientName: "Nguyễn An",
    phone: "0912345678",
    line1: "1 Đường A",
    ward: "Phường 1",
    district: "Quận 1",
    province: "TP Hồ Chí Minh",
    country: "VN",
    isDefault: true,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeQuote(
  overrides: Partial<CheckoutQuote> = {},
): CheckoutQuote {
  const sequence = quoteSequence++;
  const defaultExpiry = new Date(Date.now() + 5 * 60_000).toISOString();
  return {
    quoteId: `bbbbbbbb-bbbb-4bbb-8bbb-${String(sequence).padStart(12, "0")}`,
    expiresAt: defaultExpiry,
    lines: [
      {
        cartItemId: CART_ITEM_ID,
        variantId: "55555555-5555-4555-8555-555555555555",
        shopId: CART_SHOP_ID,
        quantity: 1,
        unitPrice: "125000",
        lineTotal: "125000",
      },
    ],
    groups: [
      {
        shopId: CART_SHOP_ID,
        subtotal: "125000",
        shippingFee: "10000",
        total: "135000",
      },
    ],
    addressSnapshot: {
      recipientName: "Nguyễn An",
      phone: "0912345678",
      line1: "1 Đường A",
      ward: "Phường 1",
      district: "Quận 1",
      province: "TP Hồ Chí Minh",
      country: "VN",
    },
    total: "135000",
    currency: "VND",
    valid: true,
    issues: [],
    ...overrides,
  };
}

export function makeOrder(id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"): Order {
  return {
    id,
    buyerId: "99999999-9999-4999-8999-999999999999",
    orderNumber: "MP-2026-00001",
    sellerOrders: [],
    status: "PENDING",
    partiallyCancelled: false,
    originalTotal: "135000",
    cancelledAmount: "0",
    capturedAmount: "0",
    refundedAmount: "0",
    outstandingAmount: "135000",
    paymentMethod: "COD",
    paymentStatus: "UNPAID",
    currency: "VND",
    payments: [],
    version: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

export function createCommerceQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  queryClients.push(queryClient);
  return queryClient;
}

export function renderCommerce(element: React.ReactElement) {
  const queryClient = createCommerceQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
  return {
    queryClient,
    ...view,
    rerender: (nextElement: React.ReactElement) =>
      view.rerender(
        <QueryClientProvider client={queryClient}>{nextElement}</QueryClientProvider>,
      ),
  };
}

export async function cleanupCommerceTests() {
  cleanup();
  await Promise.all(queryClients.map((queryClient) => queryClient.cancelQueries()));
  queryClients.forEach((queryClient) => queryClient.clear());
  queryClients.length = 0;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

export function resetCommerceMocks() {
  mockUser = null;
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRequest.mockReset();
}
