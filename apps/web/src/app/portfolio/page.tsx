import EmptyState from "../../components/EmptyState";

export default function PortfolioPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Portfolio
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Track your wallet holdings, net worth, and P&amp;L over time.
      </p>
      <EmptyState
        icon="💼"
        title="No wallets tracked"
        description="Connect your Cardano wallet or enter a stake address to see your holdings, value over time, and realized P&L."
        action="Connect Wallet"
      />
    </div>
  );
}
