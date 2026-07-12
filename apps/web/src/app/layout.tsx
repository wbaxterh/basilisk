import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nunito_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Variable fonts (single woff2 each) — self-hosted by next/font, no
// render-blocking Google Fonts @import. Covers every weight the UI uses
// (400/500/600/700/800/900 sans, 400/500 mono).
const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Basilisk — Cardano Analytics & Agent-Native Trading",
  description: "Real-time on-chain analytics, portfolio tracking, and the first x402 agent-native trading layer for Cardano.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunitoSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Third-party origins the browser hits directly: DexScreener
            (pressure card on /tokens/[asset]) and the CoinGecko image CDN
            (logo route 307-redirects there). */}
        <link rel="preconnect" href="https://api.dexscreener.com" />
        <link rel="dns-prefetch" href="https://api.dexscreener.com" />
        <link rel="preconnect" href="https://coin-images.coingecko.com" />
        <link rel="dns-prefetch" href="https://coin-images.coingecko.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
