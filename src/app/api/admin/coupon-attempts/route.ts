import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { couponAttempts } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 200);

  const rows = await db
    .select()
    .from(couponAttempts)
    .orderBy(desc(couponAttempts.createdAt))
    .limit(limit);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      valid: sql<number>`count(*) filter (where valid = true)`,
      invalid: sql<number>`count(*) filter (where valid = false)`,
    })
    .from(couponAttempts);

  return NextResponse.json({ attempts: rows, stats });
}
