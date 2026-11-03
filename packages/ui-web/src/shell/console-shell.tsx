"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApi } from "../api/api-provider";
import { LogOut, Menu, X } from "../icons";
import { cx } from "../lib/cx";
import { formatNumber } from "../lib/format";
import { Avatar } from "../primitives/surface";

export type ConsoleNavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
  exact?: boolean;
  badge?: number;
};

export type ConsoleNavGroup = {
  label?: string;
  items: ConsoleNavItem[];
};

export type ConsoleShellProps = {
  product: string;
  homeHref: string;
  brandIcon?: ReactNode;
  navGroups: ConsoleNavGroup[];
  children: ReactNode;
  shopSwitcher?: ReactNode;
  topbar?: ReactNode;
  loginHref?: string;
};

function isActive(pathname: string, item: ConsoleNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({
  navGroups,
  pathname,
  onNavigate,
}: {
  navGroups: ConsoleNavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="mp-console__nav" aria-label="Điều hướng chính">
      {navGroups.map((group, index) => (
        <div className="mp-console__group" key={group.label ?? index}>
          {group.label ? <p className="mp-console__group-label">{group.label}</p> : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx("mp-console__link", active && "mp-console__link--active")}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                {item.icon ? (
                  <span className="mp-console__link-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                ) : null}
                <span className="mp-console__link-label">{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 ? (
                  <span className="mp-console__link-badge" data-numeric>
                    {formatNumber(item.badge)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function ConsoleShell({
  product,
  homeHref,
  brandIcon,
  navGroups,
  children,
  shopSwitcher,
  topbar,
  loginHref = "/login",
}: ConsoleShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, logout } = useApi();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = drawerRef.current;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];
    focusables()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    router.replace(loginHref);
    router.refresh();
  };

  const brand = (
    <Link href={homeHref} className="mp-console__brand" aria-label={`${product} — trang chủ`}>
      {brandIcon ? (
        <span className="mp-console__brand-mark" aria-hidden="true">
          {brandIcon}
        </span>
      ) : null}
      <span className="mp-console__brand-name">{product}</span>
    </Link>
  );

  const accountFooter = (
    <div className="mp-console__account">
      {status === "loading" ? (
        <span className="mp-skeleton mp-skeleton--line" />
      ) : user ? (
        <>
          <Avatar name={user.fullName} src={user.avatar?.url} size="sm" />
          <span className="mp-console__account-text">
            <span className="mp-console__account-name">{user.fullName}</span>
            <span className="mp-console__account-email">{user.email}</span>
          </span>
        </>
      ) : (
        <Link className="mp-console__link" href={loginHref}>
          Đăng nhập
        </Link>
      )}
    </div>
  );

  return (
    <div className="mp-console">
      <a className="mp-skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>

      <aside className="mp-console__sidebar">
        {brand}
        {shopSwitcher ? <div className="mp-console__switcher">{shopSwitcher}</div> : null}
        <NavList navGroups={navGroups} pathname={pathname} />
        <div className="mp-console__sidebar-footer">{accountFooter}</div>
      </aside>

      <div className="mp-console__frame">
        <header className="mp-console__topbar">
          <button
            type="button"
            className="mp-icon-button mp-icon-button--quiet mp-icon-button--md mp-console__menu-button"
            aria-label="Mở điều hướng"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="mp-console__topbar-content">{topbar}</div>
          <div className="mp-console__topbar-actions">
            {status === "loading" ? (
              <span className="mp-skeleton mp-skeleton--avatar" aria-label="Đang tải tài khoản" />
            ) : user ? (
              <span className="mp-console__user">
                <Avatar name={user.fullName} src={user.avatar?.url} size="sm" />
                <span className="mp-console__user-name">{user.fullName}</span>
              </span>
            ) : (
              <Link className="mp-console__link" href={loginHref}>
                Đăng nhập
              </Link>
            )}
            {user ? (
              <button
                type="button"
                className="mp-icon-button mp-icon-button--quiet mp-icon-button--md"
                onClick={handleLogout}
                aria-label="Đăng xuất"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>

        <main id="main-content" className="mp-console__main">
          <div className="mp-console__content">{children}</div>
        </main>
      </div>

      {drawerOpen ? (
        <div className="mp-console__drawer-layer">
          <button
            type="button"
            className="mp-console__overlay"
            aria-label="Đóng điều hướng"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            className="mp-console__drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Điều hướng"
          >
            <div className="mp-console__drawer-header">
              {brand}
              <button
                type="button"
                className="mp-icon-button mp-icon-button--quiet mp-icon-button--md"
                onClick={() => setDrawerOpen(false)}
                aria-label="Đóng điều hướng"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {shopSwitcher ? <div className="mp-console__switcher">{shopSwitcher}</div> : null}
            <NavList navGroups={navGroups} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <div className="mp-console__sidebar-footer">{accountFooter}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
