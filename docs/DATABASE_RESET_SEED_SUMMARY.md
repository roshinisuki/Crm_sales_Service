# Database Reset & Seed Summary

**Date:** 2026-07-13  
**Environment:** Development/Staging (suki_crm @ 192.168.1.160:1433)  
**Backup:** `prisma/backups/backup-2026-07-13T06-17-02-767Z.json`

---

## STEP 1 — Data Wipe

### Wiped (all business data)
All business tables were cleared in FK-respecting order:
- Leads, Deals, Deal Stage History, Lost Deal Analyses
- RFQs, Quotations, Sample Requests, Negotiations, Purchase Orders
- Customers, Contacts, Customer Visits, Marketing Visits
- Products, Product Categories
- Tasks, Follow-ups, Activities, Communication Logs, Call Logs
- Competitors, Key Accounts, Territories, Territory Accounts
- Sales Targets, Forecast Entries
- Service Requests, Complaints, Defects, Installations
- Warranty Claims, AMC Contracts, Service Visits
- Customer Assets, Service Teams, Service Engineers
- Notes, Documents, Notifications, Audit Logs
- Invoices, Support Tickets
- Pipeline Stages, Lead Sources, Loss Reasons
- Email Templates, WhatsApp Templates
- Non-Admin Users (SalesManager, SalesExecutive)

### Preserved (config + Admin)
| Table | Notes |
|-------|-------|
| User (Admin only) | `admin@sukisoftware.com` — password hash unchanged |
| Company | Suki Software Solutions Pvt. Ltd. |
| SystemConfig | All system settings retained |
| PipelineStageMaster | 6-stage pipeline config retained |
| RolePermission | Role-based access control retained |
| ExchangeRate | Currency conversion rates retained |
| EscalationRule | Service escalation rules retained |
| TaxMaster | Tax configuration retained |

### FK Cycle Handling
- Quotation ↔ Negotiation cycle detected and broken by nulling `negotiationId` on Quotation before deletion.

---

## STEP 2 — Fresh Seed Data

### Sales CRM Seed (`prisma/seed-fresh.ts`)
| Module | Count | Status Coverage |
|--------|-------|-----------------|
| Users (sales) | 5 | 1 SalesManager + 4 SalesExecutive |
| Lead Sources | 8 | — |
| Pipeline Stages | 6 | 6-stage stepper |
| Loss Reasons | 7 | — |
| Email Templates | 5 | — |
| Product Categories | 5 | — |
| Products | 20 | — |
| Customers | 20 | Active, Inactive |
| Contacts | 20 | — |
| Leads | 20 | New, Contacted, FollowUpDue, SQL, Qualified, Converted, Lost |
| Deals | 20 | All pipeline stages |
| RFQs | 20 | New, UnderReview, CostingPending, QuotationCreated, Closed |
| Quotations | 20 | Sent, UnderReview, Accepted, Rejected, Expired |
| Sample Requests | 20 | New, UnderReview, SentToCustomer, Approved, Rejected, Revision |
| Negotiations | 20 | Open, UnderReview, Approved, Rejected, Closed |
| Purchase Orders | 20 | Draft, Pending, Approved, Rejected, SentToERP, Synced |
| Tasks | 20 | Pending, InProgress, Completed, Cancelled |
| Follow-ups | 20 | Pending, Completed, Overdue (includes overdue + upcoming) |
| Activities | 20 | — |
| Competitors | 20 | — |
| Lost Deal Analyses | 10 | — |
| Key Accounts | 20 | — |
| Territories | 4 | — |
| Sales Targets | 18 | — |
| Forecast Entries | 18 | — |

### Service Workspace Config (`prisma/seeds/serviceWorkspaceSeed.ts`)
| Module | Count |
|--------|-------|
| Service Categories | 10 |
| Complaint Types | 10 |
| Defect Types | 9 |
| Priority Levels | 4 (Low, Medium, High, Critical) |
| Service Statuses (request) | 6 (New, Assigned, In Progress, Pending Customer, Resolved, Closed) |
| Service Statuses (warranty) | 5 (New, Under Review, Approved, Rejected, Resolved) |
| Service Statuses (contract) | 2 (Active, Expired) |
| Service Teams | 6 |
| Service Engineers | 18 |
| Customer Assets | 61 |

### Service Operational Seed (`prisma/seed-service-operational.ts`)
| Module | Count | Status Coverage |
|--------|-------|-----------------|
| Service Requests | 12 | New, Assigned, In Progress, Pending Customer, Resolved, Closed |
| Complaints | 8 | New, Investigating, Resolved, Closed |
| Defects | 8 | New, Under Investigation, Corrective Action, Closed |
| Installations | 6 | Scheduled, In Progress, Completed |
| Warranty Claims | 6 | New, Under Review, Approved, Rejected, Resolved |
| AMC Contracts | 6 | Active, Expired |
| Service Visits | 9 | Scheduled, Completed, Overdue |

---

## STEP 3 — Admin Login

- **Email:** `admin@sukisoftware.com`
- **Password:** Unchanged (password hash preserved from before wipe)
- **Additional users:** `lead@sukisoftware.com`, `exec1@sukisoftware.com`, `exec2@sukisoftware.com`, `exec3@sukisoftware.com`, `exec4@sukisoftware.com` — all password: `Password@123`

---

## Scripts Used

| Script | Purpose |
|--------|---------|
| `prisma/backup-dump.ts` | Logical JSON backup before wipe |
| `prisma/wipe-preserve-admin.ts` | Wipe all data preserving Admin + config |
| `prisma/seed-fresh.ts` | Sales CRM comprehensive seed (20 records/module) |
| `prisma/seeds/serviceWorkspaceSeed.ts` | Service config + customer assets |
| `prisma/seed-service-operational.ts` | Service operational records (all statuses) |

All seed scripts are idempotent and re-runnable.
