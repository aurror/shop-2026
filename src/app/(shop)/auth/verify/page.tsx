import Link from "next/link";
import { Button } from "@/components/shared/Button";

export default function VerifyPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm items-center px-4 py-12">
      <div className="w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <svg className="h-8 w-8 text-neutral-900" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Bitte prüfen Sie Ihre E-Mails
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          Wir haben Ihnen einen Anmelde-Link gesendet. Klicken Sie auf den Link in der E-Mail, um sich anzumelden.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Falls Sie keine E-Mail erhalten haben, überprüfen Sie bitte auch Ihren Spam-Ordner.
        </p>

        <div className="mt-8">
          <Link href="/auth/login">
            <Button variant="outline">
              Zurück zur Anmeldung
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
