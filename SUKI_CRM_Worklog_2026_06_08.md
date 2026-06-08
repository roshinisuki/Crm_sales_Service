# SUKI CRM Worklog – June 08, 2026

## Features & Enhancements

### 1. Integrated CRM Pipeline with Office/Field Visits
- Built a shared CRM progression flow into both the Office Visit and Field Visit check-out processes without merging the two distinct modules.
- The outcome of a visit directly dictates the lead's progression through the CRM (Follow-up → Qualified → Proposal → Negotiation → Won/Lost).

### 2. Streamlined Check-In & Check-Out Modals
- **Inbound Check-In**: Removed complex dynamic sub-forms. Reduced the form down to minimum required fields (Customer identity, simple Purpose dropdown, and Notes).
- **Outbound Check-In**: Retained the visible GPS Verification coordinates so executives can easily tell if GPS has successfully locked their location before checking in.
- Added intelligent smart prompts during Check-Out (e.g., asking for next meeting date if "Follow-up" is selected, or a loss reason if "Closed Lost" is selected).

### 3. Unified CRM Outcomes
- Stripped out the complicated purpose-specific outcome menus.
- All meetings now use a universal set of 6 outcomes that perfectly match the Lead Status pipeline:
  1. Follow-up Required
  2. Qualified Lead
  3. Proposal Needed
  4. Negotiation Ongoing
  5. Closed Won
  6. Closed Lost
- Customer Portal Access Decision is automatically hidden if a deal is marked as "Closed Lost".

### 4. Expired Subscription Handling
- Lifted the hard block that prevented customers with expired subscriptions from logging into their portals.
- The Customer Portal now displays a prominent red "Subscription Expired" alert banner for past-due users.
- Re-enabled the "Request Renewal" button for expired subscriptions (and added a default "New Service Subscription" prompt for users with no subscriptions). This seamlessly feeds into the employee notification system.

## Bug Fixes

### 1. User Management Role Display
- Fixed a bug on the User Master page where Customers were accidentally showing up under the "Internal Team" tab due to default database `userType` assignments.
- Corrected the `activateCustomerPortal` function to explicitly assign `userType: "customer"` to all future portal-enabled users to maintain strict separation.

### 2. Invalid Activation Link Error
- Resolved a critical bug causing the "This activation link has already been used or is invalid" error on the `/activate-account` screen.
- Overhauled `activateAccountAction` to safely parse the JWT payload, extract the underlying User ID/Email, and look up the record directly. This bypasses MySQL exact-match failures on long `Text` columns and significantly increases reliability.

### 3. Missing Email on New Walk-Ins
- Restored the "Email" input field to the "+ New Walk-In" creation form in the Office Check-In modal.
- This ensures that newly generated leads can actually be sent Portal Activation Links later on.

## Deployment
- Committed and pushed all CRM workflow integrations, form simplifications, and bug fixes to the `main` branch.
