import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailChangeRequests } from "@/lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { newEmail } = await req.json();
  if (!newEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(newEmail)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "E-Mail-Änderung nur für lokale Konten möglich" }, { status: 400 });
  }
  if (user.email === newEmail) {
    return NextResponse.json({ error: "Das ist bereits Ihre aktuelle E-Mail-Adresse" }, { status: 400 });
  }

  // Check if new email is already taken
  const [existing] = await db.select().from(users).where(eq(users.email, newEmail)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Diese E-Mail-Adresse ist bereits vergeben" }, { status: 400 });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await db.insert(emailChangeRequests).values({
    userId: session.user.id,
    newEmail,
    code,
    expiresAt,
  });

  await sendEmail(
    newEmail,
    "E-Mail-Adresse bestätigen – 3DPrintIt",
    `<p>Ihr Bestätigungscode: <strong>${code}</strong></p><p>Gültig für 15 Minuten.</p>`,
    `Ihr Bestätigungscode: ${code}\nGültig für 15 Minuten.`
  );

  return NextResponse.json({ success: true });
}
