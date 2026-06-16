# Collapsible Sidebar Implementation Guide

## Overview
Complete collapsible sidebar implementation with localStorage persistence, smooth transitions, and accessibility support.

## Files Created
- `CollapsibleSidebar.tsx` - Main sidebar component (Tailwind version)
- `CollapsibleSidebar.module.css` - CSS module alternative
- `CollapsibleSidebarLayout.tsx` - Layout wrapper component
- `CollapsibleSidebar.test.tsx` - Jest/RTL test example

## Usage Example

### Basic Integration
```tsx
import CollapsibleSidebarLayout from "@/components/CollapsibleSidebarLayout";
import { useAuth } from "@/components/AuthProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  return (
    <CollapsibleSidebarLayout user={user} loading={loading}>
      {children}
    </CollapsibleSidebarLayout>
  );
}
```

### Custom Layout with Header
```tsx
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import DashboardHeader from "@/components/DashboardHeader";

export default function CustomLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <CollapsibleSidebar user={user} loading={loading} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader />
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </main>
    </div>
  );
}
```

## Tailwind CSS Classes Reference

### Sidebar Container
```tsx
// Full width
className="w-[240px] transition-all duration-300 ease-in-out"

// Collapsed width
className="w-[72px] transition-all duration-300 ease-in-out"

// Combined with state
className={cn(
  "transition-all duration-300 ease-in-out",
  collapsed ? "w-[72px]" : "w-[240px]"
)}
```

### Label Visibility
```tsx
// Show label
className="opacity-1 transition-opacity duration-200"

// Hide label
className="opacity-0 pointer-events-none w-0 transition-opacity duration-200"

// With animation
className="animate-in fade-in slide-in-from-left-2 duration-200"
```

### Icon Centering
```tsx
// Center when collapsed
className={cn(
  "flex items-center gap-3",
  collapsed ? "justify-center" : ""
)}
```

### Active State Indicator
```tsx
// Left border indicator
className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--primary)] rounded-r-full"
```

## Tooltip Implementation

### Native Title Attribute (Simple)
```tsx
<Link
  href={item.href}
  title={collapsed ? item.label : undefined}
>
  {item.icon}
  {!collapsed && <span>{item.label}</span>}
</Link>
```

### Custom Tooltip (Enhanced)
```tsx
<div className="group relative">
  <Link href={item.href}>
    {item.icon}
  </Link>
  {collapsed && (
    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
      {item.label}
    </div>
  )}
</div>
```

### React Tooltip Library
```bash
npm install react-tooltip
```

```tsx
import { Tooltip } from "react-tooltip";

<Tooltip id="sidebar-tooltip" place="right" />

<Link
  href={item.href}
  data-tooltip-id="sidebar-tooltip"
  data-tooltip-content={item.label}
>
  {item.icon}
</Link>
```

## Manual Testing Steps

1. **Initial Load Test**
   - Load the dashboard page
   - Verify sidebar appears in expanded state (240px width)
   - Check that all menu labels are visible
   - Verify toggle button shows left arrow icon

2. **Collapse Toggle Test**
   - Click the toggle button in sidebar header
   - Verify sidebar shrinks to 72px width
   - Check that menu labels disappear smoothly
   - Verify icons remain centered
   - Verify toggle button shows right arrow icon
   - Check aria-expanded attribute changes to "true"

3. **Persistence Test**
   - Collapse the sidebar
   - Refresh the page (F5 or Cmd+R)
   - Verify sidebar remains collapsed after reload
   - Check localStorage contains `sidebar-collapsed: "true"`

4. **Tooltip Test**
   - Collapse the sidebar
   - Hover over menu icons
   - Verify tooltip appears with correct label
   - Check tooltip disappears when mouse leaves
   - Verify tooltip doesn't appear when sidebar is expanded

5. **Active State Test**
   - Navigate to different pages
   - Verify current page has active indicator (colored strip)
   - Check active state persists after collapse/expand
   - Verify active item icon color changes

