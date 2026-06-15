import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOverdueSummaries() {
  console.log("Running daily overdue follow-ups summary scheduler...");
  try {
    // central sweep function to mark overdue, trigger escalations, and dispatch notifications
    const { checkAndUpdateOverdueFollowUps } = await import("../app/actions/followUps");
    await checkAndUpdateOverdueFollowUps();

    // Now get all Overdue follow-ups
    const overdueFollowUps = await prisma.followUp.findMany({
      where: {
        status: "Overdue",
      },
      include: {
        customer: true,
        assignedUser: true,
      },
    });

    if (overdueFollowUps.length === 0) {
      console.log("No overdue follow-ups found.");
      return;
    }

    // Group by assigned user
    const groupedByUser = overdueFollowUps.reduce((acc, followUp) => {
      const email = followUp.assignedUser.email;
      if (!acc[email]) {
        acc[email] = {
          userName: followUp.assignedUser.name,
          followUps: [],
        };
      }
      acc[email].followUps.push(followUp);
      return acc;
    }, {} as Record<string, { userName: string; followUps: any[] }>);

    // Send emails
    for (const [email, data] of Object.entries(groupedByUser)) {
      if (!process.env.SMTP_USER) {
        console.warn(`SMTP credentials missing in env. Skipping email to ${email}`);
        continue;
      }
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0D2137; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;"> SUKI  Marketing CRM</h2>
          </div>
          <div style="padding: 24px;">
            <p>Hi <strong>${data.userName}</strong>,</p>
            <p>You have <strong>${data.followUps.length}</strong> overdue follow-up(s) that require your attention.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
              <tr style="background-color: #f8fafc; text-align: left;">
                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Customer</th>
                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Scheduled Date</th>
                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Remarks</th>
              </tr>
              ${data.followUps.map(f => `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${f.customer.name}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${f.nextMeetingDate.toLocaleDateString()}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${f.remarks || 'None'}</td>
                </tr>
              `).join('')}
            </table>
            <p style="margin-top: 24px; color: #475569; font-size: 14px;">
              Please log in to your dashboard to update these items.
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"SUKI CRM" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Reminder: ${data.followUps.length} Overdue Follow-ups`,
        html: htmlContent,
      });
      console.log(`Email sent to ${email} with ${data.followUps.length} items.`);
    }
  } catch (error) {
    console.error("Error running email scheduler:", error);
  }
}

// If script is run directly, execute immediately and start cron
if (require.main === module) {
  console.log("Email scheduler started. Job configured to run daily at 8:00 AM.");
  
  // Run every day at 8:00 AM
  cron.schedule("0 8 * * *", () => {
    sendOverdueSummaries();
  });
  
  // Also run it once immediately on startup for testing/verification
  sendOverdueSummaries();
}
