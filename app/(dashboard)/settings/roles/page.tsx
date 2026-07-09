import { getRolePermissions } from "@/app/actions/permissions";
import RolePermissionMatrix from "./RolePermissionMatrix";

const MODULES = [
  'Dashboards',
  'Leads',
  'Accounts',
  'Contacts',
  'Activities',
  'Customer Visits',
  'Product Catalogue',
  'Samples',
  'Sales Pipeline',
  'RFQ',
  'Competitors',
  'Quotations',
  'Negotiations',
  'Purchase Orders',
  'Deals',
  'Tasks',
  'Follow Ups',
  'Documents',
  'Key Accounts',
  'Territories',
  'Targets',
  'Forecast',
  'Reports',
  'Approval Center',
  'Service Dashboard',
  'Service Requests',
  'Complaints',
  'Defects',
  'Installations',
  'Warranty & AMC',
  'Service Visits',
  'Customer Assets',
  'Service Reports',
  'Service Settings',
  'User Management',
  'Audit Logs',
  'Settings'
];

export const metadata = {
  title: 'Roles & Permissions | Suki CRM',
};

export default async function RolesPermissionsPage() {
  const permissions = await getRolePermissions();

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure module visibility and delete permissions for Sales Managers and Executives. Admin role has full access.
        </p>
      </div>

      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
        <RolePermissionMatrix initialPermissions={permissions} modules={MODULES} />
      </div>
    </div>
  );
}
