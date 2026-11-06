# Design System — Signal Dispatch

One system for the buyer storefront, seller console, and admin console. Two densities: **Storefront** (decide and buy) and **Console** (scan and act). Same tokens, type, states, and controls everywhere.

## Direction

**Signal Dispatch** treats the marketplace as a coordination room: multishop orders move along a visible rail, and every surface shows the same operational signals. The world is built from paper grey-green, ink teal-black, a teal coordination accent, and an orange hand-off signal. Data — order numbers, shop slugs, SKUs, money, timestamps — is set in mono so it reads as instrumentation rather than prose.

The one signature element is the **Order Rail**: a compact, accessible step track that maps a real order status onto PENDING → CONFIRMED → SHIPPING → COMPLETED. It appears on the storefront explainer, buyer and admin order details, the seller dashboard and queue, and the login aside. It never fabricates progress; it derives every tone from status values returned by the API.

## Themes (light / dark / system)

- `data-theme` on `<html>` is always resolved to `light` or `dark`.
- `data-theme-mode` stores the user's choice: `system`, `light`, or `dark`.
- Default is `system`; the inline head script resolves it before CSS paints to avoid a flash.
- Manual choice persists in `localStorage["marketplace-theme"]`.
- The toggle cycles system → light → dark → system, exposes a Vietnamese accessible name, and uses a circular view transition when available. With `prefers-reduced-motion: reduce` it switches instantly.

## Desktop direction

The buyer desktop app is a Tauri webview around the same storefront — not a second UI. It inherits these tokens, components, density, and copy unchanged; only window chrome and minimum viewport width differ. Seller and admin have no desktop surface. There is no mobile app. Desktop implementation is planned, not shipped (see [ADR-0004](docs/adr/0004-buyer-desktop-webview-wrapper.md)).

## Color

Light:

| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#EDF1EF` | Page background |
| `--color-surface` | `#FBFCFB` | Cards, panels, header |
| `--color-raised` | `#FFFFFF` | Dialogs, menus, popovers |
| `--color-ink` | `#0F1A17` | Primary text |
| `--color-ink-muted` | `#52625C` | Secondary text |
| `--color-muted` | `#E5EBE8` | Table head, input fill |
| `--color-line` | `#D5DED9` | Separators, panel borders |
| `--color-border` | `#B9C7C1` | Control borders |
| `--color-accent` | `#0D7A63` | Primary actions, links, active nav |
| `--color-accent-strong` | `#09604E` | Hover/pressed primary |
| `--color-accent-soft` | `#D9F2EA` | Selected rows, soft badges |
| `--color-signal` | `#C2410C` | Hand-off and attention signals |
| `--color-signal-soft` | `#FDE8DE` | Signal backgrounds |
| `--color-success` / soft | `#0C6B46` / `#DFF3E8` | Completed, paid, active |
| `--color-warning` / soft | `#8A5300` / `#FDF0D4` | Pending, needs action |
| `--color-info` / soft | `#135F9E` / `#E2EFFA` | Confirmed, in progress |
| `--color-danger` / soft | `#B3261E` / `#FBE7E5` | Destructive, cancelled, failed |

Dark:

| Token | Value |
|---|---|
| `--color-canvas` | `#0A100E` |
| `--color-surface` | `#101815` |
| `--color-raised` | `#16211D` |
| `--color-ink` | `#E9F1ED` |
| `--color-ink-muted` | `#9DB0A9` |
| `--color-muted` | `#1B2621` |
| `--color-line` | `#26332E` |
| `--color-border` | `#35473F` |
| `--color-accent` | `#4FD6B3` |
| `--color-accent-strong` | `#7CE7CA` |
| `--color-accent-soft` | `#123A31` |
| `--color-signal` | `#FF8A5C` |
| `--color-signal-soft` | `#3A1D12` |
| `--color-success` / soft | `#63D9A3` / `#10291F` |
| `--color-warning` / soft | `#F2C46B` / `#2E2412` |
| `--color-info` / soft | `#7CC4FF` / `#102334` |
| `--color-danger` / soft | `#FF8A80` / `#331413` |

Status tones are semantic: pending → warning; confirmed/packing/shipping → info; delivered → accent; completed/paid → success; cancelled/failed/locked → danger. Never color by decoration. Dark mode pairs deeper shadows with a hairline highlight instead of relying on large blur.

## Typography

Three families, all loaded with the Vietnamese subset via `next/font/google` and `display: swap`:

| Role | Family | Weights | Use |
|---|---|---|---|
| Display | Space Grotesk (`--font-display`) | 500, 700 | Headlines, hero, large metrics, eyebrows |
| Body / UI | Be Vietnam Pro (`--font-sans`) | 400, 500, 600, 700 | Body copy, controls, navigation |
| Data | IBM Plex Mono (`--font-mono`) | 400, 500 | Order IDs, shop slugs, SKUs, money, timestamps, rail labels, table numerics |

Scale: display `clamp(2.6rem, 7vw, 5.5rem)` / 0.92; h1 2rem; h2 1.5rem; h3 1.125rem; body 1rem / 1.6; small .875rem; mono label .75rem with .08em tracking and uppercase.

Rules: `text-wrap: balance` on headings; metrics use tabular numerals; no gradient text; body measure 65–75ch.

## Space, radius, depth

