import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, ilike, or, sql, ne, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

// GET — list all staff/admin users
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const conditions = [ne(users.role, "customer")];
  if (search) {
    conditions.push(or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`))!);
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      emailVerified: users.emailVerified,
      hasPassword: sql<boolean>`(${users.passwordHash} IS NOT NULL)`,
    })
    .from(users)
    .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
    .orderBy(desc(users.createdAt));

  return NextResponse.json({ users: allUsers });
}

// POST — invite a new user by email, or promote existing customer to role
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { email, role, name } = body as { email: string; role: string; name?: string };

  if (!email || !role || !["staff", "admin"].includes(role)) {
    return NextResponse.json({ error: "email and role (staff|admin) required" }, { status: 400 });
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

  if (existing) {
    await db.update(users).set({ role }).where(eq(users.id, existing.id));
    return NextResponse.json({ ok: true, action: "promoted", userId: existing.id });
  }

  const tempPassword = crypto.randomBytes(16).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [newUser] = await db
    .insert(users)
    .values({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      role,
      passwordHash,
    })
    .returning({ id: users.id });

  try {
    const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/login`;
    await sendEmail(
      email,
      "Einladung zum 3DPrintIt Admin-Dashboard",
      `<p>Hallo ${name || ""},</p>
       <p>Sie wurden als <strong>${role}</strong> zum 3DPrintIt Admin-Dashboard eingeladen.</p>
       <p>Temporäres Passwort: <code>${tempPassword}</code></p>
       <p>Login: <a href="${loginUrl}">${loginUrl}</a></p>`,
      `Einladung als ${role}. Temporäres Passwort: ${tempPassword} Login: ${loginUrl}`,
    );
  } catch (e) {
    console.error("[invite email]", e);
  }

  return NextResponse.json({ ok: true, action: "invited", userId: newUser.id, tempPassword });
}
