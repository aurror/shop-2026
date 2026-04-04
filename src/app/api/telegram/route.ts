import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { telegramUsers, settings, orders, contactRequests, pageViews } from "@/lib/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { sendTelegramMessage } from "@/lib/telegram";
import { getAiConfig } from "@/app/api/admin/ai/optimize/route";
import OpenAI from "openai";

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

// Pre-built commands
async function handleCommand(chatId: string, command: string, token: string): Promise<void> {
  const cmd = command.split("@")[0]; // strip bot username for group chats

  if (cmd === "/start") {
    const existing = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId));
    if (existing.length === 0) {
      await db.insert(telegramUsers).values({
        chatId,
        username: "",
        firstName: "",
        isGroup: false,
        acknowledged: false,
      });
      await sendTelegramMessage(chatId,
        "👋 Willkommen bei *3DPrintIt Bot*!\n\n" +
        "Ihr Account muss zuerst im Admin-Dashboard bestätigt werden. " +
        "Bitte warten Sie auf die Freischaltung.", token);
    } else if (!existing[0].acknowledged) {
      await sendTelegramMessage(chatId, "⏳ Ihr Account wartet noch auf Freischaltung im Admin-Dashboard.", token);
    } else {
      await sendTelegramMessage(chatId, "✅ Sie sind bereits verbunden. Nutzen Sie /help für verfügbare Befehle.", token);
    }
    return;
  }

  // Check if user is acknowledged
  const [user] = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId));
  if (!user || !user.acknowledged) {
    await sendTelegramMessage(chatId, "⏳ Ihr Account ist noch nicht freigeschaltet.", token);
    return;
  }

  if (cmd === "/help") {
    await sendTelegramMessage(chatId,
      "*Verfügbare Befehle:*\n\n" +
      "/open\\_orders — Offene Bestellungen\n" +
      "/today — Heutige Zusammenfassung\n" +
      "/latest\\_order — Letzte Bestellung\n" +
      "/visitors — Besucher heute\n" +
      "/requests — Neue Kontaktanfragen\n" +
      "/help — Diese Hilfe\n\n" +
      "Oder stellen Sie eine Frage in natürlicher Sprache!", token);
    return;
  }

  if (cmd === "/open_orders") {
    const openOrders = await db
      .select({ id: orders.id, orderNumber: orders.orderNumber, total: orders.total, status: orders.status, createdAt: orders.createdAt })
      .from(orders)
      .where(sql`${orders.status} NOT IN ('delivered', 'cancelled')`)
      .orderBy(desc(orders.createdAt))
      .limit(10);

    if (openOrders.length === 0) {
      await sendTelegramMessage(chatId, "✅ Keine offenen Bestellungen.", token);
    } else {
      const lines = openOrders.map((o) =>
        `• *${o.orderNumber}* — ${o.total}€ — _${o.status}_`
      );
      await sendTelegramMessage(chatId, `📦 *${openOrders.length} offene Bestellungen:*\n\n${lines.join("\n")}`, token);
    }
    return;
  }

  if (cmd === "/latest_order") {
    const [latest] = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(1);

    if (!latest) {
      await sendTelegramMessage(chatId, "Keine Bestellungen vorhanden.", token);
    } else {
      await sendTelegramMessage(chatId,
        `📦 *Letzte Bestellung: ${latest.orderNumber}*\n` +
        `Status: _${latest.status}_\n` +
        `Betrag: ${latest.total}€\n` +
        `Datum: ${new Date(latest.createdAt).toLocaleDateString("de-DE")}`, token);
    }
    return;
  }

  if (cmd === "/visitors") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [result] = await db
      .select({ count: sql<number>`count(DISTINCT ${pageViews.sessionId})` })
      .from(pageViews)
      .where(gte(pageViews.createdAt, today));
    await sendTelegramMessage(chatId, `👥 *Besucher heute:* ${result?.count ?? 0}`, token);
    return;
  }

  if (cmd === "/requests") {
    const reqs = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.status, "new"))
      .orderBy(desc(contactRequests.createdAt))
      .limit(5);

    if (reqs.length === 0) {
      await sendTelegramMessage(chatId, "✅ Keine neuen Anfragen.", token);
    } else {
      const lines = reqs.map((r) =>
        `• *${r.name}* (${r.email}): ${r.message.slice(0, 60)}…`
      );
      await sendTelegramMessage(chatId, `📩 *${reqs.length} neue Anfragen:*\n\n${lines.join("\n")}`, token);
    }
    return;
  }

  if (cmd === "/today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [orderCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(gte(orders.createdAt, today));
    const [visitorCount] = await db
      .select({ count: sql<number>`count(DISTINCT ${pageViews.sessionId})` })
      .from(pageViews)
      .where(gte(pageViews.createdAt, today));
    const [requestCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contactRequests)
      .where(and(eq(contactRequests.status, "new"), gte(contactRequests.createdAt, today)));

    await sendTelegramMessage(chatId,
      `📊 *Zusammenfassung heute:*\n\n` +
      `📦 Neue Bestellungen: ${orderCount?.count ?? 0}\n` +
      `👥 Besucher: ${visitorCount?.count ?? 0}\n` +
      `📩 Neue Anfragen: ${requestCount?.count ?? 0}`, token);
    return;
  }

  // Not a known command — treat as natural language question
  await handleNaturalLanguage(chatId, command, token);
}