- 4px base. Control gap 8; form gap 16; panel padding 20–24; section gap 24–32; page gap 40–48.
- Radii: control 10px, panel 16px, pill 999px.
- Shadows: `--shadow-1`, `--shadow-2`, `--shadow-3`. Dark mode uses deeper shadows plus a light hairline on raised layers. No hard offset shadows, no zero-offset colored halos.

## Layout

- Storefront: max width 1320px; header 72px sticky with backdrop blur and a hairline; trust strip 36px mono; hero 7/5 split (copy + Order Rail aside); product grid 4/3/2/1 columns; footer 4 columns.
- Console: sidebar 264px fixed at ≥1050px, drawer below; topbar 64px; content max 1480px. Navigation groups carry a mono eyebrow; the active item uses `accent-soft` with a vertical signal bar.
- Tables scroll horizontally below 900px; filters wrap; the primary action stays visible.
- Touch targets ≥44px; no hover-only controls. The header wraps the search onto its own row below 760px to prevent horizontal overflow.

## Signature: Order Rail

`OrderRail` renders an ordered list (`<ol aria-label>`) of steps, marks the current step with `aria-current="step"`, and supports horizontal, vertical, and compact table variants. Steps carry an id, label, optional mono meta, and one of five tones: neutral, active, done, warn, danger. Connectors animate with `scaleX/Y` when the rail enters the viewport; nodes pop with a spring. Reduced motion renders the final state immediately.

Status mapping is shared (`orderRailSteps`, `orderRailCurrent`): PENDING, CONFIRMED/PACKING, SHIPPING/DELIVERED, COMPLETED; CANCELLED renders a terminal danger state. No step is invented from data the API does not return.

## Components

- **Button**: primary (accent), secondary (white + border), ghost (accent text), danger (danger), quiet (text). Sizes sm 36px, md 44px, lg 48px. Loading keeps width and label.
- **Field**: label above input, hint below, error replaces hint with `role="alert"`; 44px control height.
- **Panel**: white, 1px line, 12px radius, optional title/description/actions. Never nest panels.
- **StatCard**: label, value, one supporting line; no fake deltas. Real counts only.
- **DataTable**: semantic `<table>`, `thead`, sortable only when a sort exists; empty/loading/error states inside the panel; row actions are buttons with accessible names.
- **StatusBadge**: pill, semantic tone, Vietnamese label; unknown values fall back to neutral text.
- **Dialog**: native `<dialog>`; title, one protected action, cancel; focus returns to trigger.
- **Tabs**: only for real status groupings; counts from the same query as the list.
- **Toast/StatusMessage**: `role="status"` for success, `role="alert"` for failure; persistent until dismissed when the action failed.
- **Charts**: CSS/SVG only; always backed by a real series and a hidden/visible data table; no fabricated trend lines.
- **EmptyState**: explains what is missing and the next real action.
- **Skeleton**: mirrors the final layout; no spinner-only pages. `[aria-busy="true"]` is reserved for real loading only.
- **ThemeToggle**: cycle control with visible mode label, 44px target, Vietnamese accessible name, persisted choice.
- **RouteTransition**: fades and lifts content on pathname change; skipped under reduced motion.

## States

Every data screen ships: loading (skeleton), empty (real explanation), error (`role="alert"` + retry), unauthorized (redirect to login with return path), success (toast or inline confirmation). Mutations disable their trigger and keep the last known data visible. Polling refreshes silently: no skeleton flash, no toast, no full-page animation replay — only the changed values update.

## Motion

Motion is **strong / demonstrative** but always optional:

- Easings: `--ease-out-expo` `cubic-bezier(.16,1,.3,1)`, `--ease-spring` via `linear()`, durations 120 / 220 / 420ms.
- Scroll reveal: `.mp-reveal` uses `animation-timeline: view()` where supported; elsewhere content is visible immediately.
- Route enter: `.mp-route-enter` fades, lifts 12px, and clears a 2px blur on navigation.
- Stagger: `.mp-stagger > *` delays by `--i * 45ms`; cards and KPI grids set `--i` from their index.
- Spring hover: cards lift 4px with shadow, buttons press to .98, nav underlines slide; only under `@media (hover: hover)`.
- Polling flash: `.mp-flash` briefly tints changed surfaces without remounting lists.
- Theme sweep: a circular clip-path view transition from the toggle position.
- `@media (prefers-reduced-motion: reduce)` disables non-essential animation and transitions; all content remains visible.

## Browser surfaces

Theme selection (`::selection`), caret, focus ring, scrollbars, underline offset, and tabular numerals from the palette. Links are underlined on hover/focus; buttons never masquerade as links.

## Accessibility

- WCAG AA; body and placeholder text ≥4.5:1 in both themes; UI boundaries ≥3:1.
- Landmarks: `header`, `nav`, `main`, `footer`; one `h1` per page.
- Keyboard: dialogs trap focus and close on Escape; menus close on Escape; skip-to-content link on consoles.
- Icons are decorative (`aria-hidden`) unless they carry the only label.
- Tables have captions or `aria-label`; numeric columns align right.
- Theme toggle names the action it will perform, not the current state.
- Order Rail marks the current step with `aria-current="step"` and never relies on color alone.

## Content rules

- Vietnamese, direct, no exclamation marks in system messages.
- Buttons name the action ("Xác nhận đơn", "Hủy riêng cửa hàng"); errors name the problem and recovery.
- Label simulated data ("Doanh thu mô phỏng") when the API returns `simulated: true`.
- Never invent data, discounts, ratings, reviews, delivery promises, or brand claims.
