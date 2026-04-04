import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

const MIME_MAP: Record<string, string> = {
  stl: "application/octet-stream",
  step: "application/octet-stream",
  stp: "application/octet-stream",
  obj: "application/octet-stream",
  "3mf": "application/octet-stream",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  zip: "application/zip",
};

function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_MAP[ext] ?? "application/octet-stream";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const fileName = request.nextUrl.searchParams.get("name");

  if (!fileName) {
    return NextResponse.json({ error: "name parameter required" }, { status: 400 });
  }

  const [req] = await db
    .select({ fileNames: contactRequests.fileNames, filePaths: contactRequests.filePaths })
    .from(contactRequests)
    .where(eq(contactRequests.id, id))
    .limit(1);

  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const fileNames: string[] = req.fileNames ?? [];
  const filePaths: string[] = req.filePaths ?? [];

  // Find the file path matching the requested file name
  const idx = fileNames.findIndex((n) => n === fileName);
  if (idx === -1) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const filePath = filePaths[idx];
  if (!filePath) {
    return NextResponse.json({ error: "File path missing" }, { status: 404 });
  }

  // Prevent path traversal — the stored path must be inside the uploads dir
  const uploadsRoot = path.join(process.cwd(), "uploads");
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await readFile(resolved);
    const mimeType = guessMime(fileName);
    const safeName = encodeURIComponent(fileName);

    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(data.length),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not readable" }, { status: 404 });
  }
}
