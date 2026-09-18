// src/app/layout.tsx

import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../providers/query-provider";
import { SessionExpiryRedirect } from "@/components/auth/session-expiry-redirect";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: {
    default: "الفهد جروب | نظام الإدارة",
    template: "%s | الفهد جروب",
  },
  description: "Enterprise Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`
    ${cairo.variable}
    min-h-screen
    bg-gradient-to-b
    from-teal-50/70
    via-background
    to-background
    font-sans
    text-foreground
    antialiased
    selection:bg-teal-600
    selection:text-white
    dark:from-teal-950/20
    dark:via-background
    dark:to-background
  `}
      >
        <SessionExpiryRedirect />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
