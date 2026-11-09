---
name: sopi
description: A clear, task-focused Vietnamese marketplace across Buyer, Seller and Admin.
colors:
  primary: "oklch(0.5 0.12 230)"
  primary-strong: "oklch(0.44 0.1 230)"
  primary-soft: "oklch(0.955 0.025 230)"
  canvas: "oklch(0.97 0.006 230)"
  surface: "oklch(0.995 0.001 230)"
  ink: "oklch(0.24 0.02 230)"
  muted-ink: "oklch(0.47 0.02 230)"
  line: "oklch(0.88 0.012 230)"
  control-border: "oklch(0.6 0.025 230)"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Be Vietnam Pro, sans-serif"
    lineHeight: 1.6
  numeric:
    fontFamily: "IBM Plex Mono, monospace"
rounded:
  control: "10px"
  panel: "14px"
spacing:
  compact: "8px"
  regular: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
---

# Design System: sopi

## Overview

The user approved a light neutral system with cyan on 2026-11-09. sopi is a working shopping and operations product: products and decisions carry the screen, with quiet chrome and clear Vietnamese labels. Buyer emphasizes discovery; Seller emphasizes the next operational task; Admin emphasizes reviewing dense records.

This replaces the previous orange direction. Current API data remains authoritative, including empty lists. Missing capabilities are absent, rather than represented by pretend controls.

## Colors

Use the semantic CSS variables in packages/design-tokens/src/styles.css. Cyan is the single brand/action hue; success, warning, danger and information colors convey genuine states only. Light mode uses cool neutral canvas and white surfaces. Explicit and system dark modes use the corresponding token block with brighter cyan and readable muted text. Do not hard-code an alternate brand palette in an app.

## Typography

Space Grotesk is the display face, Be Vietnam Pro the UI face and IBM Plex Mono the numeric/code face; load the Vietnamese subsets. Headings are compact and wrap naturally, without a tiny tracked uppercase label above them. Body, labels and controls retain readable Vietnamese diacritics. Use tabular mono numerals for money, metrics and record identifiers, not ordinary prose.

## Layout

Use capped, centered containers. Buyer has a neutral search-led masthead, readable category/filter surfaces and a dense responsive merchandise grid. Phone layouts retain usable filters and two product tracks where space permits. Detail and checkout layouts make the existing primary action and totals easy to find.

Seller and Admin retain the shared neutral navigation shell. Group filters with their records, align numeric columns, and let wide tables scroll locally. Keep the current mobile drawer and its accessible controls. Inspect all routes at 1440, 768 and 390px; critical fields also at 360px. Do not hide overflow to conceal broken grids. html/body use overflow-x: clip.

The desktop console rail is 224px and becomes a drawer below 1050px. Touch-sized small buttons and panel action links remain 44px through the tablet breakpoint. The Admin user table retains at least 760px with a 240px identity column inside its existing horizontal scroll container. Seller's wide catalog separates the creation form from the record/filter area; phone layouts stack them without changing the form.

## Elevation & Depth

Use tonal separation and fine neutral borders for everyday structure. Reserve shadows for floating menus, dialogs and modest hover elevation. Avoid nested bordered cards, colored glows, glass layers and decorative gradients. Loading shimmer is a purposeful transient state, not permanent decoration.

## Shapes

Controls use the 10px radius and panels the 14px radius from shared tokens. Existing pill-shaped status chips remain compact and semantic. Touch actions retain at least 44px targets. Fields have visible labels, adequate width for placeholders and instant keyboard focus feedback.

## Components

Preserve all routes, hooks, state, handlers, API calls, names, validation, permissions and accessible actions. Refactor composition and classes only. Do not add fake wishlist, flash sale, bulk action, command palette or chart series. Existing counters and charts display only actual API values; preserve the simulated-payment disclosure.

Empty, loading, unauthorized and failed requests remain distinguishable. Keep retry actions and entered form values. Dialog focus behavior, menu dismissal, keyboard navigation and reduced-motion support are part of the component contract.

Animate transform and opacity only: finite short route entrances, a restrained product lift/image zoom, button press feedback and menu/dialog settling. Keep content visible without animation. Reduced motion removes decorative displacement, stagger and shimmer. Do not introduce timers, counting state or new interaction logic to decorate data.

Actual chart bars settle once over 360ms with a small scale/opacity entrance; SVG charts use a short translation/opacity entrance. Their final geometry and numerical labels remain truthful. No charts or intermediate counters are invented for empty datasets.

## Do's and Don'ts

- Do change the owning stylesheet: base, commerce-common, storefront, seller, admin or motion; keep the existing ordered import entry.
- Do preserve content and wiring, verify the immutable presentation baseline and compare Hallmark before/kept inventories.
- Do verify real empty data separately from mocked functional regression tests.
- Do not seed or reset the current database for the redesign.
- Do not use uppercase eyebrows, decorative colored left borders, nested cards, gradient text or emoji icons.
- Do not change framework, dependencies, API contracts or business behavior.
