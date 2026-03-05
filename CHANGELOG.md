# Changelog

## 2026-03-04 — Theme Switcher Fix

### Problem

1. **Light theme was still dark** — Selecting the "Light" theme had no visible effect; the app remained in dark mode.
2. **Notification bar visibility** — The Android status bar was hard to see when switching between themes.

### Root Cause

The project uses **Tailwind CSS v4** (via `@tailwindcss/postcss`), but the `tailwind.config.js` had `darkMode: 'class'` — a **v3-only** setting that v4 ignores. Tailwind v4 defaults to `prefers-color-scheme: dark` for the `dark:` variant, meaning the `.dark` class toggled by `ThemeSwitcher.tsx` had no effect on styling.

### Fix

1. **`src/index.css`** — Added `@custom-variant dark (&:where(.dark, .dark *))` to tell Tailwind v4 to use the `.dark` class on the `<html>` element for dark mode, instead of the media query.
2. **`src/components/ThemeSwitcher.tsx`** — Updated the light-mode status bar background from `#f8fafc` to `#ffffff` for maximum contrast with dark status bar icons.
3. **`src/App.tsx`** — Changed light-mode header from `bg-white/80` (semi-transparent) to `bg-white` (fully opaque) so the header cleanly anchors under the status bar.

### Files Changed

- `src/index.css`
- `src/components/ThemeSwitcher.tsx`
- `src/App.tsx`
