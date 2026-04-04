import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminRoles, userRoleAssignments } from "@/lib/db/schema";
import { eq, sql, desc, count } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const roles = await db
      .select({
        id: adminRoles.id,
        name: adminRoles.name,
        description: adminRoles.description,
        permissions: adminRoles.permissions,
        createdAt: adminRoles.createdAt,
        userCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${userRoleAssignments}
          WHERE ${userRoleAssignments.roleId} = ${adminRoles.id}
        )`,
      })
      .from(adminRoles)
      .orderBy(desc(adminRoles.createdAt));

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("[Admin Roles GET]", error);
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
    const { name, description, permissions } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!permissions || typeof permissions !== "object") {
      return NextResponse.json({ error: "permissions object is required" }, { status: 400 });
    }

    // Validate permissions structure
    const requiredPermKeys = ["orders", "products", "customers", "analytics", "discounts", "settings", "backups", "roles"];
    for (const key of requiredPermKeys) {
      if (!(key in permissions)) {
        return NextResponse.json(
          { error: `permissions must include "${key}"` },
          { status: 400 }
        );
      }
    }

    const [role] = await db
      .insert(adminRoles)
      .values({
        name: name.trim(),
        description: description || null,
        permissions,
      })
      .returning();

    return NextResponse.json({ role }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 409 }
      );
    }
    console.error("[Admin Roles POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roleId, name, description, permissions } = body;

    if (!roleId) {
      return NextResponse.json({ error: "roleId is required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(adminRoles)
      .where(eq(adminRoles.id, roleId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent editing the Super Admin role name
    if (existing.name === "Super Admin" && name && name !== "Super Admin") {
      return NextResponse.json(
        { error: "Cannot rename the Super Admin role" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = permissions;

    const [updated] = await db
      .update(adminRoles)
      .set(updateData)
      .where(eq(adminRoles.id, roleId))
      .returning();

    return NextResponse.json({ role: updated });
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 409 }
      );
    }
    console.error("[Admin Roles PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");

    if (!roleId) {
      return NextResponse.json({ error: "roleId query parameter is required" }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(adminRoles)
      .where(eq(adminRoles.id, roleId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Prevent deleting Super Admin
    if (existing.name === "Super Admin") {
      return NextResponse.json(
        { error: "Cannot delete the Super Admin role" },
        { status: 403 }
      );
    }

    // Check if role has assigned users
    const [assignmentCount] = await db
      .select({ count: count() })
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.roleId, roleId));

    if (assignmentCount.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete role with ${assignmentCount.count} assigned user(s). Remove assignments first.` },
        { status: 400 }
      );
    }

    await db.delete(adminRoles).where(eq(adminRoles.id, roleId));

    return NextResponse.json({ message: "Role deleted" });
  } catch (error) {
    console.error("[Admin Roles DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
