import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basilisk — Cardano Analytics & Agent-Native Trading",
  description: "Real-time on-chain analytics, portfolio tracking, and the first x402 agent-native trading layer for Cardano.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
