"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PAYMENT_METHODS } from "@/types";

interface CartItemData {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  product: {
    name: string;
    slug: string;
    images: string[];
    basePrice: string;
    taxRate: string;
  };
  variant: {
    name: string;
    sku: string;
    price: string | null;
    stock: number;
    weight: string | null;
  };
  unitPrice: number;
  totalPrice: number;
}

interface CartData {
  items: CartItemData[];
  itemCount: number;
  subtotal: number;
}

interface Address {
  id?: string;
  label?: string;
  firstName: string;
  lastName: string;
  company?: string;
  street: string;
  streetNumber: string;
  addressExtra?: string;
  zip: string;
  city: string;
  country: string;
  isDefault?: boolean;
}

interface ShippingData {
  shippingFee: number;
  freeShippingThreshold: number | null;
  freeShippingEligible: boolean;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(price);

const STEPS = [
  { key: "address", label: "Adresse" },
  { key: "payment", label: "Zahlung" },
  { key: "review", label: "Überprüfung" },
] as const;

const emptyAddress: Address = {
  firstName: "",
  lastName: "",
  company: "",
  street: "",
  streetNumber: "",
  addressExtra: "",
  zip: "",
  city: "",
  country: "DE",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [step, setStep] = useState(0);
  const [cart, setCart] = useState<CartData | null>(null);
  const [shipping, setShipping] = useState<ShippingData | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [stockWarnings, setStockWarnings] = useState<Array<{
    cartItemId: string; productName: string; variantName: string;
    type: "stock_reduced" | "out_of_stock"; requestedQty: number; availableStock: number;
  }>>([]);

  // Form data
  const [shippingAddress, setShippingAddress] = useState<Address>(emptyAddress);
  const [billingAddress, setBillingAddress] = useState<Address>(emptyAddress);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");
  const [paymentMethod, setPaymentMethod] = useState<string>("stripe");
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState<{
    code: string;
    type: string;
    description: string;
    discountAmount: number;
    freeShipping: boolean;
  } | null>(null);
  const [discountError, setDiscountError] = useState("");
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToWithdrawal, setAgreedToWithdrawal] = useState(false);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});
  const [saveAddress, setSaveAddress] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) return null;
      const data: CartData = await res.json();
      if (data.items.length === 0) {
        router.push("/cart");
        return null;
      }
      setCart(data);
      return data;
    } catch {
      return null;
    }
  }, [router]);

  const fetchShipping = useCallback(async (cartData: CartData) => {
    try {
      const res = await fetch("/api/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartData.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          subtotal: cartData.subtotal,
        }),
      });
      if (res.ok) {
        const data: ShippingData = await res.json();
        setShipping(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch("/api/addresses");
      if (res.ok) {
        const data = await res.json();
        setSavedAddresses(data.addresses || []);
        const defaultAddr = (data.addresses || []).find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id!);
          setShippingAddress(defaultAddr);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      setLoading(true);
      const data = await fetchCart();
      if (data) await fetchShipping(data);
      await fetchAddresses();
      // Validate stock on checkout entry
      try {
        const vRes = await fetch("/api/cart/validate");
        if (vRes.ok) {
          const vData = await vRes.json();
          setStockWarnings(vData.warnings || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [status, fetchCart, fetchShipping, fetchAddresses]);

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    if (addressId === "new") {
      setShippingAddress(emptyAddress);
    } else {
      const addr = savedAddresses.find((a) => a.id === addressId);
      if (addr) setShippingAddress(addr);
    }
  };

  const validateAddress = (): boolean => {
    const errors: Record<string, string> = {};
    if (!shippingAddress.firstName.trim()) errors.firstName = "Vorname erforderlich";
    if (!shippingAddress.lastName.trim()) errors.lastName = "Nachname erforderlich";
    if (!shippingAddress.street.trim()) errors.street = "Straße erforderlich";
    if (!shippingAddress.streetNumber.trim()) errors.streetNumber = "Hausnummer erforderlich";
    if (!shippingAddress.zip.trim() || shippingAddress.zip.trim().length < 4) errors.zip = "Gültige PLZ erforderlich";
    if (!shippingAddress.city.trim()) errors.city = "Stadt erforderlich";

    if (!billingSameAsShipping) {
      if (!billingAddress.firstName.trim()) errors.billingFirstName = "Vorname erforderlich";
      if (!billingAddress.lastName.trim()) errors.billingLastName = "Nachname erforderlich";
      if (!billingAddress.street.trim()) errors.billingStreet = "Straße erforderlich";
      if (!billingAddress.streetNumber.trim()) errors.billingStreetNumber = "Hausnummer erforderlich";
      if (!billingAddress.zip.trim() || billingAddress.zip.trim().length < 4) errors.billingZip = "Gültige PLZ erforderlich";
      if (!billingAddress.city.trim()) errors.billingCity = "Stadt erforderlich";
    }

    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (step === 0) {
      if (!validateAddress()) return;
    }
    setStep((s) => Math.min(s + 1, 2));
    setError("");
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 0));
    setError("");
  };

  const applyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) return;
    setDiscountError("");
    setDiscountLoading(true);
    try {
      const res = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: cart?.subtotal ?? 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiscountError(data.error || "Ungültiger Rabattcode");
        setDiscountApplied(null);
      } else {
        setDiscountApplied(data);
        setDiscountError("");
      }
    } catch {
      setDiscountError("Fehler bei der Überprüfung");
    } finally {
      setDiscountLoading(false);
    }
  };

  const removeDiscount = () => {
    setDiscountApplied(null);
    setDiscountCode("");
    setDiscountError("");
  };

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      setError("Bitte akzeptieren Sie die AGB.");
      return;
    }
    if (!agreedToWithdrawal) {
      setError("Bitte bestätigen Sie die Kenntnisnahme der Widerrufsbelehrung.");
      return;
    }

    setSubmitting(true);
    setError("");

    const finalBilling = billingSameAsShipping ? shippingAddress : billingAddress;
    const { id: _sId, label: _sL, isDefault: _sD, ...cleanShipping } = shippingAddress;
    const { id: _bId, label: _bL, isDefault: _bD, ...cleanBilling } = finalBilling;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress: cleanShipping,
          billingAddress: cleanBilling,
          paymentMethod,
          discountCode: discountCode.trim() || undefined,
          agreedToTerms,
          agreedToWithdrawal,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten.");
        setSubmitting(false);
        return;
      }

      if (paymentMethod === "bank_transfer") {
        // Save address if requested (fire and forget)
        if (saveAddress) {
          const { id: _id, label: _l, isDefault: _d, ...addrPayload } = shippingAddress;
          fetch("/api/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(addrPayload),
          }).catch(() => {});
        }
        router.push(`/checkout/bank-transfer?orderId=${data.orderId}`);
      } else {
        if (saveAddress) {
          const { id: _id, label: _l, isDefault: _d, ...addrPayload } = shippingAddress;
          fetch("/api/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(addrPayload),
          }).catch(() => {});
        }
        router.push(`/checkout/success?orderId=${data.orderId}`);
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4 py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  if (!cart || cart.items.length === 0) return null;

  const discountAmt = discountApplied?.discountAmount ?? 0;
  const effectiveShipping = discountApplied?.freeShipping ? 0 : (shipping?.shippingFee ?? 0);
  const total = cart.subtotal - discountAmt + effectiveShipping;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-neutral-900">Kasse</h1>

      {/* Stock warnings banner */}
      {stockWarnings.length > 0 && (
        <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="mb-1 text-sm font-semibold text-yellow-800">Verfügbarkeit geändert</p>
          <ul className="space-y-1">
            {stockWarnings.map((w) => (
              <li key={w.cartItemId} className="text-sm text-yellow-700">
                {w.type === "out_of_stock"
                  ? <><strong>{w.productName}</strong> ({w.variantName}) ist nicht mehr auf Lager.</>
                  : <><strong>{w.productName}</strong> ({w.variantName}): Nur noch {w.availableStock} verfügbar (Sie haben {w.requestedQty} im Warenkorb).</>
                }
                {" "}
                <Link href="/cart" className="underline hover:no-underline">Warenkorb anpassen</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps indicator */}
      <div className="mb-10 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (i < step) setStep(i);
              }}
              disabled={i > step}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i === step
                  ? "bg-black text-white"
                  : i < step
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 text-neutral-500"
              }`}
            >
              {i < step ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </button>
            <span className={`text-sm ${i === step ? "font-medium text-neutral-900" : "text-neutral-500"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-px w-8 ${i < step ? "bg-neutral-900" : "bg-neutral-200"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-12">
        {/* Main content */}
        <div className="lg:col-span-7">
          {/* Step 1: Address */}
          {step === 0 && (
            <div>
              <h2 className="mb-6 text-lg font-semibold text-neutral-900">Lieferadresse</h2>

              {savedAddresses.length > 0 && (
                <div className="mb-6">
                  <Select
                    label="Gespeicherte Adresse"
                    value={selectedAddressId}
                    onChange={(e) => handleAddressSelect(e.target.value)}
                    options={[
                      ...savedAddresses.map((a) => ({
                        value: a.id!,
                        label: `${a.label || "Adresse"} – ${a.firstName} ${a.lastName}, ${a.street} ${a.streetNumber}, ${a.zip} ${a.city}`,
                      })),
                      { value: "new", label: "Neue Adresse eingeben" },
                    ]}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Vorname"
                  value={shippingAddress.firstName}
                  onChange={(e) => setShippingAddress((a) => ({ ...a, firstName: e.target.value }))}
                  error={addressErrors.firstName}
                  required
                />
                <Input
                  label="Nachname"
                  value={shippingAddress.lastName}
                  onChange={(e) => setShippingAddress((a) => ({ ...a, lastName: e.target.value }))}
                  error={addressErrors.lastName}
                  required
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Firma (optional)"
                  value={shippingAddress.company || ""}
                  onChange={(e) => setShippingAddress((a) => ({ ...a, company: e.target.value }))}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Input
                    label="Straße"
                    value={shippingAddress.street}
                    onChange={(e) => setShippingAddress((a) => ({ ...a, street: e.target.value }))}
                    error={addressErrors.street}
                    required
                  />
                </div>
                <Input
                  label="Nr."
                  value={shippingAddress.streetNumber}
                  onChange={(e) => setShippingAddress((a) => ({ ...a, streetNumber: e.target.value }))}
                  error={addressErrors.streetNumber}
                  required
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Adresszusatz (optional)"
                  value={shippingAddress.addressExtra || ""}
                  onChange={(e) => setShippingAddress((a) => ({ ...a, addressExtra: e.target.value }))}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <Input
                  label="PLZ"
                  value={shippingAddress.zip}
                  onChange={(e) => setShippingAddress((a) => ({ ...a, zip: e.target.value }))}
                  error={addressErrors.zip}
                  required
                />
                <div className="col-span-2">
                  <Input
                    label="Stadt"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress((a) => ({ ...a, city: e.target.value }))}
                    error={addressErrors.city}
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <Select
                  label="Land"
                  value={shippingAddress.country}
                  onChange={(e) => setShippingAddress((a) => ({ ...a, country: e.target.value }))}
                  options={[
                    { value: "DE", label: "Deutschland" },
                    { value: "AT", label: "Österreich" },
                    { value: "CH", label: "Schweiz" },
                  ]}
                />
              </div>

              <div className="mt-6">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={billingSameAsShipping}
                    onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
                  />
                  Rechnungsadresse entspricht Lieferadresse
                </label>
              </div>

              <div className="mt-3">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
                  />
                  Lieferadresse für spätere Bestellungen speichern
                </label>
              </div>

              {!billingSameAsShipping && (
                <div className="mt-6 border-t border-neutral-200 pt-6">
                  <h3 className="mb-4 text-base font-semibold text-neutral-900">Rechnungsadresse</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Vorname"
                      value={billingAddress.firstName}
                      onChange={(e) => setBillingAddress((a) => ({ ...a, firstName: e.target.value }))}
                      error={addressErrors.billingFirstName}
                      required
                    />
                    <Input
                      label="Nachname"
                      value={billingAddress.lastName}
                      onChange={(e) => setBillingAddress((a) => ({ ...a, lastName: e.target.value }))}
                      error={addressErrors.billingLastName}
                      required
                    />
                  </div>
                  <div className="mt-4">
                    <Input
                      label="Firma (optional)"
                      value={billingAddress.company || ""}
                      onChange={(e) => setBillingAddress((a) => ({ ...a, company: e.target.value }))}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <Input
                        label="Straße"
                        value={billingAddress.street}
                        onChange={(e) => setBillingAddress((a) => ({ ...a, street: e.target.value }))}
                        error={addressErrors.billingStreet}
                        required
                      />
                    </div>
                    <Input
                      label="Nr."
                      value={billingAddress.streetNumber}
                      onChange={(e) => setBillingAddress((a) => ({ ...a, streetNumber: e.target.value }))}
                      error={addressErrors.billingStreetNumber}
                      required
                    />
                  </div>
                  <div className="mt-4">
                    <Input
                      label="Adresszusatz (optional)"
                      value={billingAddress.addressExtra || ""}
                      onChange={(e) => setBillingAddress((a) => ({ ...a, addressExtra: e.target.value }))}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <Input
                      label="PLZ"
                      value={billingAddress.zip}
                      onChange={(e) => setBillingAddress((a) => ({ ...a, zip: e.target.value }))}
                      error={addressErrors.billingZip}
                      required
                    />
                    <div className="col-span-2">
                      <Input
                        label="Stadt"
                        value={billingAddress.city}
                        onChange={(e) => setBillingAddress((a) => ({ ...a, city: e.target.value }))}
                        error={addressErrors.billingCity}
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Select
                      label="Land"
                      value={billingAddress.country}
                      onChange={(e) => setBillingAddress((a) => ({ ...a, country: e.target.value }))}
                      options={[
                        { value: "DE", label: "Deutschland" },
                        { value: "AT", label: "Österreich" },
                        { value: "CH", label: "Schweiz" },
                      ]}
                    />
                  </div>
                </div>
              )}

              <div className="mt-8">
                <Button variant="primary" size="lg" onClick={nextStep}>
                  Weiter zur Zahlung
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Payment */}
          {step === 1 && (
            <div>
              <h2 className="mb-6 text-lg font-semibold text-neutral-900">Zahlungsart</h2>

              <div className="space-y-3">
                {PAYMENT_METHODS.map((pm) => (
                  <label
                    key={pm.value}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors ${
                      paymentMethod === pm.value
                        ? "border-black bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={pm.value}
                      checked={paymentMethod === pm.value}
                      onChange={() => setPaymentMethod(pm.value)}
                      className="h-4 w-4 border-neutral-300 text-black focus:ring-neutral-400"
                    />
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{pm.label}</p>
                      {pm.value === "stripe" && (
                        <p className="text-xs text-neutral-500">Visa, Mastercard, American Express</p>
                      )}
                      {pm.value === "klarna" && (
                        <p className="text-xs text-neutral-500">Rechnung, Ratenkauf, Sofortüberweisung</p>
                      )}
                      {pm.value === "bank_transfer" && (
                        <p className="text-xs text-neutral-500">Manuelle Überweisung – Versand nach Zahlungseingang</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Discount code */}
              <div className="mt-8">
                {discountApplied ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <span className="flex-1 text-sm font-medium text-green-800">
                      {discountApplied.code} — {discountApplied.description}
                    </span>
                    <button
                      type="button"
                      onClick={removeDiscount}
                      className="text-xs font-medium text-green-700 hover:text-green-900"
                    >
                      Entfernen
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setDiscountOpen((o) => !o)}
                      className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-neutral-600"
                    >
                      <svg
                        className={`h-3 w-3 transition-transform ${discountOpen ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                      Rabattcode eingeben
                    </button>
                    {discountOpen && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          placeholder="Code eingeben"
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); applyDiscount(); }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={applyDiscount}
                          loading={discountLoading}
                          disabled={!discountCode.trim()}
                        >
                          Einlösen
                        </Button>
                      </div>
                    )}
                    {discountError && (
                      <p className="mt-1 text-xs text-red-600">{discountError}</p>
                    )}
                  </>
                )}
              </div>

              <div className="mt-8 flex gap-3">
                <Button variant="outline" size="lg" onClick={prevStep}>
                  Zurück
                </Button>
                <Button variant="primary" size="lg" onClick={nextStep}>
                  Weiter zur Überprüfung
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 2 && (
            <div>
              <h2 className="mb-6 text-lg font-semibold text-neutral-900">Bestellung überprüfen</h2>

              {/* Address summary */}
              <div className="mb-6 rounded-xl border border-neutral-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Lieferadresse</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      {shippingAddress.firstName} {shippingAddress.lastName}
                      {shippingAddress.company && <><br />{shippingAddress.company}</>}
                      <br />
                      {shippingAddress.street} {shippingAddress.streetNumber}
                      {shippingAddress.addressExtra && <><br />{shippingAddress.addressExtra}</>}
                      <br />
                      {shippingAddress.zip} {shippingAddress.city}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="text-xs text-neutral-500 hover:text-neutral-900"
                  >
                    Ändern
                  </button>
                </div>
              </div>

              {/* Payment method summary */}
              <div className="mb-6 rounded-xl border border-neutral-200 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Zahlungsart</h3>
                    <p className="mt-1 text-sm text-neutral-600">
                      {PAYMENT_METHODS.find((pm) => pm.value === paymentMethod)?.label}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-neutral-500 hover:text-neutral-900"
                  >
                    Ändern
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="mb-6 rounded-xl border border-neutral-200 p-5">
                <h3 className="mb-3 text-sm font-semibold text-neutral-900">Artikel</h3>
                <div className="divide-y divide-neutral-100">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                        {item.product.images[0] ? (
                          <Image
                            src={item.product.images[0]}
                            alt={item.product.name}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-neutral-300">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">{item.product.name}</p>
                        <p className="text-xs text-neutral-500">{item.variant.name} &times; {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium text-neutral-900">{formatPrice(item.totalPrice)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal checkboxes */}
              <div className="mb-6 space-y-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
                  />
                  <span className="text-sm text-neutral-700">
                    Ich akzeptiere die{" "}
                    <Link href="/agb" target="_blank" className="underline hover:text-black">
                      AGB
                    </Link>
                    . *
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={agreedToWithdrawal}
                    onChange={(e) => setAgreedToWithdrawal(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
                  />
                  <span className="text-sm text-neutral-700">
                    Ich habe die{" "}
                    <Link href="/widerruf" target="_blank" className="underline hover:text-black">
                      Widerrufsbelehrung
                    </Link>{" "}
                    gelesen und zur Kenntnis genommen. *
                  </span>
                </label>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={prevStep}>
                  Zurück
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  onClick={handleSubmit}
                >
                  Zahlungspflichtig bestellen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="mt-8 lg:col-span-5 lg:mt-0">
          <div className="sticky top-8 rounded-xl border border-neutral-200 bg-neutral-50 p-6">
            <h2 className="text-lg font-semibold text-neutral-900">Bestellübersicht</h2>

            <div className="mt-4 max-h-64 divide-y divide-neutral-100 overflow-y-auto">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-200">
                    {item.product.images[0] ? (
                      <Image
                        src={item.product.images[0]}
                        alt={item.product.name}
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                        –
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-neutral-900">{item.product.name}</p>
                    <p className="text-xs text-neutral-500">{item.quantity}x</p>
                  </div>
                  <p className="text-xs font-medium text-neutral-900">{formatPrice(item.totalPrice)}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Zwischensumme</span>
                <span className="font-medium text-neutral-900">{formatPrice(cart.subtotal)}</span>
              </div>
              {discountApplied && discountAmt > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Rabatt ({discountApplied.code})</span>
                  <span className="font-medium text-green-700">−{formatPrice(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Versand</span>
                <span className="font-medium text-neutral-900">
                  {discountApplied?.freeShipping ? (
                    <span className="text-green-700">Kostenlos (Rabatt)</span>
                  ) : shipping ? (
                    shipping.shippingFee === 0 ? (
                      <span className="text-green-700">Kostenlos</span>
                    ) : (
                      formatPrice(shipping.shippingFee)
                    )
                  ) : (
                    "Wird berechnet"
                  )}
                </span>
              </div>
            </div>

            <div className="mt-3 flex justify-between border-t border-neutral-900 pt-3">
              <span className="text-base font-semibold text-neutral-900">Gesamt</span>
              <span className="text-base font-semibold text-neutral-900">{formatPrice(total)}</span>
            </div>
            <p className="mt-1 text-right text-xs text-neutral-500">inkl. MwSt.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
