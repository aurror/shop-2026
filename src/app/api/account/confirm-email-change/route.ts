import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailChangeRequests } from "@/lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "Code erforderlich" }, { status: 400 });
  }

  const [request] = await db
    .select()
    .from(emailChangeRequests)
    .where(
      and(
        eq(emailChangeRequests.userId, session.user.id),
        eq(emailChangeRequests.code, String(code)),
        gt(emailChangeRequests.expiresAt, new Date()),
        isNull(emailChangeRequests.usedAt)
      )
    )
    .orderBy(emailChangeRequests.createdAt)
    .limit(1);

  if (!request) {
    return NextResponse.json({ error: "Ungültiger oder abgelaufener Code" }, { status: 400 });
  }

  // Check new email not already taken (race condition guard)
  const [existing] = await db.select().from(users).where(eq(users.email, request.newEmail)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Diese E-Mail-Adresse ist bereits vergeben" }, { status: 400 });
  }

  await db
    .update(emailChangeRequests)
    .set({ usedAt: new Date() })
    .where(eq(emailChangeRequests.id, request.id));

  await db
    .update(users)
    .set({ email: request.newEmail })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true, newEmail: request.newEmail });
}
