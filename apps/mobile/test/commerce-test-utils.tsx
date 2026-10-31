import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react-native";
import type { ApiPath, components } from "@marketplace/api-client";

type User = { id: string } | null;
type Cart = components["schemas"]["Cart"];
type CartGroup = components["schemas"]["CartGroup"];
type CartItem = components["schemas"]["CartItem"];

export const CART_ITEM_ID = "11111111-1111-4111-8111-111111111111";
export const SECOND_CART_ITEM_ID = "22222222-2222-4222-8222-222222222222";
export const CART_SHOP_ID = "33333333-3333-4333-8333-333333333333";
export const SECOND_CART_SHOP_ID = "44444444-4444-4444-8444-444444444444";

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
