import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "images");

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  if (!name || name.includes("..") || name.includes("/")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const filePath = path.join(UPLOADS_DIR, name);
  // Must stay inside uploads/images
  if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_DIR))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const data = await readFile(filePath);
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", gif: "image/gif", svg: "image/svg+xml", avif: "image/avif",
    };
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
