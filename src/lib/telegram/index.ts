import { db } from "@/lib/db";
import { telegramUsers, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  token?: string,
): Promise<boolean> {
  const botToken = token || (await getBotToken());
  if (!botToken) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[telegram] sendMessage failed:", err.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
    return false;
  }
}

/**
 * Send a notification to all acknowledged Telegram users with the matching preference.
 * @param type "orders" | "requests"
 * @param message Markdown-formatted text
 */
export async function notifyTelegram(
  type: "orders" | "requests",
  message: string,
): Promise<void> {
  const botToken = await getBotToken();
  if (!botToken) return;

  const column = type === "orders" ? telegramUsers.notifyOrders : telegramUsers.notifyRequests;
  const users = await db
    .select()
    .from(telegramUsers)
    .where(and(eq(telegramUsers.acknowledged, true), eq(column, true)));

  for (const user of users) {
    await sendTelegramMessage(user.chatId, message, botToken);
  }
}
