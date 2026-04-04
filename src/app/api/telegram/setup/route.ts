import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

async function getBotToken(): Promise<string | null> {
  const rows = await db.select().from(settings);
  for (const row of rows) {
    if (row.key === "telegram_bot_token") {
      const val = typeof row.value === "string" ? row.value : String(row.value ?? "");
      return val.replace(/^"|"$/g, "") || null;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getBotToken();
  if (!token) {
    return NextResponse.json({ error: "Bot token not configured." }, { status: 400 });
  }

  // Determine webhook URL from request host or body
  const body = await request.json().catch(() => ({}));
  const host = body.host || request.headers.get("origin") || request.headers.get("host");
  const webhookUrl = `${host}/api/telegram`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getBotToken();
  if (!token) {
    return NextResponse.json({ error: "Bot token not configured." }, { status: 400 });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = await res.json();
  return NextResponse.json(data);
}
