import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json() as Record<string, string>;

  const [existing] = await db.select().from(users).where(eq(users.id, id));
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.role !== undefined) {
    if (!["customer", "staff", "admin"].includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = body.role;
  }
  if (body.email !== undefined) {
    const newEmail = body.email.toLowerCase().trim();
    const [conflict] = await db.select({ id: users.id }).from(users).where(eq(users.email, newEmail));
    if (conflict && conflict.id !== id) {
      return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
    }
    updates.email = newEmail;
  }
  if (body.password !== undefined && body.password !== "") {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
    }
    updates.passwordHash = await bcrypt.hash(body.password, 12);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (id === (session.user as any).id) {
    return NextResponse.json({ error: "Eigenen Account kann man nicht entfernen" }, { status: 400 });
  }

  await db.update(users).set({ role: "customer" }).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
