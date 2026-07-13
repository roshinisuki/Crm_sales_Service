

> **Source of truth:** `lib/config/serviceModuleConfig.ts`, `app/(dashboard)/service/` route tree, and `lib/config/serviceSeedMockData.ts`.

---

## 1. Service Dashboard

Route: `/service/dashboard`

| Sub-Module | Ro# Service CRM — Modules & Sub-Modulesute | Description |
|---|---|---|
| My Dashboard | `/service/dashboard/my` | Engineer-facing dashboard showing assigned tickets, SLA timers, and pending visits |
| Manager Dashboard | `/service/dashboard/manager` | Manager-facing dashboard with team workload, SLA compliance, and escalation overview |

---

## 2. Service Requests

Route: `/service/requests` · Config key: `requests` · Icon: `FileQuestion`

**Statuses:** New → Assigned → In Progress → Pending Customer → Resolved → Closed

| Sub-Module / Feature | Details |
|---|---|
| List View | Filterable by priority (Low/Medium/High/Critical) and status; columns: Request Code, Customer, Asset, Priority, Status, Created At |
| Detail View | Sections: General Information, Assignment & SLA, Customer & Asset |
| Actions | Assign Engineer, Mark Resolved, Close Request |
| Form Fields | Customer (req), Customer Asset (req), Subject (req), Description, Priority Level (req), Service Category (req), Service Team, Service Engineer |

---

## 3. Customer Complaints

Route: `/service/complaints` · Config key: `complaints` · Icon: `AlertTriangle`

**Statuses:** New → Investigating → Resolved → Closed

| Sub-Module / Feature | Details |
|---|---|
| List View | Filterable by status; columns: Complaint Code, Customer, Complaint Type, Severity, Status, Created At |
| Detail View | Sections: Complaint Information, Customer & Asset |
| Actions | Start Investigation, Resolve Complaint, Close Complaint, Not Resolved / Reopen |
| Form Fields | Customer (req), Customer Asset, Complaint Type (req), Complaint Details (req), Priority (req) |

---

## 4. Product Defects

Route: `/service/defects` · Config key: `defects` · Icon: `HelpCircle`

**Statuses:** New → Under Investigation → Corrective Action → Closed

| Sub-Module / Feature | Details |
|---|---|
| List View | Filterable by status; columns: Defect Code, Defect Type, Asset, Status, Created At |
| Detail View | Sections: Defect Details, Asset Information |
| Actions | Start Investigation, Log Corrective Action, Close Defect, Reopen Defect |
| Form Fields | Defect Type (req), Customer Asset (req), Defect Details (req), Priority (req) |

---

## 5. Equipment Installations

Route: `/service/installations` · Config key: `installations` · Icon: `Hammer`

**Statuses:** Scheduled → In Progress → Completed

| Sub-Module / Feature | Details |
|---|---|
| List View | Filterable by status; columns: Commission Code, Customer, Asset, Status, Created At |
| Detail View | Sections: Installation Info, Assignments, Customer & Asset |
| Actions | Start Installation, Reschedule, Mark Completed, Mark Failed / Needs Follow-up |
| Form Fields | Customer (req), Customer Asset (req), Service Team, Service Engineer, Installation Notes |

---

## 6. Warranty & AMC Claims

Route: `/service/warranty-amc` · Config key: `warranty_amc` · Icon: `LifeBuoy`

**Statuses:** Active, Expired

| Sub-Module / Feature | Details |
|---|---|
| List View | Columns: Serial Number, Product Name, Status |
| Detail View | Displays warranty/AMC coverage context per asset (purchase date, warranty expiry, AMC expiry) |
| Actions | None configured (view-only tracking) |

---

## 7. Service Visits

Route: `/service/visits` · Config key: `visits` · Icon: `Calendar`

**Statuses:** Scheduled, Completed, Overdue

| Sub-Module / Feature | Details |
|---|---|
| List View | Filterable by status; columns: Visit Date, Customer, Engineer, Status |
| Detail View | Sections: Visit Information, Engineer & Customer |
| Actions | Mark Completed |
| Form Fields | Customer (req), Service Engineer (req), Visit Date (req), Notes |

---

## 8. Customer Assets

Route: `/service/assets`

| Sub-Module / Feature | Details |
|---|---|
| Asset Registry | Lists all customer assets with product name, serial number, purchase date, warranty expiry, AMC expiry |
| Warranty/AMC Context | Shown in detail pages of requests, complaints, defects, and installations via `WarrantyAMCContextCard` |

---

## 9. Service Reports

Route: `/service/reports`

| Report | Metric Source | Chart Type |
|---|---|---|
| Total Service Requests | `total_requests` | Bar |
| Total Complaints | `total_complaints` | Pie |
| Total Defects | `total_defects` | Bar |
| Total Installations | `total_installations` | Bar |
| Warranty Coverage | `warranty_coverage` | Pie |
| Total Service Visits | `total_visits` | Bar |

---

## 10. Service Settings

Route: `/service/settings`

Configuration page for service-specific master data:
- Service Teams
- Service Engineers
- Priority Levels
- Service Categories
- Complaint Types
- Defect Types

---

## Shared Infrastructure

| Component | Path | Purpose |
|---|---|---|
| `ServiceModuleConfig` interface | `lib/config/serviceModuleConfig.ts` | Defines statuses, transitions, columns, filters, form fields, detail sections, actions, badge rules, and report mappings for each module |
| `ServiceModuleListPage` | `components/shared/ServiceModuleListPage.tsx` | Reusable list page with tabs, search, and filters driven by config |
| `ServiceModuleForm` | `components/shared/ServiceModuleForm.tsx` | Reusable create/edit form driven by config field definitions |
| `ServiceModuleDetailPage` | `components/shared/ServiceModuleDetailPage.tsx` | Reusable detail page with status transition tracker, SLA countdown, escalation banner, and warranty/AMC context card |
| `ServiceComponents` | `components/shared/ServiceComponents.tsx` | SLACountdownBadge, EscalationBanner, WarrantyAMCContextCard widgets |
| Mock Seed Data | `lib/config/serviceSeedMockData.ts` | TypeScript interfaces and seed data for all service modules |
