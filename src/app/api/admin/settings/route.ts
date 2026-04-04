import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllSettings, updateSetting } from "@/lib/shipping";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allSettings = await getAllSettings();
    return NextResponse.json({ settings: allSettings });
  } catch (error) {
    console.error("[Admin Settings GET]", error);
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

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be a key-value object" }, { status: 400 });
    }

    const entries = Object.entries(body);

    if (entries.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    // Disallow certain sensitive keys from being set
    const forbiddenKeys = ["password_hash", "secret"];
    for (const [key] of entries) {
      if (forbiddenKeys.some((fk) => key.toLowerCase().includes(fk))) {
        return NextResponse.json(
          { error: `Setting key "${key}" is not allowed` },
          { status: 403 }
        );
      }
    }

    const updated: string[] = [];
    for (const [key, value] of entries) {
      await updateSetting(key, value);
      updated.push(key);
    }

    const allSettings = await getAllSettings();

    return NextResponse.json({
      message: `Updated ${updated.length} setting(s)`,
      updated,
      settings: allSettings,
    });
  } catch (error) {
    console.error("[Admin Settings PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
