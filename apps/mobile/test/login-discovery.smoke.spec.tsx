import React from "react";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import Login from "../src/app/login";
import Home from "../src/app/index";

const mockLogin = jest.fn();
const mockLogout = jest.fn();
let mockUser: { id: string } | null = null;
const mockRequest = jest.fn();
const mockApi = { request: mockRequest };
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("../src/features/auth/session-provider", () => ({
  useSession: () => ({
    login: mockLogin,
    logout: mockLogout,
    user: mockUser,
    api: mockApi,
  }),
}));

beforeEach(() => {
  mockLogin.mockReset();
  mockRequest.mockReset();
  mockLogout.mockReset();
  mockUser = null;
});

test("reports a failed logout and lets the signed-in user retry", async () => {
  mockUser = { id: "buyer" };
  mockRequest.mockResolvedValue([{ id: "p1", name: "Sample product" }]);
  mockLogout
    .mockRejectedValueOnce(new TypeError("network unavailable"))
    .mockResolvedValueOnce(undefined);
  render(<Home />);
  await screen.findByText("Sample product");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Đăng xuất" }));
  });
  expect(
    await screen.findByText(
      "Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  });
  expect(mockLogout).toHaveBeenCalledTimes(2);
  expect(
    screen.queryByText("Không thể đăng xuất. Kiểm tra kết nối rồi thử lại."),
  ).toBeNull();
});
test("logs in with email and password", async () => {
  mockLogin.mockResolvedValue(undefined);
  await render(<Login />);
  fireEvent.changeText(
    screen.getByPlaceholderText("Email"),
    "buyer@example.test",
  );
  fireEvent.changeText(screen.getByPlaceholderText("Mật khẩu"), "password");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Đăng nhập" }));
  });
  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith("buyer@example.test", "password"),
  );
});
test("reports an error and retries to an empty list", async () => {
  mockRequest
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce([]);
  render(<Home />);
  await screen.findByText("Không thể tải sản phẩm.");
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Thử lại" }));
  });
  await screen.findByText("Chưa có sản phẩm.");
  expect(mockRequest).toHaveBeenCalledTimes(2);
});
test("loads products from the API", async () => {
  mockRequest.mockResolvedValue([{ id: "p1", name: "Sample product" }]);
  render(<Home />);
  await waitFor(() => expect(screen.getByText("Sample product")).toBeTruthy());
  expect(mockRequest).toHaveBeenCalledWith("/products");
});
