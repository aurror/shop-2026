import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { order } = await req.json();
  if (!Array.isArray(order)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await Promise.all(
    order.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
      db.update(products).set({ sortOrder }).where(eq(products.id, id))
    )
  );
  return NextResponse.json({ ok: true });
}
