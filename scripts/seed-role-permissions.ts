import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODULES = [
  // Sales CRM
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
  // Service Workspace
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
  // Settings & User Management
  'User Management',
  'Audit Logs',
  'Settings'
];

async function main() {
  console.log('Seeding RolePermissions...');

  const roles = ['SalesManager', 'SalesExecutive'];

  for (const role of roles) {
    for (const module of MODULES) {
      await prisma.rolePermission.upsert({
        where: {
          role_module: {
            role,
            module
          }
        },
        update: {}, // Don't override if already exists
        create: {
          role,
          module,
          visible: true,
          canDelete: false
        }
      });
    }
  }

  console.log('RolePermissions seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
