import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { homepageRules } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await db.select().from(homepageRules).orderBy(asc(homepageRules.sortOrder));
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, label, config = {}, sortOrder = 0 } = await req.json();
  if (!type || !label) return NextResponse.json({ error: "type and label required" }, { status: 400 });

  const [rule] = await db.insert(homepageRules).values({ type, label, config, sortOrder }).returning();
  return NextResponse.json({ rule }, { status: 201 });
}
