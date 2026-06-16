# MiniSidebar — Integration Guide

## What Was Delivered

| File | Purpose |
|------|---------|
| `MiniSidebar.tsx` | Standalone, drop-in collapsible sidebar component |
| `MiniSidebar.module.css` | Plain CSS module alternative (no Tailwind required) |
| `MiniSidebar.test.tsx` | Jest + React Testing Library tests |
| `layout.tsx` (updated) | Your existing dashboard layout enhanced with collapse support |
| `globals.css` (updated) | Tooltip styles + smooth transition utilities added |

---

## Quick Start — Drop-In Usage

### Option A: Standalone Component (Recommended for New Projects)

```tsx
// app/dashboard/layout.tsx
import MiniSidebar from "@/components/MiniSidebar";
import { LayoutDashboard, Users, Settings } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <MiniSidebar
        brand={
          <>
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)] flex items-center justify-center">
              <span className="text-white font-bold">S</span>
            </div>
            <div className="brand-text">
              <p className="text-white font-bold text-sm">SUKI CRM</p>
            </div>
          </>
        }
        items={[
          { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} />, end: true },
          { href: "/users", label: "Users", icon: <Users size={20} /> },
          { href: "/settings", label: "Settings", icon: <Settings size={20} /> },
        ]}
        sections={[
          {
            label: "Reports",
            icon: <Settings size={20} />,
            subItems: [
              { href: "/reports/sales", label: "Sales Report" },
              { href: "/reports/leads", label: "Lead Report" },
            ],
          },
        ]}
        footer={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold">
              U
            </div>
            <div className="brand-text">
              <p className="text-white text-xs font-medium">User Name</p>
            </div>
          </div>
        }
      />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

### Option B: Enhanced Existing Layout (What We Did)

Your existing `app/(dashboard)/layout.tsx` was updated with:
- `240px` / `72px` width toggle
- `aria-expanded` on the toggle button
- `role="navigation"` on the `<aside>`
- Tooltips via `title` attribute + CSS tooltip
- Active indicator strip preserved in both states

---

## Tailwind Class Reference

| State | Width | Key Classes |
|-------|-------|-------------|
| Expanded | `w-[240px]` | `w-[240px] transition-[width] duration-300` |
| Collapsed | `w-[72px]` | `w-[72px] collapsed transition-[width] duration-300` |
| Labels hidden | — | `.collapsed .nav-label { opacity: 0; width: 0; }` |
| Icons centered | — | `.collapsed .menu-item { justify-content: center; }` |
| Tooltip | — | `.group:hover .sidebar-tooltip { opacity: 1; }` |

---

## Layout Usage (Content Width Adjustment)

```tsx
// Option 1: Use margin-left on main content
<div className="flex h-screen overflow-hidden">
  <MiniSidebar ... />
  <main className={cn(
    "flex-1 overflow-auto transition-[margin] duration-300",
    collapsed ? "ml-[72px]" : "ml-[240px]"
  )}>
    {children}
  </main>
</div>

// Option 2: Use CSS module layout classes
import styles from "./MiniSidebar.module.css";

<div className={cn(styles.layout, collapsed && styles["sidebar-collapsed"])}>
  <MiniSidebar ... />
  <main className={styles["main-content"]}>{children}</main>
</div>
```

---

## Tooltip Snippets

### Native `title` (Quickest)

```tsx
<Link href="/dashboard" title={collapsed ? "Dashboard" : undefined}>
  <LayoutDashboard size={20} />
  {!collapsed && <span>Dashboard</span>}
</Link>
```

### CSS Hover Tooltip (Used in Implementation)

```tsx
<Link href="/dashboard" className="group relative">
  <LayoutDashboard size={20} />
  {collapsed && (
    <span className="sidebar-tooltip">Dashboard</span>
  )}
</Link>
```

### react-tooltip (Fanciest)

```bash
npm install react-tooltip
```

```tsx
import { Tooltip } from "react-tooltip";

<Tooltip id="sidebar" place="right" />

<Link
  href="/dashboard"
  data-tooltip-id="sidebar"
  data-tooltip-content="Dashboard"
>
  <LayoutDashboard size={20} />
