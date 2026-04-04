import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import { updateSetting, getAllSettings } from "@/lib/shipping";

const execAsync = promisify(exec);

const CRON_MARKER = "# 3dprintit-backup";
const SCRIPT_PATH = "/home/flo/shop/scripts/backup-cron.js";

/** Read current cron schedule setting + live crontab entry */
export async function GET() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allSettings = await getAllSettings();
  const savedExpression = String(allSettings.backup_cron_expression || "");
  const savedLocation = String(allSettings.backup_cron_location || "local");

  // Read actual installed crontab line
  let installedLine = "";
  try {
    const { stdout } = await execAsync("crontab -l 2>/dev/null || true");
    const line = stdout.split("\n").find((l) => l.includes(CRON_MARKER));
    installedLine = line?.trim() || "";
  } catch {
    // no crontab yet
  }

  return NextResponse.json({
    expression: savedExpression,
    location: savedLocation,
    installedLine,
    scriptPath: SCRIPT_PATH,
  });
}

/** Save schedule setting + install/remove system crontab entry */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { expression, location = "local", enabled = true } = body;

  if (enabled && expression) {
    // Basic cron expression validation (5 or 6 fields)
    const parts = String(expression).trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return NextResponse.json({ error: "Ungültiger Cron-Ausdruck (5 Felder erwartet, z.B. '0 2 * * *')" }, { status: 400 });
    }
  }

  // Persist to settings
  await updateSetting("backup_cron_expression", enabled ? String(expression).trim() : "");
  await updateSetting("backup_cron_location", location);

  // Update system crontab
  try {
    // Read existing crontab (may be empty)
    let existing = "";
    try {
      const { stdout } = await execAsync("crontab -l 2>/dev/null || true");
      existing = stdout;
    } catch {
      existing = "";
    }

    // Strip any existing 3dprintit backup line
    const filtered = existing
      .split("\n")
      .filter((l) => !l.includes(CRON_MARKER))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd();

    let newCrontab = filtered;

    if (enabled && expression) {
      const expr = String(expression).trim();
      const newLine = `${expr} node ${SCRIPT_PATH} ${location} >> /tmp/3dprintit-backup.log 2>&1 ${CRON_MARKER}`;
      newCrontab = (filtered ? filtered + "\n" : "") + newLine;
    }

    // Write back
    const { writeFileSync, unlinkSync } = await import("fs");
    const tmpFile = `/tmp/crontab-3dprintit-${Date.now()}.txt`;
    writeFileSync(tmpFile, newCrontab + "\n");
    await execAsync(`crontab ${tmpFile}`);
    try { unlinkSync(tmpFile); } catch {}

    // Read back what was installed for confirmation
    const { stdout: confirmed } = await execAsync("crontab -l 2>/dev/null || true");
    const installedLine = confirmed.split("\n").find((l) => l.includes(CRON_MARKER))?.trim() || "";

    return NextResponse.json({ success: true, installedLine });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Backup Schedule]", error);
    return NextResponse.json({ error: `Crontab-Fehler: ${msg}` }, { status: 500 });
  }
}

/** Remove the installed crontab entry */
export async function DELETE() {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let existing = "";
    try {
      const { stdout } = await execAsync("crontab -l 2>/dev/null || true");
      existing = stdout;
    } catch {}

    const filtered = existing
      .split("\n")
      .filter((l) => !l.includes(CRON_MARKER))
      .join("\n")
      .trimEnd();

    const { writeFileSync, unlinkSync } = await import("fs");
    const tmpFile = `/tmp/crontab-3dprintit-${Date.now()}.txt`;
    writeFileSync(tmpFile, filtered + "\n");
    await execAsync(`crontab ${tmpFile}`);
    try { unlinkSync(tmpFile); } catch {}

    await updateSetting("backup_cron_expression", "");
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
