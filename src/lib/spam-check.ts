import { db } from "@/lib/db";
import { contactRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getAiConfig } from "@/app/api/admin/ai/optimize/route";
import OpenAI from "openai";

export async function checkSpam(
  requestId: string,
  name: string,
  email: string,
  message: string,
): Promise<void> {
  try {
    const config = await getAiConfig();
    if (!config.apiKey) return; // No AI configured, skip

    const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein Spam/Scam-Erkennungssystem für einen Online-Shop. Bewerte die folgende Kontaktanfrage. " +
            "Antworte NUR mit einem JSON-Objekt: {\"score\": 0-100, \"reason\": \"kurze Begründung\"}. " +
            "Score 0 = definitiv kein Spam. Score 100 = definitiv Spam/Scam/Phishing. " +
            "Achte besonders auf: Phishing-Links, verdächtige URLs, unrealistische Angebote, " +
            "typische Spam-Muster, Betrugsversuche, fehlender Bezug zum Shop-Thema (3D-Druck, Modelleisenbahn).",
        },
        {
          role: "user",
          content: `Name: ${name}\nE-Mail: ${email}\nNachricht:\n${message}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      // @ts-expect-error — Qwen3 thinking model needs this
      chat_template_kwargs: { enable_thinking: false },
    });

    const content = (response.choices[0]?.message as any)?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return;

    try {
      const result = JSON.parse(match[0]);
      const score = typeof result.score === "number" ? result.score : null;
      const reason = typeof result.reason === "string" ? result.reason : null;

      if (score !== null) {
        await db
          .update(contactRequests)
          .set({
            spamScore: score,
            spamReason: reason,
            status: score >= 80 ? "spam" : undefined,
          })
          .where(eq(contactRequests.id, requestId));
      }
    } catch {
      // JSON parse failed, skip
    }
  } catch (err) {
    console.error("[spam-check] AI error:", err);
  }
}
