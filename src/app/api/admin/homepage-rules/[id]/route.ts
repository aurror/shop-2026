import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { homepageRules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { label, config, sortOrder, active } = await req.json();

  const [rule] = await db
    .update(homepageRules)
    .set({
      ...(label !== undefined && { label }),
      ...(config !== undefined && { config }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(active !== undefined && { active }),
    })
    .where(eq(homepageRules.id, id))
    .returning();

  return NextResponse.json({ rule });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(homepageRules).where(eq(homepageRules.id, id));
  return NextResponse.json({ success: true });
}
