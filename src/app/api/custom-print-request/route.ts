import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { contactRequests, adminNotifications } from "@/lib/db/schema";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { checkSpam } from "@/lib/spam-check";
import { notifyTelegram } from "@/lib/telegram";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const description = String(form.get("description") || "").trim();
    const requestType = String(form.get("type") || "custom_print").trim();

    if (!name || !email || !description) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Ungültige E-Mail-Adresse." }, { status: 400 });
    }

    // Process files
    const files = form.getAll("files") as File[];
    const fileNames: string[] = [];
    const filePaths: string[] = [];
    let fileSizeError: string | null = null;

    for (const file of files) {
      if (!file.name || file.size === 0) continue;
      if (file.size > MAX_FILE_SIZE) {
        fileSizeError = `Datei "${file.name}" ist zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 100 MB. Bitte nutzen Sie einen Filehosting-Dienst und teilen den Link.`;
        break;
      }
    }

    if (!fileSizeError) {
      const uploadDir = path.join(process.cwd(), "uploads", "requests", Date.now().toString());
      if (files.some((f) => f.name && f.size > 0)) {
        await mkdir(uploadDir, { recursive: true });
      }
      for (const file of files) {
        if (!file.name || file.size === 0) continue;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = path.join(uploadDir, safeName);
        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);
        fileNames.push(file.name);
        filePaths.push(filePath);
      }
    }

    // Save to DB
    const [inserted] = await db
      .insert(contactRequests)
      .values({
        type: requestType,
        name,
        email,
        phone: phone || null,
        message: description,
        fileNames: fileNames.length > 0 ? fileNames : null,
        filePaths: filePaths.length > 0 ? filePaths : null,
        status: fileSizeError ? "new" : "new",
        errorMessage: fileSizeError,
      })
      .returning();

    // Run spam check in background (non-blocking)
    checkSpam(inserted.id, name, email, description).catch((e) =>
      console.error("[spam-check]", e),
    );

    // Create admin notification
    await db.insert(adminNotifications).values({
      type: "new_request",
      title: requestType === "custom_print" ? "Neue Maßanfertigungs-Anfrage" : "Neue Kontaktanfrage",
      message: `${name} (${email}): ${description.slice(0, 120)}${description.length > 120 ? "…" : ""}`,
      data: { requestId: inserted.id, type: requestType },
    });

    // Notify via Telegram
    notifyTelegram(
      "requests",
      `📩 *Neue ${requestType === "custom_print" ? "Maßanfertigungs-Anfrage" : "Kontaktanfrage"}*\n` +
        `Von: ${name} (${email})\n` +
        `${description.slice(0, 200)}${description.length > 200 ? "…" : ""}`,
    ).catch((e) => console.error("[telegram notify]", e));

    // Send emails
    const fileList =
      fileNames.length > 0
        ? fileNames.map((f) => `<li>${f}</li>`).join("")
        : "<li>Keine Dateien</li>";

    const shopEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "";
    if (shopEmail) {
      await sendEmail(
        shopEmail,
        `Neue ${requestType === "custom_print" ? "Maßanfertigungs-" : "Kontakt"}Anfrage von ${name}`,
        `<h2>Neue Anfrage</h2><p><b>Name:</b> ${name}<br><b>E-Mail:</b> ${email}<br>${phone ? `<b>Tel:</b> ${phone}<br>` : ""}</p><p>${description.replace(/</g, "&lt;")}</p><p><b>Dateien:</b></p><ul>${fileList}</ul>`,
        `Neue Anfrage von ${name} (${email}):\n\n${description}`,
      ).catch(() => {});
    }

    await sendEmail(
      email,
      "Ihre Anfrage bei 3DPrintIt",
      `<h2>Ihre Anfrage ist eingegangen</h2><p>Hallo ${name},</p><p>vielen Dank. Wir melden uns in der Regel innerhalb von 24 Stunden.</p><p>Ihr 3DPrintIt-Team</p>`,
      `Hallo ${name},\n\nvielen Dank für Ihre Anfrage. Wir melden uns zeitnah.\n\nIhr 3DPrintIt-Team`,
    ).catch(() => {});

    if (fileSizeError) {
      return NextResponse.json({ ok: true, warning: fileSizeError });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[custom-print-request]", err);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}

