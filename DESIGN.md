# Design System

One system for the buyer storefront, seller console, and admin console. Two densities: **Storefront** (decide and buy) and **Console** (scan and act). Same tokens, type, states, and controls everywhere.

## Color

| Token | Value | Use |
|---|---|---|
| `--color-accent` | `#2563eb` | Primary actions, links, active nav, focus ring |
| `--color-accent-strong` | `#1d4ed8` | Hover/pressed primary |
| `--color-accent-soft` | `#eff5ff` | Selected rows, soft badges, chart fill |
| `--color-foreground` | `#17212f` | Primary text |
| `--color-muted-foreground` | `#5c6675` | Secondary text; never below 4.5:1 on white |
| `--color-background` | `#ffffff` | Cards, panels, surfaces |
| `--color-canvas` | `#f6f8fb` | Page background |
| `--color-muted` | `#f3f5f8` | Table head, input background |
| `--color-border` / `--color-line` | `#d7dde5` / `#e4e9f0` | Control borders / separators |
| `--color-success` / soft | `#067647` / `#ecfdf3` | Completed, paid, active |
| `--color-warning` / soft | `#b54708` / `#fffaeb` | Pending, needs action |
| `--color-info` / soft | `#175cd3` / `#eff8ff` | In progress, confirmed |
| `--color-danger` / soft | `#b42318` / `#fef3f2` | Destructive, cancelled, failed |

Status tones are semantic: pending → warning; confirmed/packing/shipping → info; delivered → accent; completed/paid → success; cancelled/failed/locked → danger. Never color by decoration.

## Typography

Inter, loaded with the Vietnamese subset. Fallback: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.

| Role | Size / line | Weight |
|---|---|---|
| Display | 38/44 | 700 |
| H1 | 30/36 | 700 |
| H2 | 24/30 | 600 |
| H3 | 20/28 | 600 |
| Body | 16/24 | 400 |
| Body small | 14/20 | 400 |
| Caption/label | 12/16 | 500–600 |
| Metric | 28–32/36 | 700, tabular numerals |

Rules: heading tracking never below `-0.04em`; body measure 65–75ch; no gradient text; no kicker/eyebrow above a heading; metrics use `font-variant-numeric: tabular-nums`.

## Space, radius, depth

- 4px base. Control gap 8; form gap 16; panel padding 20–24; section gap 24–32; page gap 40–48.
- Radii: control 8px, panel 12px, pill 999px.
- Shadows: `--shadow-card` (0 1px 2px rgba(23,33,47,.06), 0 8px 24px rgba(23,33,47,.05)); `--shadow-popover` (0 12px 32px rgba(23,33,47,.14)). No hard offset shadows, no zero-offset colored halos.
- More space above a heading than below it. Borders carry structure; shadows only lift interactive layers.

## Layout

- Storefront: max width 1280px, 16px gutter at 360, 24px at 768, 32px at 1280. Sticky header; footer with real links only.
- Console: sidebar 248px fixed at ≥1050px, collapsible to a drawer below; top bar 64px; content max 1440px, 24–32px padding.
- Tables scroll horizontally below 900px; filters wrap; primary action stays visible.
- Touch targets ≥44px; no hover-only controls.

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
- **Skeleton**: mirrors the final layout; no spinner-only pages.

## States

Every data screen ships: loading (skeleton), empty (real explanation), error (`role="alert"` + retry), unauthorized (redirect to login with return path), success (toast or inline confirmation). Mutations disable their trigger and keep the last known data visible.

## Motion

One authored moment per surface: a 180–240ms exponential ease-out for panels and dialogs entering; hover transitions 150ms. Respect `prefers-reduced-motion`. No scattered entrance animations.

## Browser surfaces

Theme selection (`::selection`), caret, focus ring, scrollbars, underline offset, and tabular numerals from the palette. Links are underlined on hover/focus; buttons never masquerade as links.

## Accessibility

- WCAG AA; body and placeholder text ≥4.5:1.
- Landmarks: `header`, `nav`, `main`, `footer`; one `h1` per page.
- Keyboard: dialogs trap focus and close on Escape; menus close on Escape; skip-to-content link on consoles.
- Icons are decorative (`aria-hidden`) unless they carry the only label.
- Tables have captions or `aria-label`; numeric columns align right.

## Content rules

- Vietnamese, direct, no exclamation marks in system messages.
- Buttons name the action ("Xác nhận đơn", "Hủy riêng cửa hàng"); errors name the problem and recovery.
- Label simulated data ("Doanh thu mô phỏng") when the API returns `simulated: true`.
- Never invent data, discounts, ratings, reviews, delivery promises, or brand claims.
