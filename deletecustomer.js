/**
 * Script to delete all customers from the database
 * WARNING: This operation is irreversible!
 * 
 * Usage: node deletecustomer.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function deleteAllCustomers() {
  try {
    console.log("⚠️  WARNING: You are about to delete ALL customers from the database!");
    console.log("This operation is IRREVERSIBLE.\n");

    // Get the count before deletion
    const countBefore = await prisma.customer.count();
    console.log(`📊 Total customers to delete: ${countBefore}\n`);

    if (countBefore === 0) {
      console.log("✅ No customers found to delete.");
      return;
    }

    // Step 1: Delete all related records in order to avoid foreign key conflicts
    console.log("🔄 Deleting related records...\n");

    // Delete FollowUps
    const followUpsDeleted = await prisma.followUp.deleteMany({});
    console.log(`   ✓ Deleted ${followUpsDeleted.count} follow-up(s)`);

    // Delete Subscriptions
    const subscriptionsDeleted = await prisma.subscription.deleteMany({});
    console.log(`   ✓ Deleted ${subscriptionsDeleted.count} subscription(s)`);

    // Delete CustomerVisits
    const customerVisitsDeleted = await prisma.customerVisit.deleteMany({});
    console.log(`   ✓ Deleted ${customerVisitsDeleted.count} customer visit(s)`);

    // Delete MarketingVisits
    const marketingVisitsDeleted = await prisma.marketingVisit.deleteMany({});
    console.log(`   ✓ Deleted ${marketingVisitsDeleted.count} marketing visit(s)`);

    // Step 2: Now delete all customers
    console.log("\n🗑️  Deleting all customers...\n");
    const result = await prisma.customer.deleteMany({});

    console.log(`✅ Successfully deleted ${result.count} customer(s)!`);
    console.log(`📊 Remaining customers: ${await prisma.customer.count()}`);
  } catch (error) {
    console.error("❌ Error deleting customers:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the deletion
deleteAllCustomers();
