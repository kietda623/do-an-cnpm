"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSession } from "@marketplace/ui-web";
import {
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type Asset = { id: string; url: string };
type Shop = {
  id: string;
  name: string;
  slug: string;
  description: string;
  contactAddress: string;
  phone: string;
  logo: Asset;
  banner: Asset | null;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  rejectionReason: string | null;
  approvedAt: string | null;
  version: number;
};
type Membership = {
  shopId: string;
  shopName: string;
  shopStatus: Shop["status"];
  role: string;
};

const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
const request = <T,>(path: string, init?: RequestInit) =>
  api.request<T>(path as ApiPath, init);
const text = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

export default function ShopsPage() {
  const { user } = useSession();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const rows = await request<Membership[]>("/users/me/shops");
    setMemberships(rows);
    const selected = rows[0];
    if (selected)
      setShop(await request<Shop>(`/shops/${selected.shopId}/management`));
    else setShop(null);
  }
  useEffect(() => {
    if (user)
      void refresh().catch((cause: unknown) =>
        setError(normalizeFormError(cause)),
      );
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const file = form.get("logo");
      if (!(file instanceof File) || !file.size)
        throw new Error("Anh chọn ảnh logo trước nhé.");
      const upload = new FormData();
      upload.set("file", file);
      upload.set("purpose", "SHOP_LOGO");
      const logo = await request<Asset>("/users/me/assets", {
        method: "POST",
        body: upload,
      });
      await request<Shop>("/shops", {
        method: "POST",
        body: JSON.stringify({
          name: text(form, "name"),
          slug: text(form, "slug").toLowerCase(),
          description: text(form, "description"),
          logoAssetId: logo.id,
          contactAddress: text(form, "contactAddress"),
          phone: text(form, "phone"),
        }),
      });
      setNotice("Đã gửi hồ sơ cửa hàng. Hồ sơ đang chờ quản trị viên duyệt.");
      await refresh();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const logoFile = form.get("logo");
      const bannerFile = form.get("banner");
      let logoAssetId: string | undefined;
      let bannerAssetId: string | undefined;
      if (logoFile instanceof File && logoFile.size) {
        const upload = new FormData();
        upload.set("file", logoFile);
        upload.set("purpose", "SHOP_LOGO");
        logoAssetId = (
          await request<Asset>("/users/me/assets", {
            method: "POST",
            body: upload,
          })
        ).id;
      }
      if (bannerFile instanceof File && bannerFile.size) {
        const upload = new FormData();
        upload.set("file", bannerFile);
        upload.set("purpose", "SHOP_BANNER");
        bannerAssetId = (
          await request<Asset>("/users/me/assets", {
            method: "POST",
            body: upload,
          })
        ).id;
      }
      await request<Shop>(`/shops/${shop.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: text(form, "name"),
          slug: text(form, "slug").toLowerCase(),
          description: text(form, "description"),
          contactAddress: text(form, "contactAddress"),
          phone: text(form, "phone"),
          expectedVersion: shop.version,
          ...(logoAssetId ? { logoAssetId } : {}),
          ...(bannerAssetId ? { bannerAssetId } : {}),
        }),
      });
      setNotice("Đã lưu thông tin cửa hàng.");
      await refresh();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resubmit() {
    if (!shop) return;
    setBusy(true);
    setError("");
    try {
      await request<Shop>(`/shops/${shop.id}/resubmit`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: shop.version }),
      });
      setNotice("Đã gửi lại hồ sơ để duyệt.");
      await refresh();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!user)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-3xl font-semibold">Cửa hàng của tôi</h1>
        <p>Đăng nhập để đăng ký hoặc quản lý cửa hàng.</p>
        <Link className="underline" href="/login">
          Đăng nhập
        </Link>
      </main>
    );

  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold">Cửa hàng của tôi</h1>
        <p>Tài khoản mua hàng cũng có thể đăng ký trở thành người bán.</p>
      </div>
      {shop && ["ACTIVE", "SUSPENDED"].includes(shop.status) && (
        <><Link className="underline" href={`/shops/${shop.id}/orders`}>Đơn của cửa hàng</Link><Link className="underline" href={`/shops/${shop.id}/dashboard`}>Thống kê và đánh giá</Link></>
      )}
      {shop?.status === "ACTIVE" && (
        <Link className="underline" href={`/shops/${shop.id}/products`}>
          Quản lý sản phẩm
        </Link>
      )}
      {memberships.length > 1 && (
        <label className="grid gap-2">
          Chọn cửa hàng
          <select
            value={shop?.id ?? ""}
            onChange={async (event) => {
              const selected = memberships.find(
                (row) => row.shopId === event.target.value,
              );
              if (selected)
                setShop(
                  await request<Shop>(`/shops/${selected.shopId}/management`),
                );
            }}
          >
            {memberships.map((row) => (
              <option key={row.shopId} value={row.shopId}>
                {row.shopName}
              </option>
            ))}
          </select>
        </label>
      )}
      {shop ? (
        <>
          <section className="rounded border p-4">
            <p>
              Trạng thái: <strong>{shop.status}</strong>
            </p>
            {shop.rejectionReason && (
              <p role="alert">Lý do: {shop.rejectionReason}</p>
            )}
            {shop.logo?.url && (
              <img
                src={shop.logo.url}
                alt="Logo cửa hàng"
                width={96}
                height={96}
              />
            )}
            {shop.banner?.url && (
              <img
                src={shop.banner.url}
                alt="Ảnh bìa cửa hàng"
                width={320}
                height={120}
              />
            )}
          </section>
          {shop.status === "SUSPENDED" ? (
            <p role="status">
              Cửa hàng đang tạm ngưng. Bạn có thể xử lý các đơn đã tồn tại;
              thông tin cửa hàng chỉ đọc.
            </p>
          ) : (
            <form onSubmit={save} className="grid gap-3">
              <label>
                Tên cửa hàng
                <input
                  name="name"
                  required
                  maxLength={150}
                  defaultValue={shop.name}
                />
              </label>
              <label>
                Đường dẫn
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  readOnly={Boolean(shop.approvedAt)}
                  defaultValue={shop.slug}
                />
              </label>
              <label>
                Mô tả
                <textarea
                  name="description"
                  required
                  maxLength={5000}
                  defaultValue={shop.description}
                />
              </label>
              <label>
                Địa chỉ liên hệ
                <input
                  name="contactAddress"
                  required
                  maxLength={500}
                  defaultValue={shop.contactAddress}
                />
              </label>
              <label>
                Số điện thoại
                <input
                  name="phone"
                  required
                  minLength={8}
                  maxLength={20}
                  defaultValue={shop.phone}
                />
              </label>
              <label>
                Đổi logo
                <input
                  name="logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
              </label>
              <label>
                Đổi ảnh bìa
                <input
                  name="banner"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
              </label>
              <button disabled={busy}>Lưu thông tin</button>
            </form>
          )}
          {shop.status === "REJECTED" && (
            <button disabled={busy} onClick={() => void resubmit()}>
              Gửi lại hồ sơ
            </button>
          )}
        </>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <label>
            Tên cửa hàng
            <input name="name" required maxLength={150} />
          </label>
          <label>
            Đường dẫn
            <input
              name="slug"
              required
              minLength={3}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <label>
            Mô tả
            <textarea name="description" required maxLength={5000} />
          </label>
          <label>
            Địa chỉ liên hệ
            <input name="contactAddress" required maxLength={500} />
          </label>
          <label>
            Số điện thoại
            <input name="phone" required minLength={8} maxLength={20} />
          </label>
          <label>
            Logo cửa hàng (JPEG, PNG hoặc WebP)
            <input
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <button disabled={busy}>
            {busy ? "Đang gửi..." : "Gửi hồ sơ đăng ký"}
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
