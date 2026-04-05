import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, orders, users, categories, discounts, contactRequests } from "@/lib/db/schema";
import { ilike, or, and, ne } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !["admin", "staff"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  if (q.length < 2) return NextResponse.json({});

  const like = `%${q}%`;

  const [productResults, orderResults, userResults, categoryResults, discountResults, requestResults] = await Promise.all([
    db.select({ id: products.id, name: products.name })
      .from(products)
      .where(or(ilike(products.name, like), ilike(products.slug, like)))
      .limit(5),

    db.select({ id: orders.id, orderNumber: orders.orderNumber, customerEmail: orders.customerEmail })
      .from(orders)
      .where(or(ilike(orders.orderNumber, like), ilike(orders.customerEmail, like)))
      .limit(5),

    db.select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(or(ilike(users.name, like), ilike(users.email, like)), ne(users.role, "customer")))
      .limit(5),

    db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(or(ilike(categories.name, like), ilike(categories.slug, like)))
      .limit(5),

    db.select({ id: discounts.id, code: discounts.code })
      .from(discounts)
      .where(ilike(discounts.code, like))
      .limit(5),

    db.select({ id: contactRequests.id, name: contactRequests.name, message: contactRequests.message })
      .from(contactRequests)
      .where(or(ilike(contactRequests.name, like), ilike(contactRequests.email, like), ilike(contactRequests.message, like)))
      .limit(5),
  ]);

  return NextResponse.json({
    products: productResults.map((p) => ({ id: p.id, label: p.name, href: `/admin/products/${p.id}` })),
    orders: orderResults.map((o) => ({ id: o.id, label: `${o.orderNumber} — ${o.customerEmail || ""}`, href: `/admin/orders/${o.id}` })),
    users: userResults.map((u) => ({ id: u.id, label: `${u.name || ""} <${u.email}>`, href: `/admin/users` })),
    categories: categoryResults.map((c) => ({ id: c.id, label: c.name, href: `/admin/categories` })),
    discounts: discountResults.map((d) => ({ id: d.id, label: d.code, href: `/admin/discounts` })),
    requests: requestResults.map((r) => ({ id: r.id, label: `${r.name}: ${(r.message || "").slice(0, 60)}`, href: `/admin/requests` })),
  });
}
