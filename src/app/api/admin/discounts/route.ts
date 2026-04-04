import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";
import { discountSchema } from "@/lib/security";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const [discountList, totalResult] = await Promise.all([
      db
        .select()
        .from(discounts)
        .orderBy(desc(discounts.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(discounts),
    ]);

    return NextResponse.json({
      discounts: discountList,
      pagination: {
        page,
        limit,
        total: totalResult[0].count,
        totalPages: Math.ceil(totalResult[0].count / limit),
      },
    });
  } catch (error) {
    console.error("[Admin Discounts GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = discountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [discount] = await db
      .insert(discounts)
      .values({
        code: data.code.toUpperCase(),
        description: data.description || null,
        type: data.type,
        value: data.value,
        minOrderAmount: data.minOrderAmount || null,
        maxUses: data.maxUses || null,
        productIds: data.productIds || null,
        categoryIds: data.categoryIds || null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        active: data.active ?? true,
      })
      .returning();

    return NextResponse.json({ discount }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A discount with this code already exists" },
        { status: 409 }
      );
    }
    console.error("[Admin Discounts POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
