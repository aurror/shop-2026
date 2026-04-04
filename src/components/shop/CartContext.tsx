"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export const GUEST_CART_KEY = "guest_cart";

export interface GuestCartItem {
  productId: string;
  variantId: string;
  quantity: number;
  // Display helpers stored locally
  productName?: string;
  variantName?: string;
  productSlug?: string;
  productImage?: string;
  unitPrice?: number;
}

export function getGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestCart(items: GuestCartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function clearGuestCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_CART_KEY);
}

export function getGuestCartCount(): number {
  return getGuestCart().reduce((sum, i) => sum + i.quantity, 0);
}

interface CartContextValue {
  cartCount: number;
  incrementCartCount: (by?: number) => void;
  setCartCount: (count: number) => void;
  refreshCartCount: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  initialCount,
  isLoggedIn,
}: {
  children: ReactNode;
  initialCount: number;
  isLoggedIn: boolean;
}) {
  const [cartCount, setCartCount] = useState(initialCount);

  // For unauthenticated users, seed count from localStorage on mount
  // For newly logged-in users (e.g. after OAuth redirect), merge guest cart
  useEffect(() => {
    if (!isLoggedIn) {
      setCartCount(getGuestCartCount());
    } else {
      // Merge any guest cart items when user is logged in
      const guestCart = getGuestCart();
      if (guestCart.length > 0) {
        fetch("/api/cart/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: guestCart }),
        })
          .then((res) => {
            if (res.ok) {
              clearGuestCart();
              // Refresh count from server
              return fetch("/api/cart").then((r) => r.ok ? r.json() : null);
            }
          })
          .then((data) => {
            if (data?.itemCount != null) setCartCount(data.itemCount);
          })
          .catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const incrementCartCount = useCallback((by = 1) => {
    setCartCount((prev) => prev + by);
  }, []);

  const refreshCartCount = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (res.ok) {
        const data = await res.json();
        setCartCount(data.itemCount ?? 0);
      } else if (res.status === 401) {
        // Guest: count from localStorage
        setCartCount(getGuestCartCount());
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <CartContext.Provider value={{ cartCount, incrementCartCount, setCartCount, refreshCartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
