import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up users...');

  // Get the default company
  let company = await prisma.company.findFirst({
    where: { name: 'Suki Software' }
  });
  
  if (!company) {
    company = await prisma.company.findFirst();
  }

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // Soft delete all users by setting isActive to false
  await prisma.user.updateMany({
    data: {
      isActive: false
    }
  });

  // Ensure Admin
  await prisma.user.upsert({
    where: { email: 'admin@sukisoftware.com' },
    update: {
      isActive: true,
      role: 'Admin',
      passwordHash: hashedPassword,
      name: 'System Admin',
      companyId: company?.id
    },
    create: {
      email: 'admin@sukisoftware.com',
      isActive: true,
      role: 'Admin',
      passwordHash: hashedPassword,
      name: 'System Admin',
      companyId: company?.id
    }
  });

  // Ensure SalesManager
  await prisma.user.upsert({
    where: { email: 'manager@sukisoftware.com' },
    update: {
      isActive: true,
      role: 'SalesManager',
      passwordHash: hashedPassword,
      name: 'Sales Manager',
      companyId: company?.id
    },
    create: {
      email: 'manager@sukisoftware.com',
      isActive: true,
      role: 'SalesManager',
      passwordHash: hashedPassword,
      name: 'Sales Manager',
      companyId: company?.id
    }
  });

  // Ensure SalesExecutive
  await prisma.user.upsert({
    where: { email: 'executive@sukisoftware.com' },
    update: {
      isActive: true,
      role: 'SalesExecutive',
      passwordHash: hashedPassword,
      name: 'Sales Executive',
      companyId: company?.id
    },
    create: {
      email: 'executive@sukisoftware.com',
      isActive: true,
      role: 'SalesExecutive',
      passwordHash: hashedPassword,
      name: 'Sales Executive',
      companyId: company?.id
    }
  });

  // Ensure SalesExecutive 2
  await prisma.user.upsert({
    where: { email: 'executive2@sukisoftware.com' },
    update: {
      isActive: true,
      role: 'SalesExecutive',
      passwordHash: hashedPassword,
      name: 'Sales Executive Two',
      companyId: company?.id
    },
    create: {
      email: 'executive2@sukisoftware.com',
      isActive: true,
      role: 'SalesExecutive',
      passwordHash: hashedPassword,
      name: 'Sales Executive Two',
      companyId: company?.id
    }
  });

  // Re-activate SuperAdmin as well if it exists to not break other things
  const superAdmin = await prisma.user.findUnique({ where: { email: 'superadmin@sukisoftware.com' } });
  if (superAdmin) {
    await prisma.user.update({
      where: { email: 'superadmin@sukisoftware.com' },
      data: { isActive: true, passwordHash: hashedPassword }
    });
  }

  // To cleanly remove old exact-role test accounts so they don't confuse the login process,
  // we could optionally hard delete the other active 'se1', 'se2', etc. from sukisoftware.com 
  // but soft-delete isActive=false is sufficient.
  
  // Just clean up old test executives
  const oldExecs = ['se1@sukisoftware.com', 'se2@sukisoftware.com', 'exec1@sukisoftware.com', 'exec2@sukisoftware.com', 'exec3@sukisoftware.com', 'exec4@sukisoftware.com', 'lead@sukisoftware.com'];
  
  for (const email of oldExecs) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.user.update({ where: { email }, data: { email: 'OLD_' + email, isActive: false } });
    }
  }

  console.log('Cleanup complete. 3 pristine accounts established:');
  console.log('- admin@sukisoftware.com (Password123!)');
  console.log('- manager@sukisoftware.com (Password123!)');
  console.log('- executive@sukisoftware.com (Password123!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
