import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    where: { variant: { in: [2, 3, 4] } },
    select: { id: true, name: true, variant: true }
  });

  console.log('Product Catalogue Seed Verification:\n');

  for (const company of companies) {
    const categories = await prisma.productCategory.count({ where: { companyId: company.id } });
    const products = await prisma.product.count({ where: { companyId: company.id } });
    const specs = await prisma.productSpecification.count({ where: { companyId: company.id } });
    const datasheets = await prisma.productDatasheet.count({ where: { companyId: company.id } });
    const brochures = await prisma.productBrochure.count({ where: { companyId: company.id } });

    console.log(`${company.name} (V${company.variant}):`);
    console.log(`  Categories: ${categories}`);
    console.log(`  Products: ${products}`);
    console.log(`  Specifications: ${specs}`);
    console.log(`  Datasheets: ${datasheets}`);
    console.log(`  Brochures: ${brochures}\n`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
