import { prisma } from "./lib/prisma";

async function main() {
  await prisma.user.update({
    where: { email: "admin@sukisoftware.com" },
    data: {
      passwordHash: "$2b$10$Zmjb7QssYiqWTht6rr2.muxEoXcRdb8pz4gHL6sPzsYaTVASnM5LK"
    }
  });
  console.log("Database hash fixed successfully!");
}

main().catch(console.error);
