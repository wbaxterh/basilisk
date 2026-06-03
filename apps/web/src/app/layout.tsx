import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Basilisk — Cardano Analytics",
  description: "Cardano on-chain analytics, portfolio & trading platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#0F172A",
          background: "#FFFFFF",
        }}
      >
        {children}
      </body>
    </html>
  );
}
