"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
}: {
  children: ReactNode;
  initialCount: number;
}) {
  const [cartCount, setCartCount] = useState(initialCount);

  const incrementCartCount = useCallback((by = 1) => {
    setCartCount((prev) => prev + by);
  }, []);

  const refreshCartCount = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (res.ok) {
        const data = await res.json();
        setCartCount(data.itemCount ?? 0);
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
