import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const LOG_FILE = path.join(process.env.HOME || "/home/florian", "shop-deploy.log");
const FLAG_FILE = path.join(process.env.HOME || "/home/florian", ".shop-deploy-pending");

export async function GET() {
  try {
    let lines: string[] = [];
    if (existsSync(LOG_FILE)) {
      const content = await readFile(LOG_FILE, "utf-8");
      lines = content.split("\n").filter(Boolean);
    }

    const running = existsSync(FLAG_FILE);
    const finished = lines.some((l) => l.includes("Deploy finished"));
    const failed = lines.some((l) => l.toLowerCase().includes("error") || l.toLowerCase().includes("npm warn") === false && l.toLowerCase().includes("warn"));

    return NextResponse.json({ lines, running: running && !finished, finished });
  } catch (error) {
    console.error("[Updates log API]", error);
    return NextResponse.json({ lines: [], running: false, finished: false });
  }
}
