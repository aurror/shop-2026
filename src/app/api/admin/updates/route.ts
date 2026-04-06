import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { spawn } from "child_process";
import path from "path";

const execAsync = promisify(exec);
const APP_DIR = process.cwd();

async function git(cmd: string) {
  const { stdout } = await execAsync(`git -C "${APP_DIR}" ${cmd}`);
  return stdout.trim();
}

export async function GET() {
  try {
    await execAsync(`git -C "${APP_DIR}" fetch origin main --quiet`);

    const [local, remote, logRaw, lastDeployAt] = await Promise.all([
      git("rev-parse HEAD").catch(() => ""),
      git("rev-parse origin/main").catch(() => ""),
      git(`log origin/main -5 --pretty=format:%H|%s|%an|%ar`).catch(() => ""),
      git("log HEAD -1 --pretty=format:%ci").catch(() => ""),
    ]);

    const commits = logRaw
      ? logRaw.split("\n").map((line) => {
          const [hash, message, author, age] = line.split("|");
          return { hash: hash || "", message: message || "", author: author || "", age: age || "" };
        })
      : [];

    return NextResponse.json({
      updateAvailable: local !== remote && remote !== "",
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
    const deployScript = path.join(APP_DIR, "deploy.sh");

    // Spawn fully detached — survives even if Next.js restarts during build.
    // Use bash -l (login shell) so ~/.bash_profile is sourced, giving the full
    // user environment (nvm, PATH, etc.) — same as running from a terminal.
    const child = spawn("bash", ["-l", deployScript, "--force"], {
      detached: true,
      stdio: "ignore",
      cwd: APP_DIR,
      env: {
        ...process.env,
        HOME: process.env.HOME || `/home/${process.env.USER || "florian"}`,
        TERM: "xterm",
      },
    });
    child.unref();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Updates API POST]", error);
    return NextResponse.json({ error: "Deploy konnte nicht gestartet werden" }, { status: 500 });
  }
}
