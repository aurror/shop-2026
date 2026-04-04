import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import OpenAI from "openai";

async function getAiConfig() {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = String(row.value ?? "");
  }
  return {
    baseURL: map.ai_base_url || process.env.AI_BASE_URL || "https://chat-ai.academiccloud.de/v1",
    apiKey: map.ai_api_key || process.env.AI_API_KEY || "",
    model: map.ai_model || process.env.AI_MODEL || "gpt-4o",
    // Writing style settings
    writingStyle: map.ai_writing_style || "professional",
    noEmojis: map.ai_no_emojis === "true",
    language: map.ai_language || "Deutsch",
    customInstructions: map.ai_custom_instructions || "",
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mode, name, descriptionHtml } = body as {
      mode: "description" | "title" | "both";
      name?: string;
      descriptionHtml?: string;
    };

    if (!mode || !["description", "title", "both"].includes(mode)) {
      return NextResponse.json({ error: "mode must be 'description', 'title', or 'both'" }, { status: 400 });
    }

    const config = await getAiConfig();
    if (!config.apiKey) {
      return NextResponse.json({ error: "AI API key not configured in Settings → KI" }, { status: 422 });
    }

    const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });

    // Build style instructions
    const styleInstructions = [
      `Schreibe auf ${config.language}.`,
      config.writingStyle === "professional" && "Schreibe professionell und sachlich.",
      config.writingStyle === "friendly" && "Schreibe freundlich und einladend.",
      config.writingStyle === "technical" && "Schreibe technisch präzise und detailliert.",
      config.writingStyle === "concise" && "Schreibe knapp und prägnant.",
      config.noEmojis && "Verwende keine Emojis.",
      config.customInstructions && config.customInstructions,
    ]
      .filter(Boolean)
      .join(" ");

    const systemPrompt = `Du bist ein professioneller Produkttexter für "3DPrintIt", ein Online-Shop für Modelleisenbahn-Zubehör und 3D-gedruckte Teile. ${styleInstructions}

Deine Aufgabe ist es, Produkttitel und -beschreibungen zu verbessern: präziser, ansprechender und kauffördernd. Behalte alle technischen Details (Maßstab, Materialien, Abmessungen) bei. Antworie immer mit validem JSON.`;

    const plainDescription = descriptionHtml ? stripHtml(descriptionHtml) : "";

    let userContent = "";
    if (mode === "title") {
      userContent = `Verbessere diesen Produkttitel:\n"${name}"\n\nAntworte mit JSON: { "name": "verbesserter Titel" }`;
    } else if (mode === "description") {
      userContent = `Verbessere diese Produktbeschreibung (gib HTML zurück, nutze h2/h3/ul/p):\n"${plainDescription}"\n\nAntworte mit JSON: { "descriptionHtml": "<p>...</p>" }`;
    } else {
      userContent = `Verbessere diesen Produkttitel und die Beschreibung:
Titel: "${name}"
Beschreibung: "${plainDescription}"

Antworte mit JSON: { "name": "verbesserter Titel", "descriptionHtml": "<p>...</p>" }`;
    }

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.6,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let result: Record<string, string>;
    try {
      result = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({
      name: result.name ?? undefined,
      descriptionHtml: result.descriptionHtml ?? undefined,
    });
  } catch (error) {
    console.error("[AI optimize]", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
