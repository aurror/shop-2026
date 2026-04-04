import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, orders } from "@/lib/db/schema";
import { desc, ilike, or, sql, count, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.phone, `%${search}%`)
        )
      );
    }

    // Only list customers (not admin/staff)
    conditions.push(eq(users.role, "customer"));

    const whereClause = conditions.length > 1
      ? sql`${conditions[0]} AND ${conditions[1]}`
      : conditions[0];

    // Get customers with order counts and total spent using a subquery approach
    const customersRaw = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        image: users.image,
        role: users.role,
        createdAt: users.createdAt,
        orderCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${orders} WHERE ${orders.userId} = ${users.id}
        )`,
        totalSpent: sql<string>`COALESCE((
          SELECT SUM(${orders.total}::numeric) FROM ${orders} WHERE ${orders.userId} = ${users.id} AND ${orders.paymentStatus} = 'paid'
        ), 0)`,
      })
      .from(users)
      .where(eq(users.role, "customer"))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Apply search filter separately if needed
    let customerList;
    if (search) {
      customerList = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          image: users.image,
          role: users.role,
          createdAt: users.createdAt,
          orderCount: sql<number>`(
            SELECT COUNT(*)::int FROM ${orders} WHERE ${orders.userId} = ${users.id}
          )`,
          totalSpent: sql<string>`COALESCE((
            SELECT SUM(${orders.total}::numeric) FROM ${orders} WHERE ${orders.userId} = ${users.id} AND ${orders.paymentStatus} = 'paid'
          ), 0)`,
        })
        .from(users)
        .where(
          sql`${users.role} = 'customer' AND (${ilike(users.name, `%${search}%`)} OR ${ilike(users.email, `%${search}%`)} OR ${ilike(users.phone, `%${search}%`)})`
        )
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      customerList = customersRaw;
    }

    // Get total count
    const [totalResult] = search
      ? await db
          .select({ count: count() })
          .from(users)
          .where(
            sql`${users.role} = 'customer' AND (${ilike(users.name, `%${search}%`)} OR ${ilike(users.email, `%${search}%`)} OR ${ilike(users.phone, `%${search}%`)})`
          )
      : await db
          .select({ count: count() })
          .from(users)
          .where(eq(users.role, "customer"));

    return NextResponse.json({
      customers: customerList,
      pagination: {
        page,
        limit,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limit),
      },
    });
  } catch (error) {
    console.error("[Admin Customers GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
