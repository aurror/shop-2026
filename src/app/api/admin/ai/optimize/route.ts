import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import OpenAI from "openai";

export async function getAiConfig() {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.value !== null && row.value !== undefined) {
      map[row.key] = String(row.value);
    }
  }
  return {
    baseURL: map.ai_base_url || process.env.AI_BASE_URL || "https://chat-ai.academiccloud.de/v1",
    apiKey: map.ai_api_key || process.env.AI_API_KEY || "",
    model: map.ai_model || process.env.AI_MODEL || "qwen3.5-397b-a17b",
    // Global style settings
    writingStyle: map.ai_writing_style || "professional",
    noEmojis: map.ai_no_emojis === "true",
    language: map.ai_language || "Deutsch",
    customInstructions: map.ai_custom_instructions || "",
    // Per-feature instructions
    titleInstructions: map.ai_title_instructions || "",
    descriptionInstructions: map.ai_description_instructions || "",
    relatedInstructions: map.ai_related_instructions || "",
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildStyleBlock(config: Awaited<ReturnType<typeof getAiConfig>>, extra?: string): string {
  return [
    `Schreibe auf ${config.language}.`,
    config.writingStyle === "professional" && "Schreibe professionell und sachlich.",
    config.writingStyle === "friendly" && "Schreibe freundlich und einladend.",
    config.writingStyle === "technical" && "Schreibe technisch präzise und detailliert.",
    config.writingStyle === "concise" && "Schreibe knapp und prägnant.",
    config.noEmojis && "Verwende keine Emojis.",
    config.customInstructions,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

async function callAI(
  client: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: 2000,
    // Disable chain-of-thought thinking for Qwen3 thinking models
    // so the actual output appears in message.content
    // @ts-expect-error — provider-specific extension not in types
    chat_template_kwargs: { enable_thinking: false },
  });

  const msg = response.choices[0]?.message;
  const content = msg?.content ?? "";
  if (!content) {
    throw new Error("AI returned empty content. Check model configuration.");
  }
  return content;
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
      return NextResponse.json(
        { error: "Kein AI API-Key konfiguriert. Bitte in Einstellungen → KI eintragen." },
        { status: 422 },
      );
    }

    const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    const plainDescription = descriptionHtml ? stripHtml(descriptionHtml) : "";

    let rawContent = "";

    if (mode === "title") {
      const style = buildStyleBlock(config, config.titleInstructions);
      const system = `Du bist ein professioneller Produkttexter für "3DPrintIt", ein Online-Shop für Modelleisenbahn-Zubehör und 3D-gedruckte Teile. ${style} Antworte ausschließlich mit validem JSON-Objekt, ohne Kommentare.`;
      const user = `Verbessere diesen Produkttitel — mache ihn präziser, ansprechender und kauffördernd:\n"${name}"\n\nAntworte mit: {"name": "verbesserter Titel"}`;
      rawContent = await callAI(client, config.model, system, user);
    } else if (mode === "description") {
      const style = buildStyleBlock(config, config.descriptionInstructions);
      const system = `Du bist ein professioneller Produkttexter für "3DPrintIt", ein Online-Shop für Modelleisenbahn-Zubehör und 3D-gedruckte Teile. ${style} Behalte alle technischen Details. Antworte ausschließlich mit validem JSON-Objekt, ohne Kommentare.`;
      const context = name ? `Produktname: "${name}"\n` : "";
      const user = `${context}Verbessere diese Produktbeschreibung (gib HTML zurück, nutze passend h2/h3/ul/p für Struktur):\n"${plainDescription || "(keine Beschreibung vorhanden — erstelle eine passende auf Basis des Produktnamens)"}"\n\nAntworte mit: {"descriptionHtml": "<p>...</p>"}`;
      rawContent = await callAI(client, config.model, system, user);
    } else {
      // both
      const style = buildStyleBlock(config, [config.titleInstructions, config.descriptionInstructions].filter(Boolean).join(" "));
      const system = `Du bist ein professioneller Produkttexter für "3DPrintIt", ein Online-Shop für Modelleisenbahn-Zubehör und 3D-gedruckte Teile. ${style} Antworte ausschließlich mit validem JSON-Objekt, ohne Kommentare.`;
      const user = `Verbessere Titel und Beschreibung:\nTitel: "${name}"\nBeschreibung: "${plainDescription}"\n\nAntworte mit: {"name": "verbesserter Titel", "descriptionHtml": "<p>...</p>"}`;
      rawContent = await callAI(client, config.model, system, user);
    }

    // Extract JSON from the response (model may wrap it in markdown)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI optimize] No JSON found in:", rawContent);
      return NextResponse.json({ error: "KI hat kein gültiges JSON zurückgegeben." }, { status: 502 });
    }

    let result: Record<string, string>;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht geparst werden." }, { status: 502 });
    }

    return NextResponse.json({
      name: result.name ?? undefined,
      descriptionHtml: result.descriptionHtml ?? undefined,
    });
  } catch (error) {
    console.error("[AI optimize]", error);
    const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
