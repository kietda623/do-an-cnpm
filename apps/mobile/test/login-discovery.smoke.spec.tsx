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
const mockRequest = jest.fn();
const mockApi = { request: mockRequest };
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("../src/features/auth/session-provider", () => ({
  useSession: () => ({ login: mockLogin, api: mockApi }),
}));

beforeEach(() => {
  mockLogin.mockReset();
  mockRequest.mockReset();
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
