export default function Home() {
  return (
    <div>
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        marginBottom: 8,
      }}>
        Dashboard
      </h1>
      <p style={{
        color: "var(--color-text-secondary)",
        fontSize: 14,
        marginBottom: 32,
      }}>
        Cardano market overview and portfolio summary.
      </p>

      {/* Placeholder cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}>
        <StatCard label="ADA Price" value="$—" change="" />
        <StatCard label="Market Cap" value="$—" change="" />
        <StatCard label="24h Volume" value="$—" change="" />
        <StatCard label="Active Wallets" value="—" change="" />
      </div>
    </div>
  );
}

function StatCard({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)",
      padding: 20,
    }}>
      <div style={{
        fontSize: 13,
        color: "var(--color-text-muted)",
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: "var(--color-text-primary)",
      }}>
        {value}
      </div>
      {change && (
        <div style={{
          fontSize: 13,
          color: change.startsWith("+") ? "var(--color-positive)" : "var(--color-negative)",
          marginTop: 4,
        }}>
          {change}
        </div>
      )}
    </div>
  );
}
