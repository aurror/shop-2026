"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/components/admin/LocaleContext";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  totalCustomers: number;
  totalProducts: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customer: { name: string | null; email: string } | null;
  status: string;
  total: string;
  createdAt: string;
}

interface LowStockItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface VisitorData {
  date: string;
  uniqueVisitors: number;
  totalViews: number;
}

interface StockDemandItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  variantSku: string;
  requestCount: number;
}

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  pending: "warning",
  awaiting_payment: "warning",
  paid: "success",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  refunded: "default",
  failed: "danger",
};

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "gerade eben";
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)} Min.`;
  if (seconds < 86400) return `vor ${Math.floor(seconds / 3600)} Std.`;
  return `vor ${Math.floor(seconds / 86400)} Tagen`;
}

export default function AdminDashboardPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    todayOrders: 0,
    totalCustomers: 0,
    totalProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [visitorData, setVisitorData] = useState<VisitorData[]>([]);
  const [stockDemand, setStockDemand] = useState<StockDemandItem[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [ordersRes, productsRes, customersRes, notifRes, analyticsRes] =
          await Promise.all([
            fetch("/api/admin/orders?limit=10&sortBy=createdAt&sortOrder=desc"),
            fetch("/api/admin/products?limit=100"),
            fetch("/api/admin/customers?limit=1"),
            fetch("/api/admin/notifications?limit=5"),
            fetch("/api/admin/analytics?period=week"),
          ]);

        // Process orders
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setRecentOrders(ordersData.orders || []);

          const today = new Date().toISOString().split("T")[0];
          const todayOrders = (ordersData.orders || []).filter(
            (o: RecentOrder) => o.createdAt.startsWith(today)
          );
          const todayRevenue = todayOrders.reduce(
            (sum: number, o: RecentOrder) => sum + parseFloat(o.total),
            0
          );
          setStats((prev) => ({
            ...prev,
            todayOrders: todayOrders.length,
            todayRevenue: todayRevenue,
          }));
        }

        // Process products for low stock + total count
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setStats((prev) => ({
            ...prev,
            totalProducts: productsData.pagination?.total ?? 0,
          }));

          const lowStockItems: LowStockItem[] = [];
          for (const product of productsData.products || []) {
            for (const variant of product.variants || []) {
              if (variant.stock <= variant.lowStockThreshold) {
                lowStockItems.push({
                  id: variant.id,
                  productId: product.id,
                  name: `${product.name} - ${variant.name}`,
                  sku: variant.sku,
                  stock: variant.stock,
                  lowStockThreshold: variant.lowStockThreshold,
                });
              }
            }
          }
          setLowStock(lowStockItems.slice(0, 10));
        }

        // Process customers
        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setStats((prev) => ({
            ...prev,
            totalCustomers: customersData.pagination?.total ?? 0,
          }));
        }

        // Process notifications
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setNotifications(notifData.notifications || []);
        }

        // Process analytics
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          setVisitorData(analyticsData.pageViews?.visitorTrends || []);
          setStockDemand(analyticsData.stockDemand || []);
        }
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const maxVisitors = Math.max(...visitorData.map((d) => d.uniqueVisitors), 1);

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{t("overview")}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t("dashboard")} - {new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("todayRevenue")} value={formatCurrency(stats.todayRevenue)} icon="currency" />
        <StatCard label={t("todayOrders")} value={String(stats.todayOrders)} icon="orders" />
        <StatCard label={t("totalCustomers")} value={String(stats.totalCustomers)} icon="customers" />
        <StatCard label={t("totalProducts")} value={String(stats.totalProducts)} icon="products" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">{t("recentOrders")}</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
              {t("orders")} &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>{t("orderNumber")}</th>
                  <th>{t("customer")}</th>
                  <th>{t("status")}</th>
                  <th className="text-right">{t("total")}</th>
                  <th>{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-neutral-400">
                      {t("noResults")}
                    </td>
                  </tr>
                ) : (
                  recentOrders.slice(0, 10).map((order) => (
                    <tr key={order.id} className="cursor-pointer" onClick={() => window.location.href = `/admin/orders/${order.id}`}>
                      <td className="font-mono text-xs">{order.orderNumber}</td>
                      <td className="text-xs">
                        {order.customer?.name || order.customerEmail}
                      </td>
                      <td>
                        <Badge variant={statusVariant[order.status] || "default"}>
                          {t(order.status as any)}
                        </Badge>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(order.total)}</td>
                      <td className="text-xs text-neutral-500">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Low stock alerts */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">{t("lowStock")}</h2>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {lowStock.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-neutral-400">{t("noResults")}</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {lowStock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-6 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/products/${item.productId}`}
                          className="block truncate text-sm font-medium text-neutral-900 hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs text-neutral-500">{item.sku}</p>
                      </div>
                      <Badge variant={item.stock === 0 ? "danger" : "warning"}>
                        {item.stock} / {item.lowStockThreshold}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent notifications */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-neutral-900">{t("notifications")}</h2>
              <Link href="/admin/notifications" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                {t("notifications")} &rarr;
              </Link>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-neutral-400">{t("noResults")}</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {notifications.map((notif) => (
                    <li key={notif.id} className={`px-6 py-3 ${!notif.read ? "bg-neutral-50" : ""}`}>
                      <p className="text-sm font-medium text-neutral-900">{notif.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{timeAgo(notif.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Stock demand (back-in-stock requests) */}
          {stockDemand.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
                <h2 className="text-sm font-semibold text-neutral-900">Nachfrage (Benachrichtigungen)</h2>
                <Link href="/admin/analytics" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
                  Details &rarr;
                </Link>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <ul className="divide-y divide-neutral-100">
                  {stockDemand.map((item) => (
                    <li key={`${item.productId}-${item.variantId}`} className="flex items-center justify-between px-6 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/products/${item.productId}`}
                          className="block truncate text-sm font-medium text-neutral-900 hover:underline"
                        >
                          {item.productName} – {item.variantName}
                        </Link>
                        <p className="text-xs text-neutral-500">{item.variantSku}</p>
                      </div>
                      <Badge variant="info">
                        {item.requestCount} {item.requestCount === 1 ? "Anfrage" : "Anfragen"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page visitors chart */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">{t("pageVisitors")} ({t("thisWeek")})</h2>
        </div>
        <div className="px-6 py-6">
          {visitorData.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">{t("noResults")}</p>
          ) : (
            <div className="flex items-end gap-2" style={{ height: 200 }}>
              {visitorData.map((day) => {
                const heightPercent = (day.uniqueVisitors / maxVisitors) * 100;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium text-neutral-600">
                      {day.uniqueVisitors}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-neutral-900 transition-all"
                      style={{
                        height: `${Math.max(heightPercent, 2)}%`,
                        minHeight: 4,
                      }}
                    />
                    <span className="text-[10px] text-neutral-400">
                      {new Date(day.date).toLocaleDateString("de-DE", { weekday: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <StatIcon name={icon} />
      </div>
      <p className="mt-3 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function StatIcon({ name }: { name: string }) {
  const cls = "h-5 w-5 text-neutral-400";
  switch (name) {
    case "currency":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "orders":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      );
    case "customers":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      );
    case "products":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      );
    default:
      return null;
  }
}
