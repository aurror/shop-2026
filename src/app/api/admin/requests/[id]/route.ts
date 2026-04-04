import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactRequests, contactReplies } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [req] = await db
    .select()
    .from(contactRequests)
    .where(eq(contactRequests.id, id))
    .limit(1);

  if (!req) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const replies = await db
    .select()
    .from(contactReplies)
    .where(eq(contactReplies.requestId, id))
    .orderBy(desc(contactReplies.createdAt));

  return NextResponse.json({ request: req, replies });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.status) updateData.status = body.status;
  if (body.adminNotes !== undefined) updateData.adminNotes = body.adminNotes;

  const [updated] = await db
    .update(contactRequests)
    .set(updateData)
    .where(eq(contactRequests.id, id))
    .returning();

  return NextResponse.json({ request: updated });
}
