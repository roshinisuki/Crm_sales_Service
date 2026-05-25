import { prisma } from "@/lib/prisma";

export async function logAudit(
  userId: string | null,
  module: string,
  action: string,
  details?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        module,
        action,
        details,
      },
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
    // We don't throw here to avoid failing the main business logic
    // if the audit log insertion happens to fail temporarily.
  }
}
