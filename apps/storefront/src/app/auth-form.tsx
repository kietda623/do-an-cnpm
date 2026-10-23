"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, FormSection, TextField, useSession, type SessionUser } from "@marketplace/ui-web";
import { normalizeFormError, WebSession } from "@marketplace/api-client";

const session = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1");

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { setUser } = useSession();
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
      const user =
        mode === "register"
          ? await session.register<SessionUser>(
              String(values.get("fullName")),
              String(values.get("email")),
              String(values.get("password")),
            )
          : await session.login<SessionUser>(
              String(values.get("email")),
              String(values.get("password")),
            );
      setUser(user);
      router.push("/account");
    } catch (cause) {
      setStatus("");
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-5 py-12">
      <div>
        <p className="text-sm text-marketplace-muted-foreground">Marketplace</p>
        <h1 className="mt-2 text-3xl font-bold">
          {mode === "register" ? "Tạo tài khoản" : "Đăng nhập"}
        </h1>
      </div>
      <form className="grid gap-5" onSubmit={submit}>
        <FormSection title={mode === "register" ? "Thông tin tài khoản" : "Chào mừng trở lại"}>
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
            minLength={12}
            maxLength={128}
            required
          />
        </FormSection>
        {error && (
          <p role="alert" className="text-sm text-marketplace-danger">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="text-sm text-marketplace-muted-foreground">
            {status}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending
            ? mode === "register"
              ? "Registering..."
              : "Signing in..."
            : mode === "register"
              ? "Đăng ký"
              : "Đăng nhập"}
        </Button>
      </form>
      <p className="text-sm">
        {mode === "register" ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <Link className="underline" href={mode === "register" ? "/login" : "/register"}>
          {mode === "register" ? "Đăng nhập" : "Đăng ký"}
        </Link>
      </p>
    </main>
  );
}

export { session as webSession };
