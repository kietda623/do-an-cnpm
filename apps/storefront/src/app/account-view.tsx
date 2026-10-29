"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, TextField, useSession, type SessionUser } from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError } from "@marketplace/api-client";
import { webSession } from "./auth-form";

type Address = {
  id: string;
  recipientName: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  province: string;
  country: "VN";
  isDefault: boolean;
};
const api = webSession.api;

export function AccountView({ view }: { view: "profile" | "addresses" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser } = useSession();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddress, setShowAddress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!user) {
          const current = await webSession.restore<SessionUser>();
          if (active) setUser(current);
        }
        if (view === "addresses") {
          const list = await api.request<Address[]>("/users/me/addresses");
          if (active) setAddresses(list);
        }
      } catch {
        await webSession.clear();
        if (active) router.replace("/login");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router, setUser, user, view]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    const data = new FormData(event.currentTarget);
    try {
      const updated = await api.request<SessionUser>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: String(data.get("fullName")),
          phone: data.get("phone") || null,
        }),
      });
      setUser(updated);
      setStatus("Đã lưu thay đổi.");
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    const data = new FormData(event.currentTarget);
    const payload = {
      recipientName: String(data.get("recipientName")),
      phone: String(data.get("phone")),
      line1: String(data.get("line1")),
      ward: String(data.get("ward")),
      district: String(data.get("district")),
      province: String(data.get("province")),
      country: "VN",
      isDefault: data.get("isDefault") === "on",
    };
    try {
      const saved = await api.request<Address>("/users/me/addresses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAddresses((current) => [
        saved,
        ...current.map((item) => ({
          ...item,
          isDefault: saved.isDefault ? false : item.isDefault,
        })),
      ]);
      setShowAddress(false);
      setStatus("Đã lưu địa chỉ.");
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    const data = new FormData(event.currentTarget);
    try {
      await api.request<void>("/users/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
        }),
      });
      setStatus("Đổi mật khẩu thành công.");
      setShowPassword(false);
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setPending(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    data.set("purpose", "AVATAR");
    try {
      const asset = await api.request<{ id: string; url: string }>("/users/me/assets", {
        method: "POST",
        body: data,
      });
      const updated = await api.request<SessionUser>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarAssetId: asset.id }),
      });
      setUser({ ...updated, avatar: { url: asset.url } });
    } catch (cause) {
      setError(normalizeFormError(cause));
    }
  }

  async function logout() {
    setPending(true);
    setError("");
    setLogoutFailed(false);
    try {
      await webSession.logout();
    } catch (cause) {
      if (!(cause instanceof ApiClientError) || cause.status !== 401) {
        setError("Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.");
        setLogoutFailed(true);
        return;
      }
    } finally {
      setPending(false);
    }
    setUser(null);
    queryClient.clear();
    router.replace("/login");
  }

  if (loading)
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p role="status">Đang tải tài khoản...</p>
      </main>
    );
  if (!user) return null;
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-marketplace-muted-foreground">Tài khoản</p>
          <h1 className="mt-1 text-3xl font-bold">Xin chào, {user.fullName}</h1>
          <p>{user.email}</p>
        </div>
        <Button variant="secondary" disabled={pending} onClick={logout}>
          Đăng xuất
        </Button>
      </header>
      <nav className="flex gap-4 border-b pb-3">
        <Link className="underline" href="/account">
          Hồ sơ
        </Link>
        <Link className="underline" href="/account/addresses">
          Địa chỉ
        </Link>
      </nav>
      {error && (
        <div>
          <p role="alert" className="text-marketplace-danger">
            {error}
          </p>
          {logoutFailed && (
            <Button disabled={pending} onClick={logout}>
              Thử lại đăng xuất
            </Button>
          )}
        </div>
      )}
      {status && <p role="status">{status}</p>}
      {view === "profile" ? (
        <>
          <form onSubmit={submitProfile} className="grid gap-4">
            <h2 className="text-xl font-semibold">Thông tin cá nhân</h2>
            <TextField
              label="Họ và tên"
              name="fullName"
              maxLength={120}
              defaultValue={user.fullName}
              required
            />
            <TextField
              label="Số điện thoại"
              name="phone"
              defaultValue={user.phone ?? ""}
              maxLength={20}
            />
            <Button disabled={pending}>Lưu</Button>
          </form>
          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Ảnh đại diện</h2>
            {user.avatar && (
              <img
                src={user.avatar.url}
                alt="Avatar / Ảnh đại diện"
                className="h-20 w-20 rounded-full object-cover"
              />
            )}
            <label className="grid max-w-sm gap-2 text-sm font-semibold">
              Tải ảnh lên
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void uploadAvatar(event.currentTarget.files?.[0])}
              />
            </label>
          </section>
          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Bảo mật</h2>
            {!showPassword && (
              <Button variant="secondary" onClick={() => setShowPassword(true)}>
                Đổi mật khẩu
              </Button>
            )}
            {showPassword && (
              <form className="grid gap-4" onSubmit={submitPassword}>
                <TextField
                  label="Mật khẩu hiện tại / Current password"
                  name="currentPassword"
                  type="password"
                  required
                />
                <TextField
                  label="Mật khẩu mới / New password"
                  name="newPassword"
                  type="password"
                  minLength={12}
                  required
                />
                <div className="flex gap-3">
                  <Button disabled={pending}>Cập nhật mật khẩu</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowPassword(false)}>
                    Hủy
                  </Button>
                </div>
              </form>
            )}
          </section>
        </>
      ) : (
        <section className="grid gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Sổ địa chỉ</h2>
            <Button onClick={() => setShowAddress(true)}>Thêm địa chỉ</Button>
          </div>
          {addresses.length === 0 && !showAddress && (
            <p>Chưa có địa chỉ nào. Thêm địa chỉ để dùng khi đặt hàng.</p>
          )}
          {addresses.map((address) => (
            <article key={address.id} className="rounded-lg border border-marketplace-border p-4">
              <p className="font-semibold">
                {address.recipientName} · {address.phone}
              </p>
              <p>
                {address.line1}, {address.ward}, {address.district}, {address.province}
              </p>
              {address.isDefault && <span className="text-sm">Địa chỉ mặc định</span>}
            </article>
          ))}
          {showAddress && (
            <form
              className="grid gap-4 rounded-lg border border-marketplace-border p-5"
              onSubmit={submitAddress}
            >
              <h3 className="text-lg font-semibold">Thêm địa chỉ</h3>
              <TextField label="Người nhận" name="recipientName" required />
              <TextField label="Điện thoại" name="phone" minLength={8} maxLength={20} required />
              <TextField label="Địa chỉ" name="line1" required />
              <TextField label="Phường" name="ward" required />
              <TextField label="Quận" name="district" required />
              <TextField label="Tỉnh / thành phố" name="province" required />
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isDefault" />
                Mặc định
              </label>
              <div className="flex gap-3">
                <Button disabled={pending}>Lưu</Button>
                <Button type="button" variant="secondary" onClick={() => setShowAddress(false)}>
                  Hủy
                </Button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
