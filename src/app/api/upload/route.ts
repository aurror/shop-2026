import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile } from "fs/promises";
import { mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import sharp from "sharp";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (pre-processing)
const UPLOAD_DIR = join(process.cwd(), "uploads", "images");
const MAX_WIDTH = 1200;
const THUMB_WIDTH = 400;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Nicht angemeldet" },
        { status: 401 }
      );
    }

    const role = (session.user as any).role;
    if (role !== "admin" && role !== "staff") {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Nur Bilddateien sind erlaubt" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Datei ist zu groß. Maximal 10 MB erlaubt." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const allowedExtensions = [
      "jpg", "jpeg", "png", "gif", "webp", "svg", "avif",
    ];
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: "Nicht unterstütztes Dateiformat" },
        { status: 400 }
      );
    }

    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const id = randomUUID();

    // SVGs are passed through without processing
    if (ext === "svg") {
      const filename = `${id}.svg`;
      await writeFile(join(UPLOAD_DIR, filename), buffer);
      const url = `/api/files?name=${filename}`;
      return NextResponse.json(
        { success: true, url, thumbUrl: url, filename },
        { status: 201 }
      );
    }

    // Process with sharp: strip EXIF, resize, convert to webp
    const mainFilename = `${id}.webp`;
    const thumbFilename = `${id}_thumb.webp`;

    const image = sharp(buffer).rotate(); // auto-rotate based on EXIF then strip

    const metadata = await image.metadata();
    const needsResize = (metadata.width || 0) > MAX_WIDTH;

    const mainPipeline = needsResize
      ? image.clone().resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
      : image.clone();

    await mainPipeline
      .webp({ quality: 82 })
      .toFile(join(UPLOAD_DIR, mainFilename));

    await image
      .clone()
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(join(UPLOAD_DIR, thumbFilename));

    const url = `/api/files?name=${mainFilename}`;
    const thumbUrl = `/api/files?name=${thumbFilename}`;

    return NextResponse.json(
      { success: true, url, thumbUrl, filename: mainFilename },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Upload]", error);
    return NextResponse.json(
      { error: "Fehler beim Hochladen der Datei" },
      { status: 500 }
    );
  }
}
