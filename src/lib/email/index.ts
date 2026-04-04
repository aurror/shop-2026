import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { emailTemplates, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getSmtpConfig() {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "smtp_host"));

  const smtpSettings: Record<string, string> = {};
  const keys = [
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
    "smtp_from",
  ];

  const allSettings = await db.select().from(settings);
  for (const s of allSettings) {
    if (keys.includes(s.key)) {
      smtpSettings[s.key] = s.value as string;
    }
  }

  // Fall back to env vars if DB settings are empty
  const host = smtpSettings.smtp_host || process.env.SMTP_HOST || "";
  const port = parseInt(String(smtpSettings.smtp_port || process.env.SMTP_PORT || "587"));
  const user = smtpSettings.smtp_user || process.env.SMTP_USER || "";
  const pass = smtpSettings.smtp_pass || process.env.SMTP_PASS || "";
  const from = smtpSettings.smtp_from || process.env.SMTP_FROM || "noreply@3dprintit.de";

  return { host, port, user, pass, from };
}

function createTransporter(config: {
  host: string;
  port: number;
  user: string;
  pass: string;
}) {
  if (!config.host) {
    console.warn("SMTP not configured, emails will not be sent");
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth:
      config.user && config.pass
        ? { user: config.user, pass: config.pass }
        : undefined,
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<boolean> {
  try {
    const config = await getSmtpConfig();
    const transporter = createTransporter(config);

    if (!transporter) {
      console.log(`[Email] Would send to ${to}: ${subject}`);
      return false;
    }

    await transporter.sendMail({
      from: `3DPrintIt <${config.from}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });

    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}

export async function sendTemplateEmail(
  to: string,
  templateKey: string,
  variables: Record<string, string>
): Promise<boolean> {
  try {
    const template = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.key, templateKey))
      .limit(1);

    if (!template.length) {
      console.error(`[Email] Template not found: ${templateKey}`);
      return false;
    }

    const tmpl = template[0];
    let subject = tmpl.subject;
    let html = tmpl.bodyHtml;
    let text = tmpl.bodyText || "";

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
      html = html.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
      text = text.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
    }

    // Wrap in a professional email layout
    const wrappedHtml = getEmailLayout(html);

    return sendEmail(to, subject, wrappedHtml, text);
  } catch (error) {
    console.error("[Email] Template send failed:", error);
    return false;
  }
}

function getEmailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { padding: 32px; text-align: center; border-bottom: 1px solid #e5e5e5; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #000; letter-spacing: -0.5px; }
    .content { padding: 32px; color: #333; line-height: 1.6; }
    .content h2 { font-size: 20px; font-weight: 600; color: #000; margin-top: 0; }
    .content a { color: #000; text-decoration: underline; }
    .footer { padding: 24px 32px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #e5e5e5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>3DPrintIt</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>3DPrintIt &ndash; Modelleisenbahn &amp; 3D-Druck</p>
      <p>Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.</p>
    </div>
  </div>
</body>
</html>`;
}
