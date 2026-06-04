"use client";

import { useState, useEffect } from "react";
import { detectWallets, connectWallet, lovelaceToAda, type WalletInfo, type ConnectedWallet } from "../lib/wallet";

export default function Header() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Detect wallets after a brief delay (extensions inject after page load).
    const timer = setTimeout(() => {
      setWallets(detectWallets());
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleConnect = async (walletId: string) => {
    setConnecting(true);
    setError(null);
    try {
      const wallet = await connectWallet(walletId);
      setConnected(wallet);
      setShowDropdown(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(null);
  };

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
          background: "rgba(45, 182, 124, 0.1)",
          color: "var(--color-brand)",
          fontWeight: 600,
        }}>
          Mainnet
        </span>

        {/* Wallet connect */}
        {connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-secondary)",
            }}>
              {lovelaceToAda(connected.balance)} ADA
            </span>
            <button
              onClick={handleDisconnect}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
                fontWeight: 500,
              }}
            >
              {connected.info.icon && (
                <img
                  src={connected.info.icon}
                  alt=""
                  width={16}
                  height={16}
                  style={{ borderRadius: 4 }}
                />
              )}
              {connected.stakeAddress.slice(0, 8)}...{connected.stakeAddress.slice(-4)}
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={connecting}
              style={{
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-brand)",
                color: "#fff",
                fontWeight: 600,
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>

            {showDropdown && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 240,
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: 8,
                zIndex: 200,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}>
                {wallets.length === 0 ? (
                  <div style={{
                    padding: "16px 12px",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--color-text-muted)",
                  }}>
                    No Cardano wallets detected.<br />
                    <span style={{ fontSize: 12 }}>
                      Install Nami, Eternl, or Lace.
                    </span>
                  </div>
                ) : (
                  wallets.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleConnect(w.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        fontSize: 14,
                        color: "var(--color-text-primary)",
                        background: "transparent",
                        textAlign: "left",
                      }}
                    >
                      {w.icon && (
                        <img
                          src={w.icon}
                          alt=""
                          width={20}
                          height={20}
                          style={{ borderRadius: 4 }}
                        />
                      )}
                      {w.name}
                    </button>
                  ))
                )}
                {error && (
                  <div style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--color-negative)",
                  }}>
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
