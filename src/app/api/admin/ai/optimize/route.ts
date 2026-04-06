import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import OpenAI from "openai";
import { getAiConfig } from "@/lib/ai/config";

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

/** Extract text from AI response — falls back to `reasoning` for thinking models */
function extractContent(response: OpenAI.Chat.Completions.ChatCompletion): string {
  const msg = response.choices[0]?.message as any;
  if (!msg) return "";
  // Primary: standard content field (returned when thinking is off)
  if (msg.content && typeof msg.content === "string" && msg.content.trim()) {
    return msg.content.trim();
  }
  // Fallback: reasoning field (returned by Qwen3 thinking models when thinking is not disabled)
  const reasoning: string = typeof msg.reasoning === "string" ? msg.reasoning : "";
  if (reasoning) {
    const fenced = reasoning.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (fenced) return fenced[1];
    const bare = reasoning.match(/\{[^{}]*"(?:name|descriptionHtml)"[^{}]*\}/);
    if (bare) return bare[0];
  }
  return "";
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
    temperature: 0.5,
    max_tokens: 2000,
    // Disable chain-of-thought thinking for Qwen3 thinking models
    // so the actual output appears in message.content rather than message.reasoning
    // @ts-expect-error — provider-specific extension not in types
    chat_template_kwargs: { enable_thinking: false },
  });

  const content = extractContent(response);
  console.log("[AI optimize] raw content (first 300 chars):", content.slice(0, 300));
  if (!content) {
    throw new Error(
      "KI hat keine Antwort zurückgegeben. Überprüfen Sie Modell und API-Key in den Einstellungen.",
    );
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

    // Default behaviour applied even without custom instructions
    const defaultBehaviour =
      "Korrigiere Rechtschreibung und Grammatik. Vervollständige unfertige Sätze sinnvoll. " +
      "Optimiere Struktur und Lesbarkeit. Behalte alle technischen Details und Produktspezifikationen bei.";

    let rawContent = "";

    if (mode === "title") {
      const style = buildStyleBlock(config, config.titleInstructions);
      const system =
        `Du bist ein professioneller Produkttexter für "3DPrintIt", ein Online-Shop für ` +
        `Modelleisenbahn-Zubehör und 3D-gedruckte Teile. ${style} ${defaultBehaviour} ` +
        `Antworte NUR mit einem JSON-Objekt — kein Text davor oder danach, kein Markdown.`;
      const user =
        `Verbessere diesen Produkttitel — mache ihn präziser und ansprechend:\n"${name}"\n\n` +
        `Antworte EXAKT mit diesem JSON (keine weiteren Zeichen):\n{"name": "verbesserter Titel"}`;
      rawContent = await callAI(client, config.model, system, user);
    } else if (mode === "description") {
      const style = buildStyleBlock(config, config.descriptionInstructions);
      const system =
        `Du bist ein professioneller Produkttexter für "3DPrintIt", ein Online-Shop für ` +
        `Modelleisenbahn-Zubehör und 3D-gedruckte Teile. ${style} ${defaultBehaviour} ` +
        `Nutze HTML-Tags (p, h2, h3, ul, li, strong) für gute Struktur. ` +
        `Antworte NUR mit einem JSON-Objekt — kein Text davor oder danach, kein Markdown.`;
      const inputText = plainDescription
        ? `"${plainDescription}"`
        : `(keine Beschreibung — erstelle eine sinnvolle auf Basis des Produktnamens: "${name}")`;
      const user =
        `${name ? `Produktname: "${name}"\n` : ""}` +
        `Verbessere diese Produktbeschreibung:\n${inputText}\n\n` +
        `Antworte EXAKT mit diesem JSON (keine weiteren Zeichen):\n{"descriptionHtml": "<p>...</p>"}`;
      rawContent = await callAI(client, config.model, system, user);
    } else {
      const style = buildStyleBlock(config, [config.titleInstructions, config.descriptionInstructions].filter(Boolean).join(" "));
      const system =
        `Du bist ein professioneller Produkttexter für "3DPrintIt", ein Online-Shop für ` +
        `Modelleisenbahn-Zubehör und 3D-gedruckte Teile. ${style} ${defaultBehaviour} ` +
        `Nutze HTML-Tags für die Beschreibung. ` +
        `Antworte NUR mit einem JSON-Objekt — kein Text davor oder danach, kein Markdown.`;
      const user =
        `Verbessere Titel und Beschreibung:\nTitel: "${name}"\nBeschreibung: "${plainDescription}"\n\n` +
        `Antworte EXAKT mit diesem JSON (keine weiteren Zeichen):\n{"name": "verbesserter Titel", "descriptionHtml": "<p>...</p>"}`;
      rawContent = await callAI(client, config.model, system, user);
    }

    // Parse JSON from the response (model may wrap it in markdown fences)
    const cleaned = rawContent.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    let result: Record<string, string> | null = null;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { result = JSON.parse(jsonMatch[0]); } catch { /* continue */ }
      }
    }

    if (!result) {
      console.error("[AI optimize] No JSON found in:", rawContent.slice(0, 300));
      return NextResponse.json(
        { error: `KI hat kein gültiges JSON zurückgegeben. Rohantwort: "${rawContent.slice(0, 80)}"` },
        { status: 502 },
      );
    }

    // Validate expected fields are present
    if (mode === "title" && !result.name) {
      return NextResponse.json(
        { error: `KI hat keinen "name"-Schlüssel zurückgegeben. Antwort: "${rawContent.slice(0, 80)}"` },
        { status: 502 },
      );
    }
    if (mode === "description" && !result.descriptionHtml) {
      return NextResponse.json(
        { error: `KI hat keinen "descriptionHtml"-Schlüssel zurückgegeben. Antwort: "${rawContent.slice(0, 80)}"` },
        { status: 502 },
      );
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
