# Suki CRM — Design System

## Table Standards

- **Core Component**: All tables must use the shared `DataTable` component from `@/components/shared/DataTable`.
- **Background**: Tables have a pure white (or card background in dark mode) background. NO alternating row colors (zebra striping).
- **Row Separation**: Use a single thin (1px) light-gray horizontal divider (`border-b`) between rows.
- **Hover State**: Rows should have a subtle hover tint (`hover:bg-muted/50` in light, `dark:hover:bg-muted/30` in dark) to help track the current row.
- **Spacing/Padding**: Generous spacing. Cells must have minimum `14px` vertical padding (`py-3.5` or `py-4`) so rows feel spacious.
- **Headers**: Distinguishable from body (e.g. subtle bottom border). Header text should be readable: `text-sm font-medium text-foreground`, NOT light gray. Use sentence case or capitalized-first-letter, NOT all-caps. No colored headers (`bg-primary`).
- **Alignment**: Every column has a fixed width. Content is vertically centered. Text columns left-aligned, numeric columns right-aligned.
- **Pagination**: Use a consistent pagination control at the bottom of the table. No infinite scroll.

## Theme Color System

- Active theme color is stored in CSS variables:
  - `--primary` (alias for `--accent`)
  - `--accent` (the brand color)
  - `--brand-primary` (same as accent)
  - `--text-on-brand` (white or dark contrast text)
- The sidebar uses `--sidebar-active` and `--sidebar-active-bg` which are derived from `--brand-primary`.
- Tables use `--primary` (same source) so headers match the sidebar active state.

## Usage Examples

### CSS Utility Classes

```tsx
<div className="crm-card overflow-hidden">
  <div className="overflow-x-auto">
    <table className="crm-table">
      <thead>
        <tr>
          <th className="crm-th">Name</th>
          <th className="crm-th text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr className="crm-tr">
          <td className="crm-td">Value</td>
          <td className="crm-td text-right">...</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### shadcn Table Components

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Value</TableCell>
      <TableCell className="text-right">...</TableCell>
    </TableRow>
  </TableBody>
</Table>
```
