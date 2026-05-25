import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      email: 'admin@sukisoftware.com',
      name: 'System Administrator',
      role: Role.Admin,
      passwordHash,
      isActive: true,
    },
    {
      email: 'lead@sukisoftware.com',
      name: 'Priya Sharma (Marketing Lead)',
      role: Role.MarketingLead,
      passwordHash,
      isActive: true,
    },
    {
      email: 'exec1@sukisoftware.com',
      name: 'Arjun Mehta (Marketing Exec)',
      role: Role.MarketingExecutive,
      passwordHash,
      isActive: true,
    },
    {
      email: 'exec2@sukisoftware.com',
      name: 'Divya Nair (Marketing Exec)',
      role: Role.MarketingExecutive,
      passwordHash,
      isActive: true,
    },
    {
      email: 'customer.demo@sukisoftware.com',
      name: 'Demo Customer',
      role: Role.Customer,
      passwordHash,
      isActive: true,
    }
  ];

  console.log('Seeding realistic user roles...');

  for (const user of users) {
    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
    console.log(`Created user: ${createdUser.email} [${createdUser.role}]`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
