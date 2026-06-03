export default function PortfolioPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Portfolio
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 32 }}>
        Track your wallet holdings, net worth, and P&amp;L over time.
      </p>
      <div style={{
        background: "var(--color-bg-elevated)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        padding: 40,
        textAlign: "center",
        color: "var(--color-text-muted)",
        fontSize: 14,
      }}>
        Connect a wallet or enter a stake address to get started.
      </div>
    </div>
  );
}
