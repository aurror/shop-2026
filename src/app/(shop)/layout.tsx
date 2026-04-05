import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartItems, settings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { Header } from "@/components/shop/Header";
import { Footer } from "@/components/shop/Footer";
import { CookieBanner } from "@/components/shop/CookieBanner";
import { CartProvider } from "@/components/shop/CartContext";

export const metadata: Metadata = {
  title: {
    default: "3DPrintIt – Modelleisenbahn & 3D-Druck",
    template: "%s | 3DPrintIt",
  },
  description:
    "Ihr Spezialist für hochwertige Modelleisenbahn-Zubehörteile aus dem 3D-Drucker. Präzise Modelle, schneller Versand.",
};

async function getCartCount(userId: string | undefined): Promise<number> {
  if (!userId) return 0;
  try {
    const result = await db
      .select({ count: sql<number>`coalesce(sum(${cartItems.quantity}), 0)` })
      .from(cartItems)
      .where(eq(cartItems.userId, userId));
    return Number(result[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

async function getShopSettings(): Promise<{ shopEnabled: boolean; orderingEnabled: boolean; maintenanceMessage: string; orderingDisabledMessage: string }> {
  try {
    const rows = await db.select().from(settings).where(
      sql`${settings.key} IN ('shop_enabled', 'ordering_enabled', 'maintenance_message', 'ordering_disabled_message')`
    );
    const map: Record<string, unknown> = {};
    for (const row of rows) map[row.key] = row.value;
    return {
      shopEnabled: map.shop_enabled !== false && map.shop_enabled !== "false",
      orderingEnabled: map.ordering_enabled !== false && map.ordering_enabled !== "false",
      maintenanceMessage: String(map.maintenance_message || "Der Shop ist vorübergehend geschlossen. Wir sind bald wieder zurück!"),
      orderingDisabledMessage: String(map.ordering_disabled_message || "Bestellungen sind vorübergehend deaktiviert."),
    };
  } catch {
    return { shopEnabled: true, orderingEnabled: true, maintenanceMessage: "", orderingDisabledMessage: "" };
  }
}

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "admin" || userRole === "staff";
  const cartCount = await getCartCount(userId);
  const shopSettings = await getShopSettings();

  // If shop is closed, show maintenance page to non-admins
  if (!shopSettings.shopEnabled && !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
        <svg className="mb-6 h-16 w-16 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
        </svg>
        <h1 className="mb-3 text-2xl font-semibold text-neutral-900">Shop vorübergehend geschlossen</h1>
        <p className="max-w-md text-neutral-500">{shopSettings.maintenanceMessage}</p>
      </div>
    );
  }

  return (
    <CartProvider initialCount={cartCount} isLoggedIn={!!userId}>
      <div className="flex min-h-screen flex-col">
        <Header
          userName={session?.user?.name ?? null}
          isLoggedIn={!!session?.user}
        />
        {!shopSettings.orderingEnabled && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center text-sm text-amber-800">
            <strong>Hinweis:</strong> {shopSettings.orderingDisabledMessage}
          </div>
        )}
        <main className="flex-1">{children}</main>
        <Footer />
        <CookieBanner />
      </div>
    </CartProvider>
  );
}
