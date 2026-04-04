import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") return null;
  return session;
}

// PATCH /api/admin/categories/[id]/products
// body: { add: string[], remove: string[] }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { add = [], remove = [] } = await req.json();

  if (add.length > 0) {
    await db
      .update(products)
      .set({ categoryId: id })
      .where(
        sql`${products.id} = ANY(ARRAY[${sql.join(
          add.map((pid: string) => sql`${pid}::uuid`),
          sql`, `
        )}])`
      );
  }

  if (remove.length > 0) {
    await db
      .update(products)
      .set({ categoryId: null })
      .where(
        sql`${products.id} = ANY(ARRAY[${sql.join(
          remove.map((pid: string) => sql`${pid}::uuid`),
          sql`, `
        )}])`
      );
  }

  return NextResponse.json({ success: true });
}
