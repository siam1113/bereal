# Design system

## Visual direction

Distinctive, editorial, craft-inclusive — warm off-white and charcoal with one
confident accent color, real portfolio imagery, generous whitespace, responsive cards.
Deliberately avoiding corporate-dashboard styling, fake ratings, or generic AI-SaaS
visual clichés — the product is for carpenters and software engineers alike, and should
feel equally credible to both.

## Tokens

Defined as CSS variables in `src/app/globals.css`, consumed as Tailwind v4 utility
classes via `@theme inline`. Light values on `:root`, dark-mode overrides under
`@media (prefers-color-scheme: dark)` — the app follows system theme, no manual toggle.

| Token | Utility classes | Light | Purpose |
| --- | --- | --- | --- |
| `--color-paper` | `bg-paper` | `#faf7f1` | Page background |
| `--color-surface` | `bg-surface` | `#ffffff` | Card/input background |
| `--color-ink` | `text-ink` | `#231f1c` | Primary text |
| `--color-ink-muted` | `text-ink-muted` | `#6b6258` | Secondary text |
| `--color-border` / `--color-border-strong` | `border-border` / `border-border-strong` | `#e6ddcf` / `#d2c5b2` | Dividers, input borders |
| `--color-accent` / `--color-accent-hover` | `bg-accent`, `text-accent` | `#bf5425` / `#a8451c` | The one confident accent (terracotta) |
| `--color-accent-soft` / `--color-accent-foreground` | `bg-accent-soft` | `#f4ddc9` / `#fff8f2` | Accent-tinted backgrounds, text-on-accent |
| `--color-success` / `-soft` | `text-success`, `bg-success-soft` | `#3f7d4a` / `#e1efe1` | Confirmed/positive states |
| `--color-warning` / `-soft` | `text-warning`, `bg-warning-soft` | `#a8701f` / `#f6e9d2` | Pending/self-declared states |
| `--color-danger` / `-soft` | `text-danger`, `bg-danger-soft` | `#b3261e` / `#fae1df` | Disputes, destructive actions |
| `--radius-sm/md/lg` | `rounded-sm/md/lg` | 0.375 / 0.625 / 1rem | Corner radii |

**Don't introduce new raw hex colors** — extend the token set in `globals.css` if an
existing semantic color doesn't fit, rather than hardcoding a value in a component.

## Typography

Two font families, both via `next/font/google` in `src/app/layout.tsx`:

- `--font-display` (Fraunces) — headings, via the `font-display` utility class. A warm
  serif that carries the "craft-inclusive editorial" identity.
- `--font-sans` (Inter) — body text and UI, the default `font-sans` (applied to `<body>`).

## Component inventory

`src/components/ui/` — Radix UI primitives wrapped with the token classes above and
`class-variance-authority` for variants. **Reuse these; don't hand-roll new buttons,
inputs, or dialogs.**

| Component | Notes |
| --- | --- |
| `Button` | Variants: `primary`, `secondary`, `ghost`, `danger`, `link`. Sizes: `sm`, `md`, `lg`, `icon`. `asChild` for `Link`-as-button. |
| `Input`, `Textarea`, `Label` | Standard form fields. |
| `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` | The default container for list items and sections. |
| `Badge` | Variants: `neutral`, `accent`, `success`, `warning`, `danger`, `outline`. Used throughout for status (confirmation state, claim status, report status). |
| `Avatar` / `AvatarImage` / `AvatarFallback` | |
| `Dialog` + subcomponents | Confirmation modals (e.g. account deletion), report forms. |
| `Select` + subcomponents | |
| `Tabs` + subcomponents | |
| `Checkbox`, `Switch` | |
| `DropdownMenu` + subcomponents | User menu, contextual actions. |
| `Popover` + subcomponents | |
| `Toaster` / `toast()` | Wraps `sonner`; import `toast` from `@/components/ui/toaster`, not directly from `sonner`. |
| `VisuallyHidden` | Screen-reader-only text. |

## Shared feature components

Outside `ui/`, a few components are shared across route boundaries by design (see
[architecture.md](./architecture.md#feature-areas-and-their-service-files)):

- `src/components/site-header.tsx`, `site-footer.tsx`, `user-menu.tsx` — global chrome.
- `src/components/relationships/profile-relationships-panel.tsx` — dropped into the
  public profile page.
- `src/components/safety/report-button.tsx` — droppable onto any entity page.

## Accessibility

Radix primitives give focus management, ARIA roles, and keyboard navigation for free —
use them rather than raw `<div onClick>` patterns. `:focus-visible` gets a visible
accent-colored outline globally (see `globals.css`). Keep copy in plain language; the
product principles explicitly call for low-bandwidth, accessible, mobile-first UX.
