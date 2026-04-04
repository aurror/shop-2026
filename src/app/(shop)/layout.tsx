import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartItems } from "@/lib/db/schema";
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

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  const cartCount = await getCartCount(userId);

  return (
    <CartProvider initialCount={cartCount}>
      <div className="flex min-h-screen flex-col">
        <Header
          userName={session?.user?.name ?? null}
          isLoggedIn={!!session?.user}
        />
        <main className="flex-1">{children}</main>
        <Footer />
        <CookieBanner />
      </div>
    </CartProvider>
  );
}