async function handleNaturalLanguage(chatId: string, question: string, token: string): Promise<void> {
  try {
    const config = await getAiConfig();
    if (!config.apiKey) {
      await sendTelegramMessage(chatId, "⚠️ KI ist nicht konfiguriert. Nutzen Sie /help für verfügbare Befehle.", token);
      return;
    }

    // Gather context data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [openOrders, recentOrders, newRequests, visitorCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(orders).where(sql`${orders.status} NOT IN ('delivered', 'cancelled')`),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5),
      db.select({ count: sql<number>`count(*)` }).from(contactRequests).where(eq(contactRequests.status, "new")),
      db.select({ count: sql<number>`count(DISTINCT ${pageViews.sessionId})` }).from(pageViews).where(gte(pageViews.createdAt, today)),
    ]);

    const context = `
Aktuelle Shop-Daten:
- Offene Bestellungen: ${openOrders[0]?.count ?? 0}
- Neue Kontaktanfragen: ${newRequests[0]?.count ?? 0}
- Besucher heute: ${visitorCount[0]?.count ?? 0}
- Letzte 5 Bestellungen: ${recentOrders.map(o => `${o.orderNumber} (${o.status}, ${o.total}€, ${new Date(o.createdAt).toLocaleDateString("de-DE")})`).join("; ")}
    `.trim();

    const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "Du bist der 3DPrintIt Shop-Assistent im Telegram. Beantworte Fragen zum Shop kurz und hilfreich auf Deutsch. " +
            "Du hast Zugriff auf folgende aktuelle Daten:\n\n" + context +
            "\n\nAntworte in Markdown-Format (Telegram-kompatibel). Halte dich kurz.",
        },
        { role: "user", content: question },
      ],
      temperature: 0.4,
      max_tokens: 500,
      // @ts-expect-error — Qwen3 thinking model
      chat_template_kwargs: { enable_thinking: false },
    });

    const answer = (response.choices[0]?.message as any)?.content || "Ich konnte die Frage leider nicht beantworten. Versuchen Sie /help.";
    await sendTelegramMessage(chatId, answer, token);
  } catch (err) {
    console.error("[telegram LLM]", err);
    await sendTelegramMessage(chatId, "⚠️ Fehler bei der Verarbeitung. Versuchen Sie /help für Befehle.", token);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getBotToken();
    if (!token) {
      return NextResponse.json({ ok: true }); // silently ignore if no token
    }

    const update = await request.json();

    // Handle message (works for both private and group chats)
    const message = update.message || update.channel_post;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = (message.text || "").trim();
    const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";

    // Update user info
    const fromUser = message.from;
    if (fromUser) {
      const existing = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId));
      if (existing.length > 0) {
        // Update name/username
        await db.update(telegramUsers).set({
          username: fromUser.username || existing[0].username,
          firstName: fromUser.first_name || existing[0].firstName,
          isGroup,
        }).where(eq(telegramUsers.chatId, chatId));
      }
    }

    if (!text) return NextResponse.json({ ok: true });

    if (text.startsWith("/")) {
      await handleCommand(chatId, text, token);
    } else {
      // In group chats, only respond if the bot is mentioned or if user is acknowledged
      const [user] = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId));
      if (!user || !user.acknowledged) {
        if (text === "/start") {
          await handleCommand(chatId, "/start", token);
        }
        return NextResponse.json({ ok: true });
      }
      // Natural language question
      await handleNaturalLanguage(chatId, text, token);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram webhook]", err);
    return NextResponse.json({ ok: true }); // always return 200 to avoid Telegram retries
  }
}
