import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(secretKey);
  }
  return stripeInstance;
}

export interface CreateCheckoutParams {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  items: Array<{
    name: string;
    description?: string;
    unitPrice: number; // in cents
    quantity: number;
    images?: string[];
  }>;
  shippingCost: number; // in cents
  discountAmount: number; // in cents
  paymentMethod: "stripe" | "klarna";
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();

  const lineItems = params.items.map((item) => ({
    price_data: {
      currency: "eur" as const,
      product_data: {
        name: item.name,
        description: item.description,
        images: item.images?.filter((img) => img.startsWith("http")),
      },
      unit_amount: item.unitPrice,
    },
    quantity: item.quantity,
  }));

  // Add shipping as a line item
  if (params.shippingCost > 0) {
    lineItems.push({
      price_data: {
        currency: "eur" as const,
        product_data: {
          name: "Versand",
          description: "Standardversand (DHL)",
          images: undefined,
        },
        unit_amount: params.shippingCost,
      },
      quantity: 1,
    });
  }

  const sessionConfig: Record<string, unknown> = {
    mode: "payment",
    customer_email: params.customerEmail,
    line_items: lineItems,
    success_url: `${params.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: params.cancelUrl,
    metadata: {
      orderId: params.orderId,
      orderNumber: params.orderNumber,
    },
    payment_intent_data: {
      metadata: {
        orderId: params.orderId,
        orderNumber: params.orderNumber,
      },
    },
    locale: "de",
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  };

  // Apply discount if any
  if (params.discountAmount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: params.discountAmount,
      currency: "eur",
      duration: "once",
      name: `Rabatt - ${params.orderNumber}`,
    });
    sessionConfig.discounts = [{ coupon: coupon.id }];
  }

  // Payment method types
  if (params.paymentMethod === "klarna") {
    sessionConfig.payment_method_types = ["klarna"];
  } else {
    sessionConfig.payment_method_types = ["card"];
  }

  const session = await (stripe.checkout.sessions.create as Function)(sessionConfig);

  return {
    sessionId: session.id,
    url: session.url || "",
  };
}

export async function getCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}

export async function constructWebhookEvent(
  body: string | Buffer,
  signature: string
) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}
