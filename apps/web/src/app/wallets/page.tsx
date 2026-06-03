export default function WalletsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Wallet Profiler
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 32 }}>
        Look up any Cardano address — holdings, activity, and smart-money signals.
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
        Enter a stake address or payment address to profile.
      </div>
    </div>
  );
}
