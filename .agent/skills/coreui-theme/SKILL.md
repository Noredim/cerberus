---
name: coreui-theme
description: CoreUI Bright Dashboard official visual identity. Use this skill when building or refactoring UI components to strictly match the CoreUI Light and Dark mode patterns natively with Tailwind CSS.
---

# CoreUI Design System (Native Tailwind Implementation)

> **Philosophy:** Clean, Corporate, Bright, and highly legible. Forms the definitive identity for the Cerberus system.

## 1. Color Palette (Tailwind tailwind.config.ts)

You MUST use these exact hexadecimal values when defining the application's theme colors. No generic Tailwind colors (like `blue-500` or `emerald-500`) should be used for brands or semantic UI.

| Intent     | Light Mode | Dark Mode |
| ---------- | ---------- | --------- |
| **Brand (Primary)** | `#5046e5`  | `#574edd` |
| **Success** | `#51cc8a`  | `#57c68a` |
| **Danger/Error** | `#ef376e`  | `#e64072` |
| **Warning** | `#ffcc00`  | `#f2c40d` |
| **Info** | `#747af2`  | `#7a80ec` |
| **Background** | `#f3f4f7`  | `#212631` |
| **Surface (Cards/Modals)** | `#ffffff`  | `#2a303c` |
| **Sidebar Background** | `#ffffff`  | `#0a0a0b` |
| **Text Primary** | `#212631`  | `#ffffff` |
| **Text Muted** | `#6b7785`  | `#8a93a2` |
| **Border/Divider** | `#d8dbe0`  | `#374151` |

## 2. Component Architecture

### Layout Metrics
- **Sidebar Width:** `w-64` (256px)
- **Header Height:** `h-16` (64px)
- **Grid Gap:** Default `gap-6` (24px) between dashboard components.
- **Top Solid Header:** The header and top of the sidebar share a distinct solid color area that gives it the "Bright" look.

### Cards & Surfaces
- Surfaces must **never** use glassmorphism (no `backdrop-blur` or high-transparency).
- Background: Solid `bg-surface` (white in light, `#2a303c` in dark).
- Border Radius: `rounded-lg` (8px).
- Shadow (Light Mode only): Subdued `shadow-sm` (`0 4px 6px -1px rgba(0, 0, 0, 0.1)`).
- Padding: Default `p-6` (24px).
- Borders: 1px solid using the standard border color (`border-border`).

### Buttons & Inputs
- Border Radius: `rounded-md` (6px).
- Button Padding: `py-1.5 px-3`.
- Font-weight: `font-medium` (500).
- Interaction: Solid hover states (slight darken/lighten of primary color). No glowing effects.

### Typography
- **Font Family:** `font-sans` ("Public Sans", system-ui, sans-serif).
- **Body Text:** `text-base` (16px), line-height `1.5`.
- **Headings:**
  - H1: `text-4xl font-bold` (~40px)
  - H2: `text-3xl font-semibold` (~32px)
  - H3: `text-2xl font-semibold` (~24px)

## 3. Strict Rules (Anti-Patterns to Avoid)
- **NO GLASSMORPHISM:** Remove all `bg-white/10`, `backdrop-blur`, and borders `white/20`.
- **NO NEON GLOWS:** Shadows must be structural, not neon emissions.
- **NO GENERIC TAILWIND COLORS:** Always map structural classes `bg-brand-primary`, `text-text-muted`, `border-border-subtle` built into the configuration.
- **DARK MODE MATTERS:** You must always write components testing `dark:` classes according to the table above.
