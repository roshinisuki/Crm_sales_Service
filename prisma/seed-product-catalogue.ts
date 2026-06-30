/**
 * SUKI CRM — Product Catalogue Seed
 * Seeds categories, products, specifications, datasheets, and brochures for V2, V3, V4 tenants
 *
 * Run: npx ts-node prisma/seed-product-catalogue.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Product Catalogue seed...\n");

  // Look up tenant companies by name
  const v2Company = await prisma.company.findFirst({
    where: { name: { contains: "Bharat Metal Works" } }
  });
  const v3Company = await prisma.company.findFirst({
    where: { name: { contains: "Kaveri Solutions" } }
  });
  const v4Company = await prisma.company.findFirst({
    where: { name: { contains: "Sri Lakshmi" } }
  });

  const tenants = [
    { name: "V2 (Bharat Metal Works)", company: v2Company, variant: "V2" },
    { name: "V3 (Kaveri Solutions)", company: v3Company, variant: "V3" },
    { name: "V4 (Sri Lakshmi)", company: v4Company, variant: "V4" },
  ];

  const CATEGORIES = [
    { name: "Industrial Pumps", description: "Centrifugal, submersible, and process pumps" },
    { name: "Valves & Actuators", description: "Gate, globe, butterfly, and control valves" },
    { name: "Electric Motors", description: "AC induction, servo, and gearbox motors" },
    { name: "Control Panels", description: "MCC, PCC, and automation control panels" },
    { name: "Automation Components", description: "PLCs, VFDs, sensors, and relays" },
    { name: "Water Treatment Systems", description: "RO plants, softeners, and filtration systems" },
    { name: "Filtration Units", description: "Bag filters, cartridge filters, and strainers" },
    { name: "Process Equipment", description: "Heat exchangers, pressure vessels, and reactors" },
  ];

  const PRODUCTS = [
    // Industrial Pumps
    {
      categoryName: "Industrial Pumps",
      productCode: "PMP-CENT-001",
      productName: "Kirloskar Star-1 Centrifugal Pump",
      brand: "Kirloskar",
      model: "Star-1",
      series: "Star",
      shortDescription: "Single-stage centrifugal pump for water and mild chemicals",
      unitOfMeasure: "Nos",
      basePrice: 18500,
      specs: [
        { specName: "Flow Rate", specValue: "150", unit: "LPM", sortOrder: 1 },
        { specName: "Head", specValue: "30", unit: "Metres", sortOrder: 2 },
        { specName: "Power Rating", specValue: "1.5", unit: "kW", sortOrder: 3 },
        { specName: "Speed", specValue: "2900", unit: "RPM", sortOrder: 4 },
        { specName: "Inlet/Outlet Size", specValue: "40/32", unit: "mm", sortOrder: 5 },
        { specName: "Operating Temp", specValue: "0–80", unit: "°C", sortOrder: 6 },
        { specName: "Material (Casing)", specValue: "CI Grade FG 260", unit: "", sortOrder: 7 },
        { specName: "Efficiency", specValue: "72", unit: "%", sortOrder: 8 },
      ],
      datasheet: { title: "Star-1 Technical Datasheet", fileName: "kirloskar_star1_datasheet.pdf", fileUrl: "/files/datasheets/kirloskar_star1_datasheet.pdf" },
      brochure: { title: "Kirloskar Star Series Brochure", fileName: "kirloskar_star_series.pdf", fileUrl: "/files/brochures/kirloskar_star_series.pdf" },
    },
    {
      categoryName: "Industrial Pumps",
      productCode: "PMP-SUBM-001",
      productName: "Grundfos SP5-18 Submersible Pump",
      brand: "Grundfos",
      model: "SP5-18",
      series: "SP",
      shortDescription: "Deep well submersible pump for borewell applications",
      unitOfMeasure: "Nos",
      basePrice: 42000,
      specs: [
        { specName: "Flow Rate", specValue: "5", unit: "m³/hr", sortOrder: 1 },
        { specName: "Max Head", specValue: "173", unit: "Metres", sortOrder: 2 },
        { specName: "Motor Power", specValue: "2.2", unit: "kW", sortOrder: 3 },
        { specName: "Voltage", specValue: "415", unit: "V", sortOrder: 4 },
        { specName: "Borewell Dia", specValue: "100", unit: "mm", sortOrder: 5 },
        { specName: "Stages", specValue: "18", unit: "Nos", sortOrder: 6 },
      ],
      datasheet: { title: "SP5-18 Product Datasheet", fileName: "grundfos_sp5_18.pdf", fileUrl: "/files/datasheets/grundfos_sp5_18.pdf" },
    },
    {
      categoryName: "Industrial Pumps",
      productCode: "PMP-PROC-001",
      productName: "Flowserve Mark 3 Process Pump",
      brand: "Flowserve",
      model: "Mark 3",
      series: "ANSI",
      shortDescription: "ANSI/ASME B73.1 compliant horizontal process pump",
      unitOfMeasure: "Nos",
      basePrice: 125000,
      specs: [
        { specName: "Flow Rate", specValue: "50–500", unit: "m³/hr", sortOrder: 1 },
        { specName: "Max Pressure", specValue: "16", unit: "bar", sortOrder: 2 },
        { specName: "Max Temperature", specValue: "260", unit: "°C", sortOrder: 3 },
        { specName: "Casing Material", specValue: "SS 316L", unit: "", sortOrder: 4 },
        { specName: "Seal Type", specValue: "Mechanical Seal", unit: "", sortOrder: 5 },
      ],
      datasheet: { title: "Mark 3 Process Pump Datasheet", fileName: "flowserve_mark3.pdf", fileUrl: "/files/datasheets/flowserve_mark3.pdf" },
    },
    // Electric Motors
    {
      categoryName: "Electric Motors",
      productCode: "MOT-AC-001",
      productName: "ABB M2BAX 3-Phase Induction Motor 7.5kW",
      brand: "ABB",
      model: "M2BAX 132MA",
      series: "M2BAX",
      shortDescription: "IE3 premium efficiency 3-phase induction motor",
      unitOfMeasure: "Nos",
      basePrice: 28500,
      specs: [
        { specName: "Power Rating", specValue: "7.5", unit: "kW", sortOrder: 1 },
        { specName: "Voltage", specValue: "415", unit: "V", sortOrder: 2 },
        { specName: "Frequency", specValue: "50", unit: "Hz", sortOrder: 3 },
        { specName: "Speed", specValue: "1450", unit: "RPM", sortOrder: 4 },
        { specName: "Efficiency", specValue: "91.0", unit: "%", sortOrder: 5 },
        { specName: "Frame Size", specValue: "132M", unit: "", sortOrder: 6 },
        { specName: "IP Rating", specValue: "IP55", unit: "", sortOrder: 7 },
        { specName: "Insulation", specValue: "Class F", unit: "", sortOrder: 8 },
        { specName: "Starting Current (FLC)", specValue: "15.2", unit: "A", sortOrder: 9 },
      ],
      datasheet: { title: "M2BAX Technical Datasheet", fileName: "abb_m2bax_132ma.pdf", fileUrl: "/files/datasheets/abb_m2bax_132ma.pdf" },
    },
    {
      categoryName: "Electric Motors",
      productCode: "MOT-AC-002",
      productName: "Siemens SIMOTICS SD Motor 15kW",
      brand: "Siemens",
      model: "1LE1003",
      series: "SIMOTICS SD",
      shortDescription: "Standard motor for industrial general purpose applications",
      unitOfMeasure: "Nos",
      basePrice: 52000,
      specs: [
        { specName: "Power Rating", specValue: "15", unit: "kW", sortOrder: 1 },
        { specName: "Speed", specValue: "1480", unit: "RPM", sortOrder: 2 },
        { specName: "Efficiency", specValue: "92.1", unit: "%", sortOrder: 3 },
        { specName: "Voltage", specValue: "415", unit: "V", sortOrder: 4 },
        { specName: "IP Rating", specValue: "IP55", unit: "", sortOrder: 5 },
        { specName: "Frame", specValue: "160M", unit: "", sortOrder: 6 },
      ],
      datasheet: { title: "SIMOTICS SD Technical Datasheet", fileName: "siemens_simotics_sd.pdf", fileUrl: "/files/datasheets/siemens_simotics_sd.pdf" },
    },
    // Valves
    {
      categoryName: "Valves & Actuators",
      productCode: "VLV-GATE-001",
      productName: "L&T Gate Valve PN16 DN80",
      brand: "L&T Valves",
      model: "GVF-80",
      series: "Industrial Gate",
      shortDescription: "Flanged gate valve for on/off service, PN16 rated",
      unitOfMeasure: "Nos",
      basePrice: 3200,
      specs: [
        { specName: "Size (DN)", specValue: "80", unit: "mm", sortOrder: 1 },
        { specName: "Pressure Rating", specValue: "16", unit: "bar", sortOrder: 2 },
        { specName: "Body Material", specValue: "Cast Iron", unit: "", sortOrder: 3 },
        { specName: "Trim Material", specValue: "SS410", unit: "", sortOrder: 4 },
        { specName: "End Connection", specValue: "Flanged PN16", unit: "", sortOrder: 5 },
        { specName: "Temperature Range", specValue: "-10 to 200", unit: "°C", sortOrder: 6 },
      ],
      datasheet: { title: "Gate Valve Technical Datasheet", fileName: "lt_gate_valve_dn80.pdf", fileUrl: "/files/datasheets/lt_gate_valve_dn80.pdf" },
    },
    {
      categoryName: "Valves & Actuators",
      productCode: "VLV-BFLY-001",
      productName: "AUDCO Butterfly Valve DN150 Wafer Type",
      brand: "AUDCO",
      model: "BWF-150",
      series: "Wafer Butterfly",
      shortDescription: "Wafer type butterfly valve for water and utility services",
      unitOfMeasure: "Nos",
      basePrice: 4800,
      specs: [
        { specName: "Size (DN)", specValue: "150", unit: "mm", sortOrder: 1 },
        { specName: "Pressure Rating", specValue: "10", unit: "bar", sortOrder: 2 },
        { specName: "Body Material", specValue: "Ductile Iron", unit: "", sortOrder: 3 },
        { specName: "Disc Material", specValue: "SS 316", unit: "", sortOrder: 4 },
        { specName: "Liner", specValue: "EPDM", unit: "", sortOrder: 5 },
      ],
      datasheet: { title: "Butterfly Valve Datasheet", fileName: "audco_bwf_150.pdf", fileUrl: "/files/datasheets/audco_bwf_150.pdf" },
    },
    // Control Panels
    {
      categoryName: "Control Panels",
      productCode: "PNL-MCC-001",
      productName: "Siemens MCC Panel 415V 200A",
      brand: "Siemens",
      model: "SIVACON S8",
      series: "SIVACON",
      shortDescription: "Motor Control Centre for industrial motor management",
      unitOfMeasure: "Nos",
      basePrice: 185000,
      specs: [
        { specName: "Voltage", specValue: "415", unit: "V", sortOrder: 1 },
        { specName: "Current Rating", specValue: "200", unit: "A", sortOrder: 2 },
        { specName: "IP Rating", specValue: "IP42", unit: "", sortOrder: 3 },
        { specName: "Busbar Material", specValue: "Copper", unit: "", sortOrder: 4 },
        { specName: "Short Circuit", specValue: "50", unit: "kA", sortOrder: 5 },
        { specName: "Mounting", specValue: "Floor standing", unit: "", sortOrder: 6 },
      ],
      datasheet: { title: "SIVACON S8 Technical Manual", fileName: "siemens_sivacon_s8.pdf", fileUrl: "/files/datasheets/siemens_sivacon_s8.pdf" },
      brochure: { title: "Siemens Panel Solutions Brochure", fileName: "siemens_panels_brochure.pdf", fileUrl: "/files/brochures/siemens_panels_brochure.pdf" },
    },
    // Automation Components
    {
      categoryName: "Automation Components",
      productCode: "AUT-VFD-001",
      productName: "Schneider ATV320 VFD 5.5kW",
      brand: "Schneider Electric",
      model: "ATV320U55N4B",
      series: "Altivar 320",
      shortDescription: "Variable frequency drive for motor speed control",
      unitOfMeasure: "Nos",
      basePrice: 22000,
      specs: [
        { specName: "Power", specValue: "5.5", unit: "kW", sortOrder: 1 },
        { specName: "Input Voltage", specValue: "380–480", unit: "V", sortOrder: 2 },
        { specName: "Output Frequency", specValue: "0–500", unit: "Hz", sortOrder: 3 },
        { specName: "IP Rating", specValue: "IP20", unit: "", sortOrder: 4 },
        { specName: "Control Type", specValue: "V/f + Vector", unit: "", sortOrder: 5 },
      ],
      datasheet: { title: "ATV320 Technical Datasheet", fileName: "schneider_atv320.pdf", fileUrl: "/files/datasheets/schneider_atv320.pdf" },
    },
    {
      categoryName: "Automation Components",
      productCode: "AUT-PLC-001",
      productName: "Allen Bradley MicroLogix 1100 PLC",
      brand: "Rockwell Automation",
      model: "1763-L16BWA",
      series: "MicroLogix 1100",
      shortDescription: "Compact PLC with Ethernet and data logging",
      unitOfMeasure: "Nos",
      basePrice: 38000,
      specs: [
        { specName: "I/O Points", specValue: "16", unit: "Points", sortOrder: 1 },
        { specName: "Memory", specValue: "8", unit: "KB", sortOrder: 2 },
        { specName: "Communication", specValue: "Ethernet/IP + RS232", unit: "", sortOrder: 3 },
        { specName: "Supply Voltage", specValue: "24", unit: "VDC", sortOrder: 4 },
        { specName: "Operating Temp", specValue: "0–60", unit: "°C", sortOrder: 5 },
      ],
      datasheet: { title: "MicroLogix 1100 Datasheet", fileName: "micrologix_1100.pdf", fileUrl: "/files/datasheets/micrologix_1100.pdf" },
    },
  ];

  for (const tenant of tenants) {
    if (!tenant.company) {
      console.log(`⚠️  Skipping ${tenant.name} - company not found`);
      continue;
    }

    console.log(`\n📦 Seeding for ${tenant.name} (${tenant.company.name})...`);

    const companyId = tenant.company.id;

    // Seed categories
    const categoryMap: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      try {
        const existing = await prisma.productCategory.findFirst({
          where: { companyId, name: cat.name }
        });
        if (existing) {
          categoryMap[cat.name] = existing.id;
        } else {
          const created = await prisma.productCategory.create({
            data: { companyId, ...cat }
          });
          categoryMap[cat.name] = created.id;
        }
      } catch (e: any) {
        console.log(`⚠️  Category "${cat.name}" skipped: ${e.message?.slice(0, 80)}`);
      }
    }
    console.log(`✅ Categories: ${Object.keys(categoryMap).length}`);

    // Seed products
    let productCount = 0;
    for (const prod of PRODUCTS) {
      try {
        const categoryId = categoryMap[prod.categoryName];
        if (!categoryId) continue;

        const existing = await prisma.product.findFirst({
          where: { companyId, productCode: prod.productCode }
        });
        let product;
        if (existing) {
          product = existing;
        } else {
          product = await prisma.product.create({
            data: {
              companyId,
              categoryId,
              productCode: prod.productCode,
              name: prod.productName,
              description: prod.shortDescription,
              unit: prod.unitOfMeasure,
              basePrice: prod.basePrice,
              isActive: true,
            }
          });
        }

        // Seed specifications (delete and recreate for idempotency)
        await prisma.productSpecification.deleteMany({ where: { productId: product.id } });
        for (const spec of prod.specs) {
          await prisma.productSpecification.create({
            data: {
              productId: product.id,
              specKey: spec.specName,
              specValue: spec.specValue,
              unit: spec.unit,
              displayOrder: spec.sortOrder,
            }
          });
        }

        // Seed datasheet
        if (prod.datasheet) {
          await prisma.productDatasheet.deleteMany({ where: { productId: product.id } });
          await prisma.productDatasheet.create({
            data: {
              productId: product.id,
              companyId,
              title: prod.datasheet.title,
              fileName: prod.datasheet.fileName,
              fileUrl: prod.datasheet.fileUrl,
              isActive: true,
            }
          });
        }

        // Seed brochure
        if (prod.brochure) {
          await prisma.productBrochure.deleteMany({ where: { productId: product.id } });
          await prisma.productBrochure.create({
            data: {
              productId: product.id,
              companyId,
              title: prod.brochure.title,
              fileName: prod.brochure.fileName,
              fileUrl: prod.brochure.fileUrl,
              isActive: true,
            }
          });
        }

        productCount++;
      } catch (e: any) {
        console.log(`⚠️  Product "${prod.productCode}" skipped: ${e.message?.slice(0, 80)}`);
      }
    }
    console.log(`✅ Products: ${productCount}`);
  }

  console.log("\n🎉 Product Catalogue seed complete!");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
