import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Badge } from "@/components/shared/Badge";
import { ORDER_STATUSES } from "@/types";
import { AccountSecurity } from "@/components/shop/AccountSecurity";

const formatPrice = (price: number | string) => {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
};

const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

function getStatusBadge(status: string) {
  const s = ORDER_STATUSES.find((os) => os.value === status);
  if (!s) return <Badge>{status}</Badge>;

  const variantMap: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
    pending: "warning",
    awaiting_payment: "warning",
    paid: "success",
    processing: "info",
    shipped: "info",
    delivered: "success",
    cancelled: "danger",
    refunded: "default",
  };

  return <Badge variant={variantMap[status] || "default"}>{s.label}</Badge>;
}

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/account");
  }

  const recentOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt))
    .limit(5);

  const [userRecord] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const isLocalAccount = !!userRecord?.passwordHash;

  const quickLinks = [
    { href: "/account/orders", label: "Bestellungen", description: "Alle Bestellungen einsehen" },
    { href: "/account/addresses", label: "Adressen", description: "Lieferadressen verwalten" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Mein Konto</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Willkommen, {session.user.name || session.user.email}
        </p>
      </div>

      {/* User info */}
      <div className="mb-8 rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Profil</h2>
            <div className="mt-2 space-y-1">
              {session.user.name && (
                <p className="text-sm text-neutral-700">{session.user.name}</p>
              )}
              <p className="text-sm text-neutral-500">{session.user.email}</p>
            </div>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">
            {(session.user.name || session.user.email || "?")[0].toUpperCase()}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400"
          >
            <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-black">
              {link.label}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">{link.description}</p>
            <div className="mt-3 flex items-center text-xs font-medium text-neutral-500 group-hover:text-black">
              Anzeigen
              <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Letzte Bestellungen</h2>
          <Link href="/account/orders" className="text-xs font-medium text-neutral-500 hover:text-black">
            Alle anzeigen
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 p-8 text-center">
            <p className="text-sm text-neutral-500">Sie haben noch keine Bestellungen aufgegeben.</p>
            <Link
              href="/products"
              className="mt-2 inline-block text-sm font-medium text-neutral-900 underline hover:text-black"
            >
              Produkte entdecken
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-mono text-sm font-medium text-neutral-900">{order.orderNumber}</p>
                    <p className="text-xs text-neutral-500">{formatDate(order.createdAt)}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-900">{formatPrice(order.total)}</span>
                  <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {isLocalAccount && (
        <div className="mt-12">
          <AccountSecurity />
        </div>
      )}
    </div>
  );
}
