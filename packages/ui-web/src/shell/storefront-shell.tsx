"use client";

import type { ApiPath } from "@marketplace/api-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApi } from "../api/api-provider";
import {
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  User,
  Wallet,
} from "../icons";
import { cx } from "../lib/cx";
import { formatNumber } from "../lib/format";
import { Avatar } from "../primitives/surface";

type CartResponse = {
  groups?: Array<{ items?: Array<{ quantity?: number }> }>;
};

const primaryLinks = [
  { href: "/products", label: "Sản phẩm" },
  { href: "/orders", label: "Đơn hàng" },
];

export function StorefrontShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { api, status, user, logout } = useApi();
  const [cartCount, setCartCount] = useState(0);
  const [cartVersion, setCartVersion] = useState(0);
  const accountMenu = useRef<HTMLDetailsElement>(null);
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const lastPathname = useRef(pathname);

  useEffect(() => {
    const onChange = () => setCartVersion((value) => value + 1);
    window.addEventListener("marketplace:cart-changed", onChange);
    return () => window.removeEventListener("marketplace:cart-changed", onChange);
  }, []);

  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    accountMenu.current?.removeAttribute("open");
    mobileMenu.current?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    if (status !== "authenticated") {
      setCartCount(0);
      return;
    }
    let live = true;
    void api
      .request<CartResponse>("/cart" as ApiPath)
      .then((cart) => {
        if (!live) return;
        const count = (cart.groups ?? []).reduce(
          (sum, group) =>
            sum + (group.items ?? []).reduce((inner, item) => inner + (item.quantity ?? 0), 0),
          0,
        );
        setCartCount(count);
      })
      .catch(() => {
        if (live) setCartCount(0);
      });
    return () => {
      live = false;
    };
  }, [api, status, pathname, cartVersion]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
    router.refresh();
  };

  const accountMenuContent = user ? (
    <>
      <div className="mp-menu__header">
        <p className="mp-menu__name">{user.fullName}</p>
        <p className="mp-menu__email">{user.email}</p>
      </div>
      <Link className="mp-menu__item" href="/account">
        <User size={16} aria-hidden="true" />
        Tài khoản
      </Link>
      <Link className="mp-menu__item" href="/account/addresses">
        <MapPin size={16} aria-hidden="true" />
        Sổ địa chỉ
      </Link>
      <Link className="mp-menu__item" href="/orders">
        <Package size={16} aria-hidden="true" />
        Đơn hàng của tôi
      </Link>
      <button type="button" className="mp-menu__item mp-menu__item--danger" onClick={handleLogout}>
        <LogOut size={16} aria-hidden="true" />
        Đăng xuất
      </button>
    </>
  ) : null;

  return (
    <div className="mp-storefront">
      <a className="mp-skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <div className="mp-trustbar">
        <div className="mp-container mp-trustbar__inner">
          <span>
            <Store size={14} aria-hidden="true" /> Mua từ nhiều cửa hàng trong một đơn
          </span>
          <span>
            <Truck size={14} aria-hidden="true" /> Theo dõi vận chuyển theo từng cửa hàng
          </span>
          <span>
            <Wallet size={14} aria-hidden="true" /> Thanh toán COD hoặc mô phỏng
          </span>
        </div>
      </div>
      <header className="mp-header">
        <div className="mp-container mp-header__inner">
          <Link href="/" className="mp-brand" aria-label="Marketplace — trang chủ">
            <span className="mp-brand__mark" aria-hidden="true">
              <ShoppingBag size={18} />
            </span>
            <span className="mp-brand__name">Marketplace</span>
          </Link>

          <nav className="mp-header__nav" aria-label="Danh mục chính">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cx("mp-nav__link", pathname.startsWith(link.href) && "mp-nav__link--active")}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <form className="mp-search" role="search" action="/products" method="get">
            <label className="mp-visually-hidden" htmlFor="storefront-search">
              Tìm trên Marketplace
            </label>
            <Search className="mp-search__icon" size={17} aria-hidden="true" />
            <input
              id="storefront-search"
              name="q"
              type="search"
              placeholder="Tìm sản phẩm"
              className="mp-search__input"
              autoComplete="off"
            />
            <button type="submit" className="mp-search__submit">
              Tìm
            </button>
          </form>

          <div className="mp-header__actions">
            <Link
              href="/cart"
              className="mp-icon-link"
              aria-label={
                cartCount > 0 ? `Giỏ hàng, ${formatNumber(cartCount)} sản phẩm` : "Giỏ hàng"
              }
            >
              <ShoppingCart size={20} aria-hidden="true" />
              <span className="mp-icon-link__label">Giỏ hàng</span>
              {cartCount > 0 ? (
                <span className="mp-cart-count" data-numeric aria-hidden="true">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </Link>

            {status === "loading" ? (
              <span className="mp-skeleton mp-skeleton--avatar" aria-label="Đang tải tài khoản" />
            ) : user ? (
              <details className="mp-menu" ref={accountMenu}>
                <summary className="mp-account">
                  <Avatar name={user.fullName} src={user.avatar?.url} size="sm" />
                  <span className="mp-account__name">{user.fullName}</span>
                  <ChevronDown size={15} aria-hidden="true" />
                </summary>
                <div className="mp-menu__panel">{accountMenuContent}</div>
              </details>
            ) : (
              <div className="mp-header__auth">
                <Link href="/login" className="mp-header__login">
                  Đăng nhập
                </Link>
                <Link href="/register" className="mp-button mp-button--primary mp-button--sm">
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          <details className="mp-mobile-menu" ref={mobileMenu}>
            <summary className="mp-icon-button mp-icon-button--quiet mp-icon-button--md" aria-label="Mở menu">
              <Menu size={20} aria-hidden="true" />
            </summary>
            <div className="mp-mobile-menu__panel">
              <nav aria-label="Điều hướng trên thiết bị di động">
                <Link className="mp-mobile-menu__link" href="/">
                  Trang chủ
                </Link>
                {primaryLinks.map((link) => (
                  <Link key={link.href} className="mp-mobile-menu__link" href={link.href}>
                    {link.label}
                  </Link>
                ))}
                <Link className="mp-mobile-menu__link" href="/cart">
                  Giỏ hàng{cartCount > 0 ? ` (${formatNumber(cartCount)})` : ""}
                </Link>
              </nav>
              {user ? (
                <>
                  <div className="mp-mobile-menu__divider" />
                  <Link className="mp-mobile-menu__link" href="/account">
                    Tài khoản
                  </Link>
                  <button
                    type="button"
                    className="mp-mobile-menu__link mp-mobile-menu__link--danger"
                    onClick={handleLogout}
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <div className="mp-mobile-menu__divider" />
                  <Link className="mp-mobile-menu__link" href="/login">
                    Đăng nhập
                  </Link>
                  <Link className="mp-mobile-menu__link" href="/register">
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </details>
        </div>
      </header>

      <main id="main-content" className="mp-storefront__main">
        {children}
      </main>

      <footer className="mp-footer">
        <div className="mp-container mp-footer__grid">
          <div className="mp-footer__brand">
            <span className="mp-brand__name">Marketplace</span>
            <p>
              Sàn nhiều cửa hàng: mỗi đơn được tách theo cửa hàng để bạn theo dõi và xử lý riêng.
            </p>
          </div>
          <nav aria-label="Mua sắm" className="mp-footer__nav">
            <p className="mp-footer__title">Mua sắm</p>
            <Link href="/products">Tất cả sản phẩm</Link>
            <Link href="/cart">Giỏ hàng</Link>
            <Link href="/orders">Đơn hàng</Link>
          </nav>
          <nav aria-label="Tài khoản" className="mp-footer__nav">
            <p className="mp-footer__title">Tài khoản</p>
            <Link href="/account">Thông tin cá nhân</Link>
            <Link href="/account/addresses">Sổ địa chỉ</Link>
            <Link href="/login">Đăng nhập</Link>
          </nav>
        </div>
        <div className="mp-container mp-footer__bottom">
          <span>Marketplace MVP</span>
          <span>Giá và tồn kho được xác nhận lại khi thanh toán.</span>
        </div>
      </footer>
    </div>
  );
}
