export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    images: string[];
    basePrice: string;
  };
  variant: {
    id: string;
    name: string;
    sku: string;
    price: string | null;
    stock: number;
    weight: string | null;
  };
}

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  descriptionHtml: string | null;
  basePrice: string;
  compareAtPrice: string | null;
  images: string[];
  featured: boolean;
  active: boolean;
  weight: string | null;
  taxRate: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  variants: ShopVariant[];
}

export interface ShopVariant {
  id: string;
  name: string;
  sku: string;
  price: string | null;
  stock: number;
  weight: string | null;
  attributes: Record<string, string>;
  active: boolean;
}

export interface OrderStatus {
  value: string;
  label: string;
  color: string;
}

export const ORDER_STATUSES: OrderStatus[] = [
  { value: "pending", label: "Ausstehend", color: "bg-yellow-100 text-yellow-800" },
  { value: "awaiting_payment", label: "Warte auf Zahlung", color: "bg-orange-100 text-orange-800" },
  { value: "paid", label: "Bezahlt", color: "bg-green-100 text-green-800" },
  { value: "processing", label: "In Bearbeitung", color: "bg-blue-100 text-blue-800" },
  { value: "shipped", label: "Versendet", color: "bg-purple-100 text-purple-800" },
  { value: "delivered", label: "Zugestellt", color: "bg-green-200 text-green-900" },
  { value: "cancelled", label: "Storniert", color: "bg-red-100 text-red-800" },
  { value: "refunded", label: "Erstattet", color: "bg-gray-100 text-gray-800" },
];

export const PAYMENT_METHODS = [
  { value: "stripe", label: "Kreditkarte" },
  { value: "klarna", label: "Klarna" },
  { value: "bank_transfer", label: "Banküberweisung" },
] as const;
