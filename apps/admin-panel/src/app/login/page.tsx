"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Shield, TextField, useApi } from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, status, user, logout } = useApi();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user?.roles.includes("ADMIN"))
      router.replace("/");
  }, [router, status, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const nextUser = await login(
        String(form.get("email")),
        String(form.get("password")),
      );
      if (!nextUser.roles.includes("ADMIN")) {
        await logout();
        throw new Error("Tài khoản chưa được cấp quyền quản trị.");
      }
      router.replace("/");
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mp-auth mp-auth--console mp-admin-auth">
      <section className="mp-auth__intro">
        <h1 className="mp-auth__title">sopi Admin</h1>
        <span className="mp-auth__eyebrow">
          <Shield size={16} aria-hidden="true" /> sopi Admin
        </span>
        <p className="mp-auth__description">
          Duyệt cửa hàng, kiểm duyệt sản phẩm, khóa tài khoản và tra cứu giao
          dịch trong một không gian quản trị tập trung.
        </p>
      </section>
      <section className="mp-auth__card" aria-labelledby="admin-login-title">
        <header className="mp-auth__card-head">
          <h2 id="admin-login-title">Đăng nhập quản trị</h2>
          <p>Chỉ tài khoản quản trị sopi được tiếp tục.</p>
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
            <p
              role="alert"
              className="mp-auth__message mp-auth__message--error"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Đăng nhập
          </Button>
        </form>
        <p className="mp-auth__switch">
          Cần quyền quản trị? Liên hệ quản trị viên hệ thống.
        </p>
      </section>
    </main>
  );
}
