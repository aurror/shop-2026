import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  telegramUsers,
  settings,
  orders,
  contactRequests,
  pageViews,
  products,
  productVariants,
} from "@/lib/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { sendTelegramMessage } from "@/lib/telegram";
import { getAiConfig } from "@/app/api/admin/ai/optimize/route";
import { getHistory, pushMessage, resetHistory } from "@/lib/telegram/conversation";
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
      "/reset — Konversation zurücksetzen\n" +
      "/help — Diese Hilfe\n\n" +
      "Oder stellen Sie eine Frage in natürlicher Sprache — " +
      "der Bot merkt sich den Kontext des Gesprächs (wird nach 2 h Inaktivität zurückgesetzt).", token);
    return;
  }

  if (cmd === "/reset") {
    resetHistory(chatId);
    await sendTelegramMessage(chatId, "🔄 Konversation zurückgesetzt.", token);
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

/** Build a live data snapshot for the system prompt. */
async function gatherShopContext(): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [openOrderRows, recentOrders, newRequests, visitorCount, lowStockVariants] = await Promise.all([
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.status} NOT IN ('delivered', 'cancelled')`),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5),
    db.select({ count: sql<number>`count(*)` })
      .from(contactRequests)
      .where(eq(contactRequests.status, "new")),
    db.select({ count: sql<number>`count(DISTINCT ${pageViews.sessionId})` })
      .from(pageViews)
      .where(gte(pageViews.createdAt, today)),
    db.select({
      productName: products.name,
      variantName: productVariants.name,
      sku: productVariants.sku,
      stock: productVariants.stock,
    })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(sql`${productVariants.stock} <= ${productVariants.lowStockThreshold} AND ${productVariants.active} = true`)
      .limit(10),
  ]);

  const lines = [
    `Offene Bestellungen: ${openOrderRows[0]?.count ?? 0}`,
    `Neue Kontaktanfragen: ${newRequests[0]?.count ?? 0}`,
    `Besucher heute: ${visitorCount[0]?.count ?? 0}`,
    "",
    "Letzte 5 Bestellungen:",
    ...recentOrders.map(
      (o) =>
        `  • ${o.orderNumber} — ${o.status} — ${o.total}€ — ${new Date(o.createdAt).toLocaleDateString("de-DE")}`,
    ),
  ];

  if (lowStockVariants.length > 0) {
    lines.push("", "Varianten mit niedrigem Bestand:");
    for (const v of lowStockVariants) {
      lines.push(`  ⚠ ${v.productName} – ${v.variantName} (${v.sku}): ${v.stock} Stück`);
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT_PREFIX =
  "Du bist der interne Assistent des *3DPrintIt*-Shops — ein deutsches E-Commerce-Unternehmen für " +
  "Modelleisenbahn-Zubehör und 3D-gedruckte Teile. " +
  "Du sprichst ausschließlich mit dem Shopbetreiber oder Mitarbeitern (niemals mit Endkunden). " +
  "Dein Gesprächspartner ist also immer ein Teammitglied, das den Shop betreibt.\n\n" +
  "Deine Aufgaben:\n" +
  "• Fragen zu Bestellungen, Lagerbestand, Kunden und Shop-Kennzahlen beantworten\n" +
  "• Bei operativen Entscheidungen helfen (z. B. Versand, Retouren, Preisstrategie)\n" +
  "• Zusammenfassungen und Analysen liefern\n" +
  "• Proaktiv auf Probleme hinweisen (niedriger Bestand, offene Anfragen)\n\n" +
  "Regeln:\n" +
  "• Antworte immer auf Deutsch, kurz und sachlich.\n" +
  "• Verwende Telegram-kompatibles Markdown.\n" +
  "• Behandle den Gesprächspartner nie als Kunden — er/sie ist dein Kollege bzw. Chef.\n" +
  "• Wenn du eine Frage nicht beantworten kannst, sag das ehrlich.\n\n";

async function handleNaturalLanguage(chatId: string, question: string, token: string): Promise<void> {
  try {
    const config = await getAiConfig();
    if (!config.apiKey) {
      await sendTelegramMessage(chatId, "⚠️ KI ist nicht konfiguriert. Nutzen Sie /help für verfügbare Befehle.", token);
      return;
    }

    const context = await gatherShopContext();
    const systemContent = SYSTEM_PROMPT_PREFIX + "Aktuelle Shop-Daten:\n" + context;

    // Get / initialise conversation history for this chat
    const history = getHistory(chatId);

    // If the history is empty (fresh or after reset), inject the system prompt
    if (history.length === 0) {
      pushMessage(chatId, { role: "system", content: systemContent });
    } else {
      // Update the system message with fresh data every turn
      history[0] = { role: "system", content: systemContent };
    }

    // Append the new user message
    pushMessage(chatId, { role: "user", content: question });

    const client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [...history],
      temperature: 0.4,
      max_tokens: 800,
      // @ts-expect-error — Qwen3 thinking model
      chat_template_kwargs: { enable_thinking: false },
    });

    const answer =
      (response.choices[0]?.message as any)?.content ||
      "Ich konnte die Frage leider nicht beantworten. Versuche /help.";

    // Store assistant reply in history
    pushMessage(chatId, { role: "assistant", content: answer });

    await sendTelegramMessage(chatId, answer, token);
  } catch (err) {
    console.error("[telegram LLM]", err);
    await sendTelegramMessage(chatId, "⚠️ Fehler bei der Verarbeitung. Versuche /help für Befehle.", token);
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
    const fromUser = message.from;
    const senderChatId = fromUser ? String(fromUser.id) : null;

    // --- Registration / update ---
    // For group chats: register/update using the GROUP chatId
    // For private chats: register/update using the personal chatId
    if (fromUser) {
      const existing = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId));
      if (existing.length > 0) {
        await db.update(telegramUsers).set({
          username: fromUser.username || existing[0].username,
          firstName: fromUser.first_name || existing[0].firstName,
          isGroup,
        }).where(eq(telegramUsers.chatId, chatId));
      }
    }

    if (!text) return NextResponse.json({ ok: true });

    // --- Authorization check ---
    // A chat is authorized if:
    //   1. The chatId itself is in telegramUsers with acknowledged = true, OR
    //   2. (Group chats only) the individual sender's personal chatId is acknowledged
    async function isAuthorized(): Promise<boolean> {
      const [record] = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, chatId));
      if (record?.acknowledged) return true;
      if (isGroup && senderChatId) {
        const [senderRecord] = await db.select().from(telegramUsers).where(eq(telegramUsers.chatId, senderChatId));
        if (senderRecord?.acknowledged) {
          // Auto-acknowledge the group chat since a trusted member is in it
          if (!record) {
            await db.insert(telegramUsers).values({
              chatId,
              username: message.chat.username || "",
              firstName: message.chat.title || message.chat.first_name || "Gruppe",
              isGroup: true,
              acknowledged: true,
              notifyOrders: senderRecord.notifyOrders,
              notifyRequests: senderRecord.notifyRequests,
            });
          } else {
            await db.update(telegramUsers)
              .set({ acknowledged: true })
              .where(eq(telegramUsers.chatId, chatId));
          }
          return true;
        }
      }
      return false;
    }

    if (text.startsWith("/")) {
      const cmd = text.split("@")[0].split(" ")[0];
      if (cmd !== "/start") {
        // For non-/start commands, run isAuthorized() first so group chats
        // get auto-acknowledged via the sender's personal chatId before
        // handleCommand looks up the group chatId.
        const authorized = await isAuthorized();
        if (!authorized) {
          return NextResponse.json({ ok: true });
        }
      }
      await handleCommand(chatId, text, token);
    } else {
      const authorized = await isAuthorized();
      if (!authorized) {
        return NextResponse.json({ ok: true });
      }
      await handleNaturalLanguage(chatId, text, token);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram webhook]", err);
    return NextResponse.json({ ok: true }); // always return 200 to avoid Telegram retries
  }
}