6. **Keyboard Accessibility Test**
   - Tab to the toggle button
   - Verify focus outline is visible
   - Press Enter/Space to toggle
   - Verify sidebar collapses/expands
   - Tab through menu items
   - Verify all items are focusable
   - Check screen reader announces labels

## Jest/React Testing Library Test

The test file `CollapsibleSidebar.test.tsx` includes:
- Default expanded state test
- Collapsed state from localStorage test
- Toggle button click test
- Tooltip hover test
- Label visibility test
- Active state indicator test
- Keyboard accessibility test
- SSR safety test

To run tests (after installing dependencies):
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest @types/jest
npm test CollapsibleSidebar.test.tsx
```

## Migration Notes

### 1. Icon Imports
Update icon imports in your existing sidebar:
```tsx
// Add these imports from lucide-react
import { ChevronLeft, ChevronRight } from "lucide-react";
```

### 2. Route Array
Replace your existing navigation items with the new structure:
```tsx
const mainNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} />, end: true },
  // ... add your existing routes
];
```

### 3. User Avatar Location
The user profile section is at the bottom of the sidebar. Update the user data:
```tsx
<div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold">
  {user?.name?.charAt(0) || "U"}
</div>
```

### 4. CSS Variables
Ensure these CSS variables are defined in your globals.css:
```css
:root {
  --sidebar-bg: #081E10;
  --sidebar-active-bg: rgba(26,122,60,0.18);
  --primary: #1A7A3C;
}
```

### 5. Layout Adjustments
Update your main layout to accommodate the sidebar:
```tsx
// Add margin-left to main content
<main className={cn(
  "flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300",
  collapsed ? "ml-[72px]" : "ml-[240px]"
)}>
```

### 6. Existing Sidebar Replacement
Replace your current sidebar in `app/(dashboard)/layout.tsx`:
```tsx
// Remove old SidebarContent component
// Add import
import CollapsibleSidebar from "@/components/CollapsibleSidebar";

// Replace aside content
<aside className="hidden md:flex shrink-0 flex-col h-full z-20">
  <CollapsibleSidebar user={user} loading={loading} handleLogout={handleLogout} />
</aside>
```

## Edge Cases Handled

### SSR Safety
```tsx
const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar-collapsed") === "true";
});
```

### Mobile Responsiveness
The CSS module includes mobile-specific styles for drawer behavior on screens < 768px.

### Accessibility Features
- `aria-expanded` attribute on toggle button
- `aria-label` for screen readers
- `role="navigation"` on sidebar
- Focus management
- Keyboard navigation support

## Customization Options

### Adjust Widths
```tsx
// In CollapsibleSidebar.tsx
collapsed ? "w-[64px]" : "w-[256px]"  // Custom widths
```

### Change Transition Duration
```tsx
// In CollapsibleSidebar.tsx
className="transition-all duration-500 ease-in-out"  // Slower transition
```

### Modify Colors
```css
/* In CollapsibleSidebar.module.css */
.sidebar {
  background: your-custom-color;
}
```

### Add Nested Submenus
```tsx
type NavSection = {
  label: string;
  icon: React.ReactNode;
  subItems: SubMenuItem[];
};

// Render with ExpandableNavSection component
<ExpandableNavSection 
  label="Leads" 
  icon={<Users size={20} />} 
  subItems={leadSubItems} 
  pathname={pathname} 
  collapsed={collapsed}
/>
```

## Troubleshooting

### Sidebar Not Collapsing
- Check localStorage is enabled in browser
- Verify CSS transitions are not being overridden
- Check console for JavaScript errors

### Labels Not Hiding
- Verify collapsed state is being passed correctly
- Check CSS specificity issues
- Ensure transition classes are applied

### Tooltips Not Showing
- Verify collapsed state is true
- Check z-index of tooltip
- Ensure tooltip is not being clipped by overflow

### Layout Issues
- Verify main content has transition class
- Check margin-left values match sidebar widths
- Ensure flex container is properly set up
