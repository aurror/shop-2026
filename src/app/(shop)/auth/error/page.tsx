"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/shared/Button";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Es liegt ein Konfigurationsfehler vor. Bitte kontaktieren Sie den Support.",
  AccessDenied: "Der Zugriff wurde verweigert. Möglicherweise haben Sie keine Berechtigung.",
  Verification: "Der Anmelde-Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie einen neuen an.",
  OAuthSignin: "Fehler beim Starten der Anmeldung. Bitte versuchen Sie es erneut.",
  OAuthCallback: "Fehler bei der Anmeldung über den externen Anbieter.",
  OAuthCreateAccount: "Konto konnte nicht erstellt werden. Möglicherweise ist diese E-Mail bereits registriert.",
  EmailCreateAccount: "Konto konnte nicht erstellt werden. Bitte versuchen Sie es erneut.",
  Callback: "Ein Fehler ist bei der Anmeldung aufgetreten.",
  OAuthAccountNotLinked: "Diese E-Mail ist bereits mit einem anderen Anmeldeverfahren verknüpft. Bitte verwenden Sie die ursprüngliche Anmeldemethode.",
  EmailSignin: "Der Anmelde-Link konnte nicht gesendet werden. Bitte überprüfen Sie Ihre E-Mail-Adresse.",
  CredentialsSignin: "Ungültige Anmeldedaten. Bitte überprüfen Sie Ihre E-Mail und Ihr Passwort.",
  SessionRequired: "Bitte melden Sie sich an, um fortzufahren.",
  Default: "Ein unbekannter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "Default";
  const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm items-center px-4 py-12">
      <div className="w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Anmeldefehler
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          {message}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link href="/auth/login">
            <Button variant="primary">
              Zur Anmeldung
            </Button>
          </Link>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-700">
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
