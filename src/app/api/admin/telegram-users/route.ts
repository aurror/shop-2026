import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { telegramUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.select().from(telegramUsers);
  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId, acknowledged } = await request.json();
  if (!chatId) {
    return NextResponse.json({ error: "chatId required" }, { status: 400 });
  }

  const [updated] = await db
    .update(telegramUsers)
    .set({ acknowledged: Boolean(acknowledged) })
    .where(eq(telegramUsers.chatId, String(chatId)))
    .returning();

  return NextResponse.json({ user: updated });
}
