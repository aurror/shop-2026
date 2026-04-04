import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const APP_DIR = process.cwd();

async function git(cmd: string) {
  const { stdout, stderr } = await execAsync(`git -C ${APP_DIR} ${cmd}`);
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function GET() {
  try {
    // Fetch latest from remote (no merge)
    await git("fetch origin main --quiet");

    const [localRes, remoteRes, logRes, lastDeployRes] = await Promise.allSettled([
      git("rev-parse HEAD"),
      git("rev-parse origin/main"),
      git("log origin/main -5 --pretty=format:%H|%s|%an|%ar"),
      git("log HEAD -1 --pretty=format:%ci"),
    ]);

    const local = localRes.status === "fulfilled" ? localRes.value.stdout : "";
    const remote = remoteRes.status === "fulfilled" ? remoteRes.value.stdout : "";
    const logRaw = logRes.status === "fulfilled" ? logRes.value.stdout : "";
    const lastDeployAt = lastDeployRes.status === "fulfilled" ? lastDeployRes.value.stdout : "";

    const commits = logRaw
      ? logRaw.split("\n").map((line) => {
          const [hash, message, author, age] = line.split("|");
          return { hash, message, author, age };
        })
      : [];

    const updateAvailable = local !== remote && remote !== "";

    return NextResponse.json({
      updateAvailable,
      currentCommit: local.slice(0, 7),
      remoteCommit: remote.slice(0, 7),
      lastDeployAt,
      commits,
    });
  } catch (error) {
    console.error("[Updates API GET]", error);
    return NextResponse.json({ error: "Fehler beim Prüfen" }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Set the deploy pending flag — cron or manual trigger will pick it up
    const flagPath = path.join(process.env.HOME || "/home/flo", ".shop-deploy-pending");
    await execAsync(`touch ${flagPath}`);

    // If deploy.sh exists and pm2 is available, run deploy immediately
    const deployScript = path.join(APP_DIR, "deploy.sh");
    // Run async — don't await (build takes time); client polls for result
    execAsync(`bash ${deployScript}`).catch(() => {});

    return NextResponse.json({ ok: true, message: "Deploy gestartet" });
  } catch (error) {
    console.error("[Updates API POST]", error);
    return NextResponse.json({ error: "Deploy konnte nicht gestartet werden" }, { status: 500 });
  }
}
