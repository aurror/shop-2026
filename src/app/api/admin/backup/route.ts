import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLocalBackup, createS3Backup, getBackupHistory } from "@/lib/backup";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await getBackupHistory();
    return NextResponse.json({ backups: history });
  } catch (error) {
    console.error("[Admin Backup GET]", error);
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
    const { location } = body;

    if (!location || !["local", "s3", "both"].includes(location)) {
      return NextResponse.json(
        { error: "location must be 'local', 's3', or 'both'" },
        { status: 400 }
      );
    }

    const results: Record<string, unknown> = {};

    if (location === "local" || location === "both") {
      const localResult = await createLocalBackup();
      results.local = localResult;
    }

    if (location === "s3" || location === "both") {
      const s3Result = await createS3Backup();
      results.s3 = s3Result;
    }

    // Determine overall success
    const allResults = Object.values(results) as Array<{ success: boolean }>;
    const allSucceeded = allResults.every((r) => r.success);
    const someSucceeded = allResults.some((r) => r.success);

    return NextResponse.json({
      success: allSucceeded,
      partial: !allSucceeded && someSucceeded,
      results,
    }, { status: allSucceeded ? 200 : someSucceeded ? 207 : 500 });
  } catch (error) {
    console.error("[Admin Backup POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
