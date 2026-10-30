import React from "react";
import { Text, StyleSheet } from "react-native";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { SessionProvider } from "../src/features/auth/session-provider";

const mockRestore = jest.fn();
const mockReplace = jest.fn();
let mockPathname = "/cart";
let mockInvalidate: () => void;
jest.mock("@marketplace/api-client/auth/expo-session", () => ({
  SessionStorageError: class SessionStorageError extends Error {},
  ExpoSession: jest.fn().mockImplementation((options) => {
    mockInvalidate = options.onSessionInvalid;
    return { api: {}, restore: mockRestore };
  }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { apiBaseUrl: "https://example.test/api/v1" } },
}));
jest.mock("expo-secure-store", () => ({}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 96, bottom: 24, left: 0, right: 0 }),
}));

beforeEach(() => {
  mockRestore.mockReset();
  mockReplace.mockReset();
  mockPathname = "/cart";
});

it("returns to login instead of network retry after storage invalidation", async () => {
  const { SessionStorageError } = jest.requireMock(
    "@marketplace/api-client/auth/expo-session",
  );
  mockRestore.mockImplementation(async () => {
    mockInvalidate();
    throw new SessionStorageError();
  });
  render(
    <SessionProvider>
      <Text>Navigator mounted</Text>
    </SessionProvider>,
  );
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { returnTo: "/cart" },
    }),
  );
  expect(screen.getByText("Navigator mounted")).toBeTruthy();
  expect(
    screen.queryByText(
      "Không thể khôi phục phiên. Kiểm tra kết nối rồi thử lại.",
    ),
  ).toBeNull();
});

it("keeps session recovery below system bars and allows retry", async () => {
  mockRestore
    .mockRejectedValueOnce(new TypeError("network unavailable"))
    .mockResolvedValueOnce(null);
  render(
    <SessionProvider>
      <Text>Application ready</Text>
    </SessionProvider>,
  );
  const message = await screen.findByText(
    "Không thể khôi phục phiên. Kiểm tra kết nối rồi thử lại.",
  );
  let ancestor = message.parent;
  let topPadding = 0;
  while (ancestor) {
    topPadding += StyleSheet.flatten(ancestor.props.style)?.paddingTop ?? 0;
    ancestor = ancestor.parent;
  }
  expect(topPadding).toBeGreaterThanOrEqual(96);
  fireEvent.press(screen.getByText("Thử lại"));
  await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("Application ready")).toBeTruthy();
});
