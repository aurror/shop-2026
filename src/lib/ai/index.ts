import OpenAI from "openai";
import { db } from "@/lib/db";
import { products, productRelationSuggestions } from "@/lib/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { getAiConfig } from "@/lib/ai/config";

export async function getRelatedProductSuggestions(
  productId: string
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const config = await getAiConfig();

    if (!config.apiKey) {
      return { success: false, message: "AI API key not configured", count: 0 };
    }

    const client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });

    // Get the target product
    const targetProduct = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!targetProduct.length) {
      return { success: false, message: "Product not found", count: 0 };
    }

    // Get all other active products
    const otherProducts = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        basePrice: products.basePrice,
      })
      .from(products)
      .where(and(ne(products.id, productId), eq(products.active, true)));

    if (!otherProducts.length) {
      return { success: false, message: "No other products available", count: 0 };
    }

    const target = targetProduct[0];
    const catalogText = otherProducts
      .map((p) => `- ID: ${p.id} | Name: ${p.name} | Description: ${p.description || "N/A"} | Price: ${p.basePrice}€`)
      .join("\n");

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: `You are a product recommendation engine for "3DPrintIt", an online shop for model railway (Modelleisenbahn) and 3D printed parts. Your task is to identify products that are closely related to a given product — items that complement it, are accessories for it, or are commonly purchased together. Respond ONLY with a valid JSON array.${config.relatedInstructions ? " " + config.relatedInstructions : ""}`,
        },
        {
          role: "user",
          content: `Target product:
- Name: ${target.name}
- Description: ${target.description || "N/A"}
- Price: ${target.basePrice}€

Available products in the catalog:
${catalogText}

Based on the target product, identify which products from the catalog would be closely related, complementary, or commonly bought together. Consider:
1. Products that are accessories or add-ons
2. Products in the same scale/gauge (H0, N, TT, etc.)
3. Products that complete a set or scene
4. Products with compatible specifications

Return JSON array:
[{"productId": "uuid", "confidence": 0.0-1.0, "reasoning": "brief explanation"}]

Only include products with confidence >= 0.5. Maximum 10 suggestions.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      // Disable chain-of-thought thinking for Qwen3 thinking models
      // @ts-expect-error — provider-specific extension not in types
      chat_template_kwargs: { enable_thinking: false },
    });

    const rawContent = response.choices[0]?.message?.content ?? "";
    const content = rawContent || "[]";

    // Parse JSON from the response
    let suggestions: Array<{
      productId: string;
      confidence: number;
      reasoning: string;
    }>;

    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error("[AI] Failed to parse response:", content);
      return { success: false, message: "Failed to parse AI response", count: 0 };
    }

    // Validate product IDs exist
    const validProductIds = new Set(otherProducts.map((p) => p.id));
    suggestions = suggestions.filter((s) => validProductIds.has(s.productId));

    // Store suggestions in DB
    let inserted = 0;
    for (const suggestion of suggestions) {
      try {
        await db.insert(productRelationSuggestions).values({
          productId,
          suggestedProductId: suggestion.productId,
          confidence: String(suggestion.confidence),
          reasoning: suggestion.reasoning,
          status: "pending",
        });
        inserted++;
      } catch (err) {
        // Might be duplicate, skip
        console.log("[AI] Skipping duplicate suggestion:", err);
      }
    }

    return {
      success: true,
      message: `Generated ${inserted} suggestions`,
      count: inserted,
    };
  } catch (error) {
    console.error("[AI] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      count: 0,
    };
  }
}
