"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, OrderRail, TextField, useApi } from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";

const journey = [
  { id: "cart", label: "Gom nhiều cửa hàng vào một giỏ", meta: "Một lần đặt", tone: "done" as const },
  { id: "track", label: "Theo dõi từng kiện hàng", meta: "Cập nhật tự động", tone: "active" as const },
  { id: "review", label: "Đánh giá sau khi nhận", meta: "Khi đơn hoàn tất", tone: "neutral" as const },
];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { login, register } = useApi();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("Đang xử lý...");
    const values = new FormData(event.currentTarget);
    try {
      if (mode === "register") {
        await register(
          String(values.get("fullName")),
          String(values.get("email")),
          String(values.get("password")),
        );
      } else {
        await login(String(values.get("email")), String(values.get("password")));
      }
      const requestedReturn = new URLSearchParams(window.location.search).get("returnTo");
      const destination = requestedReturn ? new URL(requestedReturn, window.location.origin) : null;
      const returnTo =
        destination?.origin === window.location.origin
          ? `${destination.pathname}${destination.search}${destination.hash}`
          : "/account";
      router.push(returnTo);
    } catch (cause) {
      setStatus("");
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mp-container mp-auth">
      <div className="mp-auth__intro">
        <h1 className="mp-auth__title">
          {mode === "register" ? "Tạo tài khoản" : "Đăng nhập"}
        </h1>
        <p className="mp-market-note">Marketplace</p>
        <p className="mp-auth__description">
          {mode === "register"
            ? "Theo dõi đơn theo từng cửa hàng và nhận hàng đúng hẹn."
            : "Tiếp tục mua sắm, theo dõi vận chuyển và đánh giá sản phẩm."}
        </p>
        <div className="mp-auth__journey">
          <p className="mp-market-note">Sau khi đăng nhập</p>
          <OrderRail
            label="Các bước mua hàng sau khi đăng nhập"
            steps={journey}
            orientation="vertical"
          />
        </div>
      </div>
      <form className="mp-auth__card" onSubmit={submit}>
        <div className="mp-auth__card-head">
          <h2>{mode === "register" ? "Thông tin tài khoản" : "Chào mừng trở lại"}</h2>
          <p>
            {mode === "register"
              ? "Dùng email của anh để tạo tài khoản mua hàng."
              : "Nhập email và mật khẩu đã đăng ký."}
          </p>
        </div>
        <div className="mp-auth__fields">
          {mode === "register" && (
            <TextField
              label="Họ và tên"
              name="fullName"
              autoComplete="name"
              minLength={1}
              maxLength={120}
              required
            />
          )}
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField
            label="Mật khẩu / Password"
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            maxLength={128}
            required
          />
        </div>
        {error && (
          <p role="alert" className="mp-auth__message mp-auth__message--error">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="mp-auth__message">
            {status}
          </p>
        )}
        <Button type="submit" loading={pending} fullWidth>
          {mode === "register" ? "Đăng ký" : "Đăng nhập"}
        </Button>
        <p className="mp-auth__switch">
          {mode === "register" ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
          <Link href={mode === "register" ? "/login" : "/register"}>
            {mode === "register" ? "Đăng nhập" : "Đăng ký"}
          </Link>
        </p>
      </form>
    </div>
  );
}
