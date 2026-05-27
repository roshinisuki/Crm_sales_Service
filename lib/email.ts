import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    if (!user) {
      console.log("=========================================");
      console.log(`[DEVELOPMENT] Mock Email to: ${to}`);
      console.log(`Subject: ${subject}`);
      const otpMatch = html.match(/\b\d{6}\b/);
      if (otpMatch) console.log(`=> Extracted OTP: ${otpMatch[0]}`);
      const linkMatch = html.match(/href="([^"]+)"/g);
      if (linkMatch) console.log(`=> Links: ${linkMatch.join(" | ")}`);
      console.log("=========================================");
      return;
    }
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.EMAIL_FROM || '"Suki CRM" <noreply@sukisoftware.com>',
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Failed to send email via SMTP:", error);
  }
}

// ── Shared header/footer HTML ─────────────────────────────────────────────────
function emailHeader(subtitle: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f9fb;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background:#0b1f3a;padding:32px 48px;text-align:center;">
  <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Suki CRM</p>
  <p style="margin:6px 0 0;font-size:13px;color:#7587a7;">${subtitle}</p>
</td></tr>
<tr><td style="padding:40px 48px;">`;
}

function emailFooter(note: string) {
  const year = new Date().getFullYear();
  return `</td></tr>
<tr><td style="padding:20px 48px;border-top:1px solid #eceef0;text-align:center;">
  <p style="margin:0;font-size:12px;color:#75777e;">${note}</p>
  <p style="margin:8px 0 0;font-size:12px;color:#c4c6ce;">© ${year} Suki Software. All rights reserved.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function otpBox(otp: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px;background:#f2f4f6;border-radius:12px;border:1px dashed #c4c6ce;">
  <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:12px;color:#0b1f3a;font-family:'Courier New',monospace;">${otp}</p>
</td></tr></table>`;
}

function linkButton(href: string, label: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:8px 0 24px;">
    <a href="${href}" style="display:inline-block;padding:14px 36px;background:#0b1f3a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${label}</a>
  </td></tr>
</table>`;
}

// ── OTP Email (first-login via login page) ────────────────────────────────────
export function buildOtpEmail(name: string, otp: string): string {
  return emailHeader("Secure Account Activation") +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#191c1e;">Hi ${name},</p>
     <p style="margin:0 0 28px;font-size:14px;color:#44474d;line-height:22px;">
       Welcome to <strong>Suki CRM</strong>! Use the code below to activate your account:
     </p>` +
    otpBox(otp) +
    `<p style="margin:20px 0 0;font-size:13px;color:#75777e;text-align:center;">
       Expires in <strong>10 minutes</strong>. Do not share this code with anyone.
     </p>` +
    emailFooter("If you did not expect this, contact IT Support immediately.");
}

// ── Invitation Email (admin creates user) ─────────────────────────────────────
export function buildInvitationEmail(name: string, email: string, otp: string, inviterName: string): string {
  return emailHeader("You've Been Invited") +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#191c1e;">Hi ${name},</p>
     <p style="margin:0 0 24px;font-size:14px;color:#44474d;line-height:22px;">
       <strong>${inviterName}</strong> has created a Suki CRM account for you.
       Use the one-time code below to log in and set your password.
     </p>
     <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#75777e;text-align:center;text-transform:uppercase;letter-spacing:0.08em;">One-Time Activation Code</p>` +
    otpBox(otp) +
    `<div style="margin-top:24px;padding:16px;background:#f0f4ff;border-radius:8px;border-left:4px solid #455f87;">
       <p style="margin:0;font-size:13px;color:#455f87;line-height:22px;">
         <strong>How to get started:</strong><br/>
         1. Go to the <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" style="color:#0b1f3a;">Suki CRM login page</a><br/>
         2. Enter your email: <strong>${email}</strong><br/>
         3. Enter the activation code above<br/>
         4. Set your personal password
       </p>
     </div>
     <p style="margin:20px 0 0;font-size:13px;color:#75777e;text-align:center;">
       Expires in <strong>10 minutes</strong>. Do not share it with anyone.
     </p>` +
    emailFooter("Need help? Contact your system administrator.");
}

// ── Internal Employee Activation Email (admin creates internal user) ───────────
export function buildInternalActivationEmail(name: string, activationUrl: string, inviterName: string): string {
  return emailHeader("Welcome to Suki CRM") +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#191c1e;">Hi ${name},</p>
     <p style="margin:0 0 24px;font-size:14px;color:#44474d;line-height:22px;">
       <strong>${inviterName}</strong> has added you to <strong>Suki CRM</strong> as a team member.
       Click the button below to set your password and activate your account.
     </p>` +
    linkButton(activationUrl, "Set My Password & Activate Account") +
    `<p style="margin:0 0 6px;font-size:13px;color:#75777e;">Or copy this link:</p>
     <p style="margin:0;font-size:12px;color:#455f87;word-break:break-all;">${activationUrl}</p>
     <div style="margin-top:24px;padding:16px;background:#f0f4ff;border-radius:8px;border-left:4px solid #455f87;">
       <p style="margin:0;font-size:13px;color:#455f87;line-height:22px;">
         <strong>How to get started:</strong><br/>
         1. Click the button above (or copy the link)<br/>
         2. Set your personal password<br/>
         3. Log in at <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" style="color:#0b1f3a;">Suki CRM</a> with your email and new password
       </p>
     </div>
     <p style="margin:20px 0 0;font-size:13px;color:#75777e;text-align:center;">
       This link expires in <strong>24 hours</strong>. If you did not expect this, please ignore this email.
     </p>` +
    emailFooter("Need help? Contact your system administrator.");
}

// ── Password Reset Email (Internal Users) ─────────────────────────────────────
export function buildResetEmail(name: string, resetUrl: string): string {
  return emailHeader("Password Reset Request") +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#191c1e;">Hi ${name},</p>
     <p style="margin:0 0 28px;font-size:14px;color:#44474d;line-height:22px;">
       We received a request to reset your Suki CRM password. Click below to set a new password:
     </p>` +
    linkButton(resetUrl, "Reset Password") +
    `<p style="margin:0 0 6px;font-size:13px;color:#75777e;">Or copy this link:</p>
     <p style="margin:0;font-size:12px;color:#455f87;word-break:break-all;">${resetUrl}</p>
     <p style="margin:20px 0 0;font-size:13px;color:#75777e;">
       Expires in <strong>15 minutes</strong>. If you did not request this, ignore this email.
     </p>` +
    emailFooter("For security, never share this link with anyone.");
}

// ── Customer Portal Activation Email ──────────────────────────────────────────
export function buildCustomerActivationEmail(name: string, activationUrl: string): string {
  return emailHeader("Welcome to Suki Software Customer Portal") +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#191c1e;">Hi ${name},</p>
     <p style="margin:0 0 28px;font-size:14px;color:#44474d;line-height:22px;">
       Your customer portal account has been activated. Click the button below to set your password and access your subscription details.
     </p>` +
    linkButton(activationUrl, "Activate My Account") +
    `<p style="margin:0 0 6px;font-size:13px;color:#75777e;">Or copy this link:</p>
     <p style="margin:0;font-size:12px;color:#455f87;word-break:break-all;">${activationUrl}</p>
     <p style="margin:20px 0 0;font-size:13px;color:#75777e;">
       This link expires in <strong>24 hours</strong>. If you did not expect this, contact your sales representative.
     </p>` +
    emailFooter("Suki Software Customer Support — support@sukisoftware.com");
}

// ── Customer Portal Password Reset Email ──────────────────────────────────────
export function buildCustomerResetEmail(name: string, resetUrl: string): string {
  return emailHeader("Reset Your Portal Password") +
    `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#191c1e;">Hi ${name},</p>
     <p style="margin:0 0 28px;font-size:14px;color:#44474d;line-height:22px;">
       We received a request to reset your Suki Software Customer Portal password.
     </p>` +
    linkButton(resetUrl, "Reset My Password") +
    `<p style="margin:0 0 6px;font-size:13px;color:#75777e;">Or copy this link:</p>
     <p style="margin:0;font-size:12px;color:#455f87;word-break:break-all;">${resetUrl}</p>
     <p style="margin:20px 0 0;font-size:13px;color:#75777e;">
       Expires in <strong>15 minutes</strong>. If you did not request this, ignore this email.
     </p>` +
    emailFooter("For security, never share this link with anyone.");
}
