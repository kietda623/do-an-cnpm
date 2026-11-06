"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  CheckboxField,
  EmptyState,
  KeyRound,
  LockKeyhole,
  LogOut,
  MapPin,
  PageHeader,
  Panel,
  Plus,
  Skeleton,
  Tabs,
  TextField,
  Upload,
  useApi,
  useSession,
  type SessionUser,
} from "@marketplace/ui-web";
import { ApiClientError, ApiConnectionError, normalizeFormError } from "@marketplace/api-client";

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

export function AccountView({ view }: { view: "profile" | "addresses" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status, api, clear } = useApi();
  const { setUser } = useSession();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(view === "addresses");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputId = useId();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  useEffect(() => {
    if (view !== "addresses" || status !== "authenticated") return;
    let active = true;
    setAddressesLoading(true);
    void api
      .request<Address[]>("/users/me/addresses")
      .then((list) => {
        if (active) setAddresses(list);
      })
      .catch(async (cause) => {
        if (cause instanceof ApiClientError && cause.status === 401) {
          await clear();
          if (active) router.replace("/login");
          return;
        }
        if (active) setError(normalizeFormError(cause));
      })
      .finally(() => {
        if (active) setAddressesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, clear, router, status, view]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatusMessage("");
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
      setStatusMessage("Đã lưu thay đổi.");
    } catch (cause) {
      setError(
        cause instanceof ApiConnectionError
          ? "Không thể kết nối để lưu hồ sơ. Vui lòng kiểm tra kết nối và thử lại."
          : normalizeFormError(cause),
      );
    } finally {
      setPending(false);
    }
  }

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatusMessage("");
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
      setStatusMessage("Đã lưu địa chỉ.");
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
    setStatusMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await api.request<void>("/users/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
        }),
      });
      setStatusMessage("Đổi mật khẩu thành công.");
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
    setPending(true);
    setError("");
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
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError("");
    setLogoutError("");
    try {
      await api.request<void>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ clientPlatform: "WEB" }),
      });
    } catch (cause) {
      if (!(cause instanceof ApiClientError) || cause.status !== 401) {
        setLogoutError("Không thể đăng xuất. Kiểm tra kết nối rồi thử lại.");
        setPending(false);
        return;
      }
    }
    setPending(false);
    await clear();
    queryClient.clear();
    router.replace("/login");
  }

  if (status === "loading") {
    return (
      <main className="mp-account-page">
        <div className="mp-account-page__loading" role="status">
          <Skeleton className="mp-skeleton--avatar" />
          <Skeleton className="mp-skeleton--line" />
          <Skeleton className="mp-skeleton--cell" />
        </div>
        <span className="mp-visually-hidden">Đang tải tài khoản...</span>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="mp-account-page">
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description={user.email}
        actions={
          <Button
            variant="secondary"
            disabled={pending}
            loading={pending}
            loadingLabel="Đang đăng xuất…"
            leadingIcon={<LogOut size={16} />}
            onClick={() => void logout()}
          >
            Đăng xuất
          </Button>
        }
      />

      <div className="mp-account-page__layout">
        <aside className="mp-account-page__side">
          <Tabs
            label="Tài khoản"
            value={view}
            items={[
              { key: "profile", label: "Hồ sơ", href: "/account" },
              { key: "addresses", label: "Địa chỉ", href: "/account/addresses" },
            ]}
          />
        </aside>

        <div className="mp-account-page__content">
          {error ? (
            <p role="alert" className="mp-alert-inline">
              {error}
            </p>
          ) : null}
          {logoutError ? (
            <div className="mp-alert-inline stack">
              <p role="alert">{logoutError}</p>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => void logout()}
              >
                Thử lại đăng xuất
              </Button>
            </div>
          ) : null}
          {statusMessage ? (
            <p role="status" className="mp-notice-inline">
              {statusMessage}
            </p>
          ) : null}

          {view === "profile" ? (
            <div className="mp-account-page__grid">
              <Panel
                title="Thông tin cá nhân"
                description="Tên hiển thị và số điện thoại dùng khi liên hệ giao hàng."
                className="mp-account-page__panel"
              >
                <form onSubmit={submitProfile} className="mp-form">
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
                    optional
                  />
                  <div className="mp-form__actions">
                    <Button disabled={pending} loading={pending}>
                      Lưu
                    </Button>
                  </div>
                </form>
              </Panel>

              <Panel
                title="Ảnh đại diện"
                description="Ảnh vuông, tối đa 5 MB. Hỗ trợ JPEG, PNG hoặc WebP."
                className="mp-account-page__panel"
              >
                <div className="mp-avatar-editor">
                  <span className="mp-avatar-editor__preview">
                    {user.avatar ? (
                      <img
                        src={user.avatar.url}
                        alt="Avatar / Ảnh đại diện"
                        className="mp-avatar-editor__image"
                      />
                    ) : (
                      <UserGlyph />
                    )}
                  </span>
                  <div className="mp-avatar-editor__actions">
                    <label className="mp-file-button" htmlFor={fileInputId}>
                      <Upload size={16} aria-hidden="true" />
                      Tải ảnh lên
                    </label>
                    <input
                      id={fileInputId}
                      className="mp-visually-hidden"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={pending}
                      onChange={(event) => void uploadAvatar(event.currentTarget.files?.[0])}
                    />
                    <p className="mp-muted">
                      {user.avatar ? "Ảnh mới sẽ thay thế ảnh hiện tại." : "Chưa có ảnh đại diện."}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Bảo mật"
                description="Đổi mật khẩu định kỳ để bảo vệ tài khoản."
                className="mp-account-page__panel mp-account-page__panel--wide"
              >
                {!showPassword ? (
                  <Button
                    variant="secondary"
                    leadingIcon={<KeyRound size={16} />}
                    onClick={() => setShowPassword(true)}
                  >
                    Đổi mật khẩu
                  </Button>
                ) : (
                  <form className="mp-form" onSubmit={submitPassword}>
                    <div className="mp-form__grid">
                      <TextField
                        label="Mật khẩu hiện tại / Current password"
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        required
                      />
                      <TextField
                        label="Mật khẩu mới / New password"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        maxLength={128}
                        required
                      />
                    </div>
                    <div className="mp-form__actions">
                      <Button disabled={pending} loading={pending}>
                        Cập nhật mật khẩu
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowPassword(false)}
                      >
                        Hủy
                      </Button>
                    </div>
                  </form>
                )}
              </Panel>
            </div>
          ) : (
            <Panel
              title="Sổ địa chỉ"
              description="Địa chỉ mặc định được chọn sẵn ở bước thanh toán."
              actions={
                <Button
                  leadingIcon={<Plus size={16} />}
                  onClick={() => setShowAddress(true)}
                  disabled={showAddress}
                >
                  Thêm địa chỉ
                </Button>
              }
            >
              {addressesLoading ? (
                <div className="mp-address-list" aria-hidden="true">
                  <Skeleton className="mp-skeleton--block" />
                  <Skeleton className="mp-skeleton--block" />
                </div>
              ) : addresses.length === 0 && !showAddress ? (
                <EmptyState
                  icon={<MapPin size={22} />}
                  title="Chưa có địa chỉ nào. Thêm địa chỉ để dùng khi đặt hàng."
                  description="Bạn cần ít nhất một địa chỉ nhận hàng trước khi thanh toán."
                />
              ) : (
                <div className="mp-address-list">
                  {addresses.map((address) => (
                    <article key={address.id} className="mp-address-card">
                      <div className="mp-address-card__head">
                        <p className="mp-address-card__name">
                          {address.recipientName} · {address.phone}
                        </p>
                        {address.isDefault ? (
                          <span className="mp-chip mp-chip--soft">Mặc định</span>
                        ) : null}
                      </div>
                      <p className="mp-address-card__line">
                        {address.line1}, {address.ward}, {address.district}, {address.province}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              {showAddress ? (
                <form className="mp-form mp-address-form" onSubmit={submitAddress}>
                  <h3 className="mp-form__title">Thêm địa chỉ</h3>
                  <div className="mp-form__grid">
                    <TextField label="Người nhận" name="recipientName" required />
                    <TextField
                      label="Điện thoại"
                      name="phone"
                      minLength={8}
                      maxLength={20}
                      required
                    />
                  </div>
                  <TextField label="Địa chỉ" name="line1" required />
                  <div className="mp-form__grid mp-form__grid--three">
                    <TextField label="Phường" name="ward" required />
                    <TextField label="Quận" name="district" required />
                    <TextField label="Tỉnh / thành phố" name="province" required />
                  </div>
                  <CheckboxField label="Mặc định" name="isDefault" />
                  <div className="mp-form__actions">
                    <Button disabled={pending} loading={pending}>
                      Lưu
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowAddress(false)}>
                      Hủy
                    </Button>
                  </div>
                </form>
              ) : null}
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}

function UserGlyph() {
  return (
    <span className="mp-avatar-editor__placeholder" aria-hidden="true">
      <LockKeyhole size={24} />
    </span>
  );
}
