import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactRequests } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;

  // Quick pending count — used by the sidebar badge
  if (url.searchParams.get("pendingCount") === "1") {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contactRequests)
      .where(sql`${contactRequests.status} IN ('new', 'in_progress')`);
    return NextResponse.json({ pendingCount: Number(row?.count ?? 0) });
  }

  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 25;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (type) conditions.push(eq(contactRequests.type, type));
  if (status) conditions.push(eq(contactRequests.status, status));

  const where = conditions.length > 0
    ? conditions.reduce((a, b) => sql`${a} AND ${b}`)
    : undefined;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(contactRequests)
      .where(where)
      .orderBy(desc(contactRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(contactRequests)
      .where(where),
  ]);

  return NextResponse.json({
    requests: rows,
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
}
