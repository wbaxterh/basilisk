"use client";

import { useEffect, useRef, useState } from "react";

import { useWallet } from "@/lib/wallet-context";

export default function Header() {
  const { status, walletName, walletIcon, stakeShort, error, connect, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the connected-wallet menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <header style={{
      height: "var(--header-height)",
      borderBottom: "1px solid var(--color-border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      background: "var(--color-bg-secondary)",
    }}>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
        Cardano Analytics Platform
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Network badge */}
        <span style={{
          fontSize: 12,
          padding: "4px 10px",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-brand-soft)",
          color: "var(--color-brand)",
          fontWeight: 600,
        }}>
          Mainnet
        </span>

        {/* Wallet connect (context-driven) */}
        {status === "connected" ? (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {walletIcon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={walletIcon} alt="" width={16} height={16} style={{ borderRadius: 4 }} />
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {stakeShort ?? "—"}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {walletName}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-muted)" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {menuOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 200,
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: 8,
                zIndex: 200,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}>
                <div style={{
                  padding: "6px 10px 8px",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "var(--color-text-muted)",
                  fontWeight: 700,
                }}>
                  {walletName ?? "Wallet"}
                </div>
                <button
                  onClick={() => {
                    disconnect();
                    setMenuOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                    color: "var(--color-text-primary)",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {error && (
              <span style={{ fontSize: 12, color: "var(--color-negative)", maxWidth: 260 }}>
                {error}
              </span>
            )}
            <button
              onClick={() => void connect()}
              disabled={status === "connecting"}
              style={{
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-brand)",
                color: "#001A0E",
                fontWeight: 600,
                border: "none",
                cursor: status === "connecting" ? "wait" : "pointer",
                opacity: status === "connecting" ? 0.7 : 1,
              }}
            >
              {status === "connecting" ? "Connecting…" : "Connect Wallet"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
