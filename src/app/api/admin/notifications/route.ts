import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminNotifications } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // "read", "unread", or null for all
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    const whereClause =
      filter === "read" ? eq(adminNotifications.read, true) :
      filter === "unread" ? eq(adminNotifications.read, false) :
      undefined;

    const [notifications, totalResult, unreadResult] = await Promise.all([
      db
        .select()
        .from(adminNotifications)
        .where(whereClause)
        .orderBy(desc(adminNotifications.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(adminNotifications)
        .where(whereClause),
      db
        .select({ count: count() })
        .from(adminNotifications)
        .where(eq(adminNotifications.read, false)),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount: unreadResult[0].count,
      pagination: {
        page,
        limit,
        total: totalResult[0].count,
        totalPages: Math.ceil(totalResult[0].count / limit),
      },
    });
  } catch (error) {
    console.error("[Admin Notifications GET]", error);
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
    const { notificationId, markAll } = body;

    if (markAll) {
      // Mark all unread notifications as read
      await db
        .update(adminNotifications)
        .set({ read: true })
        .where(eq(adminNotifications.read, false));

      return NextResponse.json({ message: "All notifications marked as read" });
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: "notificationId or markAll is required" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ id: adminNotifications.id })
      .from(adminNotifications)
      .where(eq(adminNotifications.id, notificationId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(adminNotifications)
      .set({ read: true })
      .where(eq(adminNotifications.id, notificationId))
      .returning();

    return NextResponse.json({ notification: updated });
  } catch (error) {
    console.error("[Admin Notifications PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
