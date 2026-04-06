import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/shared/Toast";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "3DPrintIt – Modelleisenbahn & 3D-Druck",
    template: "%s | 3DPrintIt",
  },
  description:
    "Ihr Online-Shop für Modelleisenbahn und 3D-gedruckte Teile. Hochwertige Produkte für Ihre Modellbahn-Landschaft.",
  keywords: [
    "Modelleisenbahn",
    "3D-Druck",
    "H0",
    "N-Spur",
    "TT",
    "Modellbahn",
    "3D Print",
    "Eisenbahn",
    "Modellbau",
  ],
  authors: [{ name: "3DPrintIt" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "3DPrintIt",
    title: "3DPrintIt – Modelleisenbahn & 3D-Druck",
    description:
      "Ihr Online-Shop für Modelleisenbahn und 3D-gedruckte Teile.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-neutral-900">
        <SessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
