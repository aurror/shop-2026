import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";

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
    writingStyle: map.ai_writing_style || "professional",
    noEmojis: map.ai_no_emojis === "true",
    language: map.ai_language || "Deutsch",
    customInstructions: map.ai_custom_instructions || "",
    titleInstructions: map.ai_title_instructions || "",
    descriptionInstructions: map.ai_description_instructions || "",
    relatedInstructions: map.ai_related_instructions || "",
  };
}
