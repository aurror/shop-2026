import { z } from "zod";
import { createHash } from "crypto";

// ─── Rate Limiting ──────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60000
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

// ─── Input Sanitization ─────────────────────────────────────────────────────

export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function sanitizeForDisplay(input: string): string {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

// ─── IP Anonymization (GDPR) ───────────────────────────────────────────────

export function anonymizeIp(ip: string): string {
  return createHash("sha256").update(ip + "3dprintit-salt").digest("hex").slice(0, 16);
}

// ─── Common Zod Schemas ────────────────────────────────────────────────────

export const emailSchema = z.string().email("Ungültige E-Mail-Adresse");
export const passwordSchema = z
  .string()
  .min(8, "Mindestens 8 Zeichen")
  .max(128, "Maximal 128 Zeichen");

export const addressSchema = z.object({
  firstName: z.string().min(1, "Vorname erforderlich").max(100),
  lastName: z.string().min(1, "Nachname erforderlich").max(100),
  company: z.string().max(200).optional(),
  street: z.string().min(1, "Straße erforderlich").max(200),
  streetNumber: z.string().min(1, "Hausnummer erforderlich").max(20),
  addressExtra: z.string().max(200).optional(),
  zip: z.string().min(4, "PLZ erforderlich").max(10),
  city: z.string().min(1, "Stadt erforderlich").max(100),
  country: z.string().default("DE"),
});

export const productSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().optional(),
  descriptionHtml: z.string().optional(),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  compareAtPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  weight: z.string().optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  taxRate: z.string().optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
});

export const variantSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(100),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  weight: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.string()).optional(),
  images: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const discountSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.string().regex(/^\d+(\.\d{1,2})?$/),
  minOrderAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  maxUses: z.number().int().min(1).optional().nullable(),
  productIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

// ─── CSRF Token Generation ──────────────────────────────────────────────────

export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Order Number Generation ────────────────────────────────────────────────

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `3DP-${y}${m}${d}-${rand}`;
}

// ─── Price Formatting ───────────────────────────────────────────────────────

export function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

export function formatDate(date: Date | string, locale: string = "de-DE"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ─── Slug Generation ────────────────────────────────────────────────────────

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
