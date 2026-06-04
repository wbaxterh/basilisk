import EmptyState from "../../components/EmptyState";

export default function ScreenerPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Market Screener
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Top tokens, biggest movers, trending, and new listings.
      </p>
      <EmptyState
        icon="🔍"
        title="Loading market data..."
        description="The screener will show a sortable table of all Cardano tokens with live prices, volume, market cap, and percentage changes."
      />
    </div>
  );
}
