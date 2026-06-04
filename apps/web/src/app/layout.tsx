import type { Metadata } from "next";
import type { ReactNode } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basilisk — Cardano Analytics",
  description: "Cardano on-chain analytics, portfolio & trading platform.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <div style={{
          marginLeft: "var(--sidebar-width)",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}>
          <Header />
          <main style={{
            flex: 1,
            padding: 24,
          }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
