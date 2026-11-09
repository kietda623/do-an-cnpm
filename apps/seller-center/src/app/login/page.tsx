"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Store, TextField, useApi } from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";

export default function SellerLoginPage() {
  const router = useRouter();
  const { login, status } = useApi();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [router, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      router.replace("/");
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mp-auth mp-auth--console">
      <section className="mp-auth__intro">
        <h1 className="mp-auth__title">Quản lý cửa hàng trong một màn hình.</h1>
        <span className="mp-seller-auth__identity">
          <Store size={16} aria-hidden="true" /> sopi Seller Center
        </span>
        <p className="mp-auth__description">
          Theo dõi đơn cần xử lý, cập nhật sản phẩm và xem doanh thu hoàn tất bằng dữ liệu thật
          từ sopi.
        </p>
      </section>
      <section className="mp-auth__card" aria-labelledby="seller-login-title">
        <header className="mp-auth__card-head">
          <h2 id="seller-login-title">Đăng nhập người bán</h2>
          <p>Dùng tài khoản sopi để đăng ký hoặc quản lý cửa hàng.</p>
        </header>
        <form onSubmit={submit} className="mp-auth__fields">
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <TextField
            label="Mật khẩu"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {error ? (
            <p role="alert" className="mp-auth__message mp-auth__message--error">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Đăng nhập
          </Button>
        </form>
        <p className="mp-auth__switch">
          Chưa có tài khoản? <Link href="/register">Đăng ký tài khoản</Link>
        </p>
      </section>
    </main>
  );
}
