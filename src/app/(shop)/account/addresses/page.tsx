"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { Select } from "@/components/shared/Select";
import { Badge } from "@/components/shared/Badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";

interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  company: string | null;
  street: string;
  streetNumber: string;
  addressExtra: string | null;
  zip: string;
  city: string;
  country: string;
  isDefault: boolean;
}

const emptyForm = {
  label: "",
  firstName: "",
  lastName: "",
  company: "",
  street: "",
  streetNumber: "",
  addressExtra: "",
  zip: "",
  city: "",
  country: "DE",
  isDefault: false,
};

export default function AddressesPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch("/api/addresses");
      if (res.status === 401) {
        router.push("/auth/login?callbackUrl=/account/addresses");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAddresses(data.addresses || []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/auth/login?callbackUrl=/account/addresses");
      return;
    }
    if (authStatus === "authenticated") {
      fetchAddresses();
    }
  }, [authStatus, fetchAddresses, router]);

  const openNewForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormErrors({});
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (address: Address) => {
    setForm({
      label: address.label || "",
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company || "",
      street: address.street,
      streetNumber: address.streetNumber,
      addressExtra: address.addressExtra || "",
      zip: address.zip,
      city: address.city,
      country: address.country,
      isDefault: address.isDefault,
    });
    setEditingId(address.id);
    setFormErrors({});
    setFormError("");
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormError("");
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "Vorname erforderlich";
    if (!form.lastName.trim()) errors.lastName = "Nachname erforderlich";
    if (!form.street.trim()) errors.street = "Straße erforderlich";
    if (!form.streetNumber.trim()) errors.streetNumber = "Hausnummer erforderlich";
    if (!form.zip.trim() || form.zip.trim().length < 4) errors.zip = "Gültige PLZ erforderlich";
    if (!form.city.trim()) errors.city = "Stadt erforderlich";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setFormError("");

    const method = editingId ? "PUT" : "POST";
    const body = editingId ? { ...form, id: editingId } : form;

    try {
      const res = await fetch("/api/addresses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Fehler beim Speichern");
        return;
      }

      await fetchAddresses();
      cancelForm();
    } catch {
      setFormError("Ein Fehler ist aufgetreten.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie diese Adresse wirklich löschen?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/addresses?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchAddresses();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (address: Address) => {
    try {
      await fetch("/api/addresses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...address, isDefault: true }),
      });
      await fetchAddresses();
    } catch {
      // ignore
    }
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
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Adressen</h1>
          <p className="mt-1 text-sm text-neutral-500">Verwalten Sie Ihre Lieferadressen</p>
        </div>
        <div className="flex gap-2">
          <Link href="/account">
            <Button variant="ghost" size="sm">Zurück</Button>
          </Link>
          {!showForm && (
            <Button variant="primary" size="sm" onClick={openNewForm}>
              Neue Adresse
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-neutral-200 p-6">
          <h2 className="mb-5 text-base font-semibold text-neutral-900">
            {editingId ? "Adresse bearbeiten" : "Neue Adresse"}
          </h2>

          <div className="space-y-4">
            <Input
              label="Bezeichnung (z.B. Zuhause, Büro)"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Standard"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Vorname"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                error={formErrors.firstName}
                required
              />
              <Input
                label="Nachname"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                error={formErrors.lastName}
                required
              />
            </div>
            <Input
              label="Firma (optional)"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input
                  label="Straße"
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  error={formErrors.street}
                  required
                />
              </div>
              <Input
                label="Nr."
                value={form.streetNumber}
                onChange={(e) => setForm((f) => ({ ...f, streetNumber: e.target.value }))}
                error={formErrors.streetNumber}
                required
              />
            </div>
            <Input
              label="Adresszusatz (optional)"
              value={form.addressExtra}
              onChange={(e) => setForm((f) => ({ ...f, addressExtra: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="PLZ"
                value={form.zip}
                onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                error={formErrors.zip}
                required
              />
              <div className="col-span-2">
                <Input
                  label="Stadt"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  error={formErrors.city}
                  required
                />
              </div>
            </div>
            <Select
              label="Land"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              options={[
                { value: "DE", label: "Deutschland" },
                { value: "AT", label: "Österreich" },
                { value: "CH", label: "Schweiz" },
              ]}
            />
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-neutral-400"
              />
              Als Standardadresse festlegen
            </label>
          </div>

          {formError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editingId ? "Speichern" : "Hinzufügen"}
            </Button>
            <Button variant="outline" onClick={cancelForm}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Address List */}
      {addresses.length === 0 && !showForm ? (
        <EmptyState
          title="Keine Adressen gespeichert"
          description="Fügen Sie eine Lieferadresse hinzu, um den Bestellvorgang zu beschleunigen."
          icon={
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          }
          action={
            <Button variant="primary" onClick={openNewForm}>
              Adresse hinzufügen
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`relative rounded-xl border p-5 ${
                address.isDefault ? "border-black" : "border-neutral-200"
              }`}
            >
              {address.isDefault && (
                <div className="mb-2">
                  <Badge variant="default">Standardadresse</Badge>
                </div>
              )}
              {address.label && (
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  {address.label}
                </p>
              )}
              <div className="text-sm text-neutral-700">
                <p className="font-medium text-neutral-900">
                  {address.firstName} {address.lastName}
                </p>
                {address.company && <p>{address.company}</p>}
                <p>{address.street} {address.streetNumber}</p>
                {address.addressExtra && <p>{address.addressExtra}</p>}
                <p>{address.zip} {address.city}</p>
                <p>{address.country}</p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(address)}
                  className="text-xs font-medium text-neutral-600 hover:text-black"
                >
                  Bearbeiten
                </button>
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(address)}
                    className="text-xs font-medium text-neutral-600 hover:text-black"
                  >
                    Als Standard
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(address.id)}
                  disabled={deletingId === address.id}
                  className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingId === address.id ? "Löschen..." : "Löschen"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