</Link>
```

---

## 6 Manual Test Steps

### Test 1: Toggle Collapse
1. Load the dashboard
2. Click the arrow button in the sidebar header
3. **Expect**: Sidebar shrinks from 240px → 72px, labels fade out, icons center

### Test 2: Persistence
1. Collapse the sidebar
2. Refresh the browser (F5)
3. **Expect**: Sidebar remains collapsed after reload
4. Check DevTools → Application → Local Storage → `sidebar-collapsed` = `"true"`

### Test 3: Tooltip on Hover
1. Collapse the sidebar
2. Hover over any menu icon
3. **Expect**: Dark tooltip appears to the right with the label text

### Test 4: Nested Submenu (Collapsed)
1. Collapse the sidebar
2. Hover over an expandable section (e.g., "Leads")
3. **Expect**: Overlay menu appears with submenu items

### Test 5: Keyboard Accessibility
1. Press `Tab` until the toggle button is focused
2. Press `Enter` or `Space`
3. **Expect**: Sidebar toggles collapse/expand
4. Verify `aria-expanded` attribute updates in DevTools

### Test 6: Active State
1. Navigate to any page
2. Collapse the sidebar
3. **Expect**: Active item still shows colored strip on the left + icon remains highlighted

---

## Automated Test (Jest/RTL)

```tsx
// Install dependencies first:
// npm install --save-dev @testing-library/react @testing-library/jest-dom jest @types/jest

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MiniSidebar from "./MiniSidebar";

jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

describe("MiniSidebar toggle", () => {
  it("clicking toggle updates aria-expanded and persists to localStorage", async () => {
    render(
      <MiniSidebar
        items={[
          { href: "/dashboard", label: "Dashboard", icon: <svg /> },
        ]}
      />
    );

    const toggle = screen.getByLabelText("Collapse sidebar");

    // Initially expanded
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Click to collapse
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(localStorage.setItem).toHaveBeenCalledWith("sidebar-collapsed", "true");
    });
  });
});
```

---

## Migration Checklist for Existing Projects

| What | Where to Adapt |
|------|---------------|
| **Icon imports** | Ensure `lucide-react` is installed; swap any custom icons into the `icon` prop |
| **Route array** | Move your `<Link>` items into the `items` array (flat) or `sections` array (grouped) |
| **User avatar** | Pass as `footer` prop or inside `brand` prop |
| **CSS variables** | Ensure these exist in `globals.css`: `--sidebar-bg`, `--sidebar-active-bg`, `--primary` |
| **Active detection** | Component uses `usePathname()` from `next/navigation` — no changes needed |
| **Mobile drawer** | Keep your existing mobile overlay; this component handles desktop only |
| **Theme colors** | The component inherits from CSS variables; no hard-coded colors |

---

## Edge Cases Handled

| Case | Solution |
|------|----------|
| **SSR / Next.js** | `typeof window === "undefined"` guard prevents localStorage crash |
| **Hydration mismatch** | Defaults to `false` on server, hydrates to client value |
| **Rapid toggles** | CSS transitions prevent visual glitches |
| **Missing routes** | `end?: boolean` prop for exact vs. prefix matching |
| **Nested submenus collapsed** | Hover overlay with absolute positioning |
| **No JS** | Server renders expanded state; progressive enhancement |

---

## CSS Variable Requirements

Add these to your `globals.css` if missing:

```css
:root {
  --sidebar-bg: #081E10;        /* Dark green */
  --sidebar-active-bg: rgba(26, 122, 60, 0.18);
  --primary: #1A7A3C;           /* Brand accent */
}
```

For the **forest-light** theme already in your project, these are already defined.

---

## File Summary

```
components/
├── MiniSidebar.tsx          ← Drop-in component (Tailwind)
├── MiniSidebar.module.css   ← Plain CSS alternative
├── MiniSidebar.test.tsx     ← Jest/RTL test suite
└── MINI_SIDEBAR_GUIDE.md    ← This file

app/(dashboard)/
└── layout.tsx               ← Updated with collapse support

app/
└── globals.css              ← Added tooltip + transition styles
```

All set! The sidebar is ready to use with both the existing layout enhancement and the standalone component.
