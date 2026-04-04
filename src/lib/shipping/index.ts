import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface ShippingFeeConfig {
  baseFee: number;
  perKg: number;
  freeThresholdEnabled: boolean;
  freeThreshold: number;
}

export async function getShippingConfig(): Promise<ShippingFeeConfig> {
  const rows = await db.select().from(settings);
  const settingsMap: Record<string, unknown> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }

  return {
    baseFee: parseFloat(String(settingsMap.shipping_base_fee || "4.99")),
    perKg: parseFloat(String(settingsMap.shipping_per_kg || "1.50")),
    freeThresholdEnabled: settingsMap.shipping_free_threshold_enabled === true,
    freeThreshold: parseFloat(
      String(settingsMap.shipping_free_threshold || "50.00")
    ),
  };
}

export function calculateShippingFee(
  config: ShippingFeeConfig,
  orderSubtotal: number,
  totalWeightKg: number
): number {
  // Check if free shipping applies
  if (config.freeThresholdEnabled && orderSubtotal >= config.freeThreshold) {
    return 0;
  }

  const fee = config.baseFee + totalWeightKg * config.perKg;
  return Math.round(fee * 100) / 100;
}

export function getDhlTrackingUrl(trackingNumber: string): string {
  return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(trackingNumber)}`;
}

export async function updateSetting(
  key: string,
  value: unknown
): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as Record<string, unknown>, updatedAt: new Date() },
    });
}

export async function getSetting(key: string): Promise<unknown> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return result.length ? result[0].value : null;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}
