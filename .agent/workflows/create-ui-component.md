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

## 4. Client vs Server
- By default, Next.js app router components are Server Components.
- If the component uses `useState`, `useEffect`, `onClick`, or `useRouter`, you MUST add `"use client";` at the very top of the file.
