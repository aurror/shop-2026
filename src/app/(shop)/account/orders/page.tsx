"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { Pagination } from "@/components/shared/Pagination";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ORDER_STATUSES } from "@/types";

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  paymentMethod: string;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    totalPrice: string;
  }[];
}

const formatPrice = (price: number | string) => {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));

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

const ITEMS_PER_PAGE = 10;

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

  const fetchOrders = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?page=${pageNum}&limit=${ITEMS_PER_PAGE}`);
      if (res.status === 401) {
        router.push("/auth/login?callbackUrl=/account/orders");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrders(data.orders || []);
      setTotalOrders(data.total || 0);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/account/orders");
      return;
    }
    if (authStatus === "authenticated") {
      fetchOrders(page);
    }
  }, [authStatus, page, fetchOrders, router]);

  const handlePageChange = (newPage: number) => {
    router.push(`/account/orders?page=${newPage}`);
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Bestellungen</h1>
          <p className="mt-1 text-sm text-neutral-500">{totalOrders} Bestellung{totalOrders !== 1 ? "en" : ""}</p>
        </div>
        <Link href="/account">
          <Button variant="ghost" size="sm">
            Zurück zum Konto
          </Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Keine Bestellungen"
          description="Sie haben noch keine Bestellungen aufgegeben."
          icon={
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          }
          action={
            <Link href="/products">
              <Button variant="primary">Produkte entdecken</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="block px-5 py-5 transition-colors hover:bg-neutral-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-sm font-medium text-neutral-900">{order.orderNumber}</p>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-neutral-900">{formatPrice(order.total)}</p>
                    <p className="text-xs text-neutral-500">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-neutral-500">
                      {order.items.map((item) => (
                        <span key={item.id}>
                          {item.productName}
                          {item.variantName ? ` (${item.variantName})` : ""} &times; {item.quantity}
                        </span>
                      )).reduce<React.ReactNode[]>((prev, curr, i) => {
                        if (i === 0) return [curr];
                        return [...prev, <span key={`sep-${i}`}>, </span>, curr];
                      }, [])}
                    </p>
                  </div>
                )}
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
