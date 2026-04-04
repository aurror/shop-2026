/**
 * In-memory conversation store for Telegram bot.
 *
 * - Per-chat message history (OpenAI chat format)
 * - 2 h inactivity auto-reset
 * - ~256 k token budget (~900 k chars at ~3.5 chars/token, conservative)
 *
 * Uses a globalThis cache so state survives Next.js hot-reloads in dev.
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const MAX_CHARS = 900_000; // ≈ 256k tokens
const INACTIVITY_MS = 2 * 60 * 60 * 1000; // 2 hours

interface ChatState {
  messages: ChatCompletionMessageParam[];
  lastActivity: number; // epoch ms
}

// Survive Next.js hot-reloads in dev
const g = globalThis as unknown as { __telegramConversations?: Map<string, ChatState> };
if (!g.__telegramConversations) {
  g.__telegramConversations = new Map();
}
const store = g.__telegramConversations;

function charCount(messages: ChatCompletionMessageParam[]): number {
  let total = 0;
  for (const m of messages) {
    if (typeof m.content === "string") {
      total += m.content.length;
    }
  }
  return total;
}

/** Trim oldest user/assistant turns (keep system) until under budget. */
function trimToFit(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  while (charCount(messages) > MAX_CHARS && messages.length > 1) {
    // Find the first non-system message and remove it
    const idx = messages.findIndex((m) => m.role !== "system");
    if (idx === -1) break;
    messages.splice(idx, 1);
  }
  return messages;
}

/**
 * Get the message history for a chat, auto-resetting after 2 h of inactivity.
 * Returns a mutable reference — push new messages directly.
 */
export function getHistory(chatId: string): ChatCompletionMessageParam[] {
  const now = Date.now();
  const state = store.get(chatId);

  if (!state || now - state.lastActivity > INACTIVITY_MS) {
    // Reset — fresh conversation
    const fresh: ChatState = { messages: [], lastActivity: now };
    store.set(chatId, fresh);
    return fresh.messages;
  }

  state.lastActivity = now;
  return state.messages;
}

/** Append a message and enforce the token budget. */
export function pushMessage(chatId: string, msg: ChatCompletionMessageParam): void {
  const state = store.get(chatId);
  if (!state) return;
  state.messages.push(msg);
  state.lastActivity = Date.now();
  trimToFit(state.messages);
}

/** Fully reset a chat (e.g. via a /reset command). */
export function resetHistory(chatId: string): void {
  store.delete(chatId);
}
