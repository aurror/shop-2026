"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import { getGuestCart, clearGuestCart } from "@/components/shop/CartContext";

async function mergeGuestCartAfterLogin() {
  const guestCart = getGuestCart();
  if (guestCart.length === 0) return;
  try {
    await fetch("/api/cart/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: guestCart }),
    });
    clearGuestCart();
  } catch {
    // non-critical — ignore
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/account";

  const [mode, setMode] = useState<"credentials" | "magic-link">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Bitte füllen Sie alle Felder aus.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Ungültige E-Mail-Adresse oder Passwort.");
      } else {
        await mergeGuestCartAfterLogin();
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Bitte geben Sie Ihre E-Mail-Adresse ein.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("nodemailer", {
        email: email.trim().toLowerCase(),
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Fehler beim Senden des Links. Bitte versuchen Sie es erneut.");
      } else {
        setMagicLinkSent(true);
        router.push("/auth/verify");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm items-center px-4 py-12">
      <div className="w-full">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Anmelden</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Melden Sie sich bei Ihrem Konto an
          </p>
        </div>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Mit Google anmelden
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-xs text-neutral-400">oder</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        {/* Mode toggle */}
        <div className="mb-6 flex rounded-lg border border-neutral-200 p-0.5">
          <button
            type="button"
            onClick={() => { setMode("credentials"); setError(""); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "credentials"
                ? "bg-black text-white"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            E-Mail & Passwort
          </button>
          <button
            type="button"
            onClick={() => { setMode("magic-link"); setError(""); }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "magic-link"
                ? "bg-black text-white"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Magic Link
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {mode === "credentials" ? (
          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <Input
              label="E-Mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ihre@email.de"
              autoComplete="email"
              required
            />
            <Input
              label="Passwort"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ihr Passwort"
              autoComplete="current-password"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Anmelden
            </Button>
          </form>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <Input
              label="E-Mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ihre@email.de"
              autoComplete="email"
              required
            />
            <p className="text-xs text-neutral-500">
              Wir senden Ihnen einen Link, mit dem Sie sich ohne Passwort anmelden können.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Link senden
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-neutral-500">
          Noch kein Konto?{" "}
          <Link href="/auth/register" className="font-medium text-neutral-900 underline hover:text-black">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
