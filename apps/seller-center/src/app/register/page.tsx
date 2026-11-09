"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Store, TextField, useApi } from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError } from "@marketplace/api-client";

export default function SellerRegisterPage() {
  const router = useRouter();
  const { register, status } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") router.replace("/shops");
  }, [router, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || status !== "anonymous") return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await register(
        String(form.get("fullName")).trim(),
        String(form.get("email")).trim(),
        String(form.get("password")),
      );
      router.replace("/shops");
    } catch (cause) {
      setError(
        cause instanceof ApiClientError && cause.status === 409
          ? "Email đã có tài khoản sopi. Anh có thể dùng tài khoản đó để đăng nhập."
          : normalizeFormError(cause),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mp-auth mp-auth--console">
      <section className="mp-auth__intro">
        <h1 className="mp-auth__title">Bắt đầu bán hàng trên sopi.</h1>
        <span className="mp-seller-auth__identity">
          <Store size={16} aria-hidden="true" /> sopi Seller Center
        </span>
        <p className="mp-auth__description">
          Tạo tài khoản, gửi hồ sơ cửa hàng và theo dõi kết quả duyệt.
        </p>
      </section>
      <section className="mp-auth__card" aria-labelledby="seller-register-title">
        <header className="mp-auth__card-head">
          <h2 id="seller-register-title">Đăng ký tài khoản</h2>
          <p>Nếu đã có tài khoản sopi, anh có thể dùng tài khoản đó.</p>
        </header>
        <form onSubmit={submit} className="mp-auth__fields">
          <TextField label="Họ và tên" name="fullName" autoComplete="name" required maxLength={120} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <TextField
            label="Mật khẩu"
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            required
          />
          {error && <p role="alert" className="mp-auth__message mp-auth__message--error">{error}</p>}
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={status !== "anonymous"}>
            Đăng ký
          </Button>
        </form>
        <p className="mp-auth__switch">
          Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </section>
    </main>
  );
}
