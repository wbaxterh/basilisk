export default function ScreenerPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Market Screener
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 32 }}>
        Top tokens, biggest movers, trending, and new listings.
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
        Sortable token table with filters will render here.
      </div>
    </div>
  );
}
