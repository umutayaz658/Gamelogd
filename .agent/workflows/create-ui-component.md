---
description: Creating a New Frontend React Component
---

# Creating a New Frontend UI Component

Standard procedure for adding a new reusable React component to the Next.js frontend to maintain the premium, dark-mode exclusive visual identity of Gamelogd.

## 1. File Structure & Placement
- Reusable UI elements (buttons, inputs, cards) belong in `src/components/ui/`.
- Domain-specific components (e.g., `GameCard`, `ProfileHeader`) belong in `src/components/`.
- Modals belong in `src/components/modals/`.

## 2. Design System & Aesthetics
- **Colors:** STRICTLY use Tailwind's `zinc` palette for grays (`bg-zinc-900`, `border-zinc-800`, `text-zinc-400`). 
- **Accents:** 
  - **Gamer-related:** Green/emerald (`text-emerald-500`, `bg-emerald-600`)
  - **Developer-related:** Blue (`text-blue-500`, `bg-blue-600`)
  - **Investor-related:** Amber (`text-amber-500`, `bg-amber-600`)
  - *Note: The core application color theme is black (using zinc grays), green/emerald, and white details.*
- **Glassmorphism:** Use `bg-zinc-900/50 backdrop-blur-md` for floating elements like navbars or dropdowns.
- **Borders:** Use subtle borders (`border border-zinc-800` or `border-zinc-700/50`) to define hierarchy instead of heavy drop shadows on dark backgrounds.

## 3. Implementation Rules
- Always use the `cn()` utility from `src/lib/utils.ts` for conditionally merging Tailwind classes.
- Handle loading states (e.g., skeletons or spinners) and empty states gracefully, avoiding abrupt layout shifts.
- For icons, always use `lucide-react` with consistent sizing (e.g., `h-4 w-4` or `h-5 w-5`).

## 4. UI Custom Styling Standards
- **Scrollbars:** Never use native browser scrollbars. Always use the custom `.scrollbar-thin-dark` class (defined in `globals.css`) for scrollable content containers to keep them visually matched to the dark theme.
- **Select Dropdowns:** Avoid using native browser `<select>` inputs as they render with default OS stylings when opened. Build or reuse custom custom-dropdown components (styled with Tailwind, absolute positioned items, lucide-react icons, and context colors) like `<CustomSelect>`.
- **Checkboxes & Toggles:** Do not use native `<input type="checkbox">` elements directly. Hide them visually with `sr-only` and render a custom styled checkbox `div` (using transition effects, the active theme background, and a check icon) for consistent dark-theme aesthetics. For toggles, use the custom `Switch` component.
- **Drawers & Modals (Panels):** Any slide-over panel, drawer, or modal must be styled in harmony with the application's dark theme. Use `bg-zinc-950` or `bg-zinc-900` background, clean borders (e.g., `border-zinc-800` or `border-zinc-800/80`), backdrop filter blur effects (`backdrop-blur-sm`), and custom scrollbars for any inner scrollable areas. Avoid default black backgrounds or default browser layouts that don't match the modern design system.

## 5. Client vs Server
- By default, Next.js app router components are Server Components.
- If the component uses `useState`, `useEffect`, `onClick`, or `useRouter`, you MUST add `"use client";` at the very top of the file.

## 6. Internationalization (i18n)
- **Multilingual UI:** Never hardcode text strings in the UI. Always add the translation keys to `useTranslation.ts` across all languages (English, Turkish, Spanish, French, German) and use the `useTranslation` hook (`t('key')`) to translate text dynamically. All newly introduced text elements, labels, placeholders, and dropdown option values must utilize this dictionary.
