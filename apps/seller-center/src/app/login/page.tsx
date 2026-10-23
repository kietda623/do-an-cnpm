"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, TextField, useSession, type SessionUser } from "@marketplace/ui-web";
import { normalizeFormError, WebSession } from "@marketplace/api-client";

const session = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1");
export default function SellerLoginPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const user = await session.login<SessionUser>(
        String(form.get("email")),
        String(form.get("password")),
      );
      if (!user.roles.includes("SELLER") && !user.roles.includes("ADMIN"))
        throw new Error("Tài khoản chưa được cấp quyền người bán.");
      setUser(user);
      router.replace("/");
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto grid max-w-lg gap-6 px-5 py-12">
      <div>
        <h1 className="text-3xl font-bold">Đăng nhập người bán</h1>
        <p>Đăng nhập bằng tài khoản đã được cấp quyền cửa hàng.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy}>{busy ? "Đang đăng nhập..." : "Đăng nhập"}</Button>
      </form>
    </main>
  );
}
