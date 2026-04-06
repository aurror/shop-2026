import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { order } = await req.json();
  if (!Array.isArray(order)) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  await Promise.all(
    order.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
      db.update(categories).set({ sortOrder }).where(eq(categories.id, id))
    )
  );
  return NextResponse.json({ ok: true });
}
