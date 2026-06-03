export default function TokensPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Token Charts
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 32 }}>
        Live prices, OHLCV candles, and trade history for Cardano native tokens.
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
        Token chart with TradingView lightweight-charts will render here.
      </div>
    </div>
  );
}
