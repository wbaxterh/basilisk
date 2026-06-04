import EmptyState from "../../components/EmptyState";

export default function TokensPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Token Charts
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Live prices, OHLCV candles, and trade history for Cardano native tokens.
      </p>
      <EmptyState
        icon="📈"
        title="Search for a token"
        description="Enter a token ticker or policy ID to view live charts with candlestick data, recent trades, and market statistics."
        action="Browse Tokens"
      />
    </div>
  );
}
