import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Alle Felder erforderlich" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Neues Passwort muss mindestens 8 Zeichen lang sein" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Passwortänderung nur für lokale Konten möglich" }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Aktuelles Passwort ist falsch" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true });
}
