import { PrismaClient } from "@prisma/client";
import { serviceModulesConfig } from "./lib/config/serviceModuleConfig";

const prisma = new PrismaClient();

async function main() {
  for (const moduleKey of Object.keys(serviceModulesConfig)) {
    const config = serviceModulesConfig[moduleKey];
    let mappedModule = moduleKey;
    if (moduleKey === "requests") mappedModule = "Request";
    if (moduleKey === "defects") mappedModule = "defect";
    if (moduleKey === "complaints") mappedModule = "complaint";
    if (moduleKey === "installations") mappedModule = "installation";
    if (moduleKey === "visits") mappedModule = "visit";

    for (const stat of config.statuses) {
      const existing = await prisma.serviceStatus.findFirst({
        where: { name: stat.label, module: mappedModule }
      });
      if (!existing) {
        await prisma.serviceStatus.create({
          data: {
            name: stat.label,
            color: stat.color,
            order: config.statusOrder.indexOf(stat.label) + 1,
            module: mappedModule,
            isActive: true
          }
        });
        console.log(`Created status ${stat.label} for module ${mappedModule}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
