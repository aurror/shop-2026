import { NextRequest, NextResponse } from "next/server";
import { anonymizeIp } from "@/lib/security";
import { db } from "@/lib/db";
import { pageViews } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, referrer, userAgent, ip } = body;

    if (!path) {
      return NextResponse.json({ ok: true });
    }

    await db.insert(pageViews).values({
      path,
      referrer: referrer || null,
      userAgent: userAgent?.substring(0, 500) || null,
      ipHash: ip ? anonymizeIp(ip) : null,
      sessionId: null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
