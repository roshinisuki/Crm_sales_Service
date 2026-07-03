# Customer Visit Module: Architecture & Workflow Review

This document provides a comprehensive technical review of the **Customer Visit Module** in the CRM, detailing the database schema, API workflows, and the lifecycle of a visit (including check-in and check-out mechanisms).

## 1. Database Architecture

The core of the module is built around the `CustomerVisit` model, with relationships to `Customer`, `User` (as host), and `Contact` (as attendees).

### `CustomerVisit` Schema Highlights
```prisma
model CustomerVisit {
  id                        String                  @id @default(uuid())
  customerId                String
  hostedBy                  String                  // The user owning the visit
  status                    String                  @default("PLANNED") // PLANNED, CHECKED_IN, CHECKED_OUT, COMPLETED, MISSED, RESCHEDULED
  priority                  String                  @default("Normal")
  purpose                   String

  // Scheduling
  plannedDate               DateTime?
  plannedTime               String?                 // e.g. "09:00"
  
  // Execution & Metrics
  checkInTime               DateTime?
  checkOutTime              DateTime?
  durationMinutes           Int?
  
  // Location Tracking (Anti-Fraud)
  gpsLat                    Float?                  // Check-in latitude
  gpsLng                    Float?                  // Check-in longitude
  gpsAnomaly                Boolean?                // True if check-in is > 1km from plant location
  checkOutGpsLocation       String?                 // "lat,lng" format
  checkOutGpsAnomaly        Boolean?                // True if check-out is > 1km from check-in location

  // Post-Visit Data
  meetingSummary            String?                 @db.NVarChar(Max)
  outcome                   String?
  nextMeetingDate           DateTime?
  parentVisitId             String?                 // For chaining follow-up visits
  
  // Soft Delete & Tenancy
  companyId                 String?
  deletedAt                 DateTime?
  
  // Relations
  customer                  Customer                @relation(fields: [customerId], references: [id])
  host                      User                    @relation(fields: [hostedBy], references: [id])
  plantLocation             PlantLocation?          @relation(fields: [plantLocationId], references: [id])
  visitAttendees            CustomerVisitAttendee[] 
}
```

## 2. API Endpoints & Data Fetching

The API routes are organized under `app/api/visits/`. The module uses server-side Prisma queries with strict role-based access control (RBAC) and tenant isolation (`companyId`).

### Listing & Fetching (`GET /api/visits`)
- **Isolation**: Ensures users only see data for their `companyId`. If the user is a `SalesExecutive`, the query is automatically scoped to `where.hostedBy = user.id`.
- **Includes**: Joins `customer` (for name and code), `host` (for rep details), and `plantLocation` (for map coordinates).
- **Pagination**: Implements standard offset pagination (`page`, `pageSize = 50`).

### Detailed Fetch (`GET /api/visits/[id]`)
Fetches a single visit with deep relational data needed for the Visit Details page:
- **Attendees**: Fetches related `Contact` details (email, phone, designation).
- **Linked Data**: Fetches `linkedOpportunity` to tie visits to active Deals.
- **History**: Fetches `parentVisit` (what led to this) and `childVisits` (follow-ups created from this visit).

### Planning a Visit (`POST /api/visits`)
1. Validates the `plannedDate` and `plannedTime` are in the future.
2. Validates that the selected `plantLocationId` actually belongs to the provided `customerId`.
3. Creates the `CustomerVisit` inside a **Prisma Transaction** (`prisma.$transaction`) alongside bulk-creating `CustomerVisitAttendee` records.
4. Uses `dispatchNotification` to alert the assigned user.

## 3. The Check-in Workflow

Path: `POST /api/visits/[id]/checkin`

The check-in process contains strict validation logic to ensure data integrity and prevent location fraud.

### Validation Steps:
1. **Status Check**: The visit must be in `PLANNED` status.
2. **Date Check**: A user cannot check in more than 1 day before the `plannedDate`.
3. **Time Window Enforcement**: 
   - Uses the user's timezone (defaults to `Asia/Kolkata`).
   - The allowed check-in window is strictly **15 minutes before** to **30 minutes after** the `plannedTime`.
   - Returns explicit error codes (`TOO_EARLY`, `TOO_LATE`) which the frontend handles to display countdowns or mark the visit as missed.
4. **GPS Anomaly Detection**:
   - The frontend sends `gps_lat` and `gps_lng` from the device's geolocation API.
   - The backend uses the **Haversine formula** to calculate the distance between the user's coordinates and the `plantLocation.gpsLat/Lng`.
   - If the distance exceeds **1 kilometer**, it flags `gpsAnomaly = true` and attaches a warning to the response.

### Execution:
- Sets `status = "CHECKED_IN"`.
- Records `checkInTime`, `gpsLat`, and `gpsLng`.

## 4. The Check-out Workflow

Path: `POST /api/visits/[id]/checkout`

### Validation & Execution:
1. **Status Check**: The visit must be in `CHECKED_IN` status.
2. **Duration Calculation**: Calculates `durationMinutes` automatically based on `checkInTime` and the current timestamp.
3. **Checkout GPS Anomaly Detection**:
   - The frontend again sends the current device coordinates.
   - The backend compares the **check-out location** against the **check-in location** (not the plant location).
   - If the user has moved more than **1 kilometer** away from where they checked in, it flags `checkOutGpsAnomaly = true` (to catch users checking out while driving away or from home).
4. **Execution**: Updates the visit to `status = "CHECKED_OUT"` and logs an Audit event.

*(Note: After check-out, the user typically fills out a meeting summary form which calls a separate `POST /api/visits/[id]/complete` endpoint to finalize the outcome and schedule next steps).*

## 5. Admin Dashboard Integration

On the frontend, the `AdminDashboard.tsx` acts as the command center for monitoring these visits in real-time.

- **Data Source**: It relies on an aggregated payload from `GET /api/dashboard`, specifically looking at `dashboardData.inboundVisits` and `dashboardData.outboundVisits`.
- **Live Tab Console**: Administrators can toggle between "Inbound" (Walk-ins) and "Outbound" (Field Visits).
- **Actions**: Admins have override capabilities to force a check-out directly from the dashboard if a rep forgets to do so, via the `CheckOutModal`.
