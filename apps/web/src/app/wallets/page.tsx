import EmptyState from "../../components/EmptyState";

export default function WalletsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Wallet Profiler
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Look up any Cardano address — holdings, activity, and smart-money signals.
      </p>
      <EmptyState
        icon="👛"
        title="Profile any wallet"
        description="Enter a stake address or payment address to see holdings, transaction history, DEX activity, and smart-money classification."
        action="Look Up Address"
      />
    </div>
  );
}
