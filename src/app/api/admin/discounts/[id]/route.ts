import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { discountSchema } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [discount] = await db
      .select()
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!discount) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    return NextResponse.json({ discount });
  } catch (error) {
    console.error("[Admin Discount GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = discountSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ id: discounts.id })
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.productIds !== undefined) updateData.productIds = data.productIds;
    if (data.categoryIds !== undefined) updateData.categoryIds = data.categoryIds;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.active !== undefined) updateData.active = data.active;

    const [updated] = await db
      .update(discounts)
      .set(updateData)
      .where(eq(discounts.id, id))
      .returning();

    return NextResponse.json({ discount: updated });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A discount with this code already exists" },
        { status: 409 }
      );
    }
    console.error("[Admin Discount PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: discounts.id })
      .from(discounts)
      .where(eq(discounts.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Discount not found" }, { status: 404 });
    }

    await db.delete(discounts).where(eq(discounts.id, id));

    return NextResponse.json({ message: "Discount deleted" });
  } catch (error) {
    console.error("[Admin Discount DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
