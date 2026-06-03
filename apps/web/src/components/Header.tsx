"use client";

export default function Header() {
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

        {/* Connect wallet placeholder */}
        <button style={{
          fontSize: 13,
          padding: "8px 16px",
          borderRadius: "var(--radius-md)",
          background: "var(--color-brand)",
          color: "#fff",
          fontWeight: 600,
          transition: "opacity 0.15s",
        }}>
          Connect Wallet
        </button>
      </div>
    </header>
  );
}
