import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactRequests, contactReplies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const message = String(body.message || "").trim();

  if (!message) {
    return NextResponse.json({ error: "Nachricht darf nicht leer sein." }, { status: 400 });
  }

  // Get the request to find customer email
  const [req] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, id))
    .limit(1);

  if (!req) {
    return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 });
  }

  // Save reply
  const [reply] = await db
    .insert(contactReplies)
    .values({
      requestId: id,
      message,
      sentBy: session.user.email || session.user.name || "Admin",
    })
    .returning();

  // Update request status
  await db
    .update(contactRequests)
    .set({ status: "replied", updatedAt: new Date() })
    .where(eq(contactRequests.id, id));

  // Send email to customer
  const html = `
    <h2 style="margin:0 0 16px;font-size:18px;">Antwort auf Ihre Anfrage</h2>
    <p>Hallo ${req.name},</p>
    <p>wir haben auf Ihre Anfrage geantwortet:</p>
    <blockquote style="border-left:3px solid #e5e5e5;margin:16px 0;padding:12px 16px;color:#333;white-space:pre-wrap;">${message.replace(/</g, "&lt;")}</blockquote>
    <p style="color:#666;">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
    <p>Ihr 3DPrintIt-Team</p>
  `;

  await sendEmail(
    req.email,
    "Antwort auf Ihre Anfrage – 3DPrintIt",
    html,
    `Hallo ${req.name},\n\n${message}\n\nIhr 3DPrintIt-Team`,
  ).catch((e) => console.error("[reply email]", e));

  return NextResponse.json({ reply });
}
