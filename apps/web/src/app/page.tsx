export default function Home() {
  return (
    <div>
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        marginBottom: 4,
      }}>
        Dashboard
      </h1>
      <p style={{
        color: "var(--color-text-secondary)",
        fontSize: 14,
        marginBottom: 24,
      }}>
        Cardano market overview and portfolio summary.
      </p>

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard label="ADA Price" value="$0.74" change="+2.3%" positive />
        <StatCard label="Market Cap" value="$26.1B" change="+1.8%" positive />
        <StatCard label="24h Volume" value="$412M" change="-5.1%" positive={false} />
        <StatCard label="Epoch" value="523" sublabel="3d 14h remaining" />
      </div>

      {/* Two-column layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}>
        {/* Top Movers */}
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Top Movers (24h)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TokenRow rank={1} name="MIN" price="0.0412" change="+18.4%" positive />
            <TokenRow rank={2} name="SUNDAE" price="0.0087" change="+12.1%" positive />
            <TokenRow rank={3} name="WRT" price="0.0231" change="+9.7%" positive />
            <TokenRow rank={4} name="LENFI" price="1.24" change="-6.2%" positive={false} />
            <TokenRow rank={5} name="SNEK" price="0.0034" change="-4.8%" positive={false} />
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{
          background: "var(--color-bg-elevated)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Network Activity
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ActivityRow label="Transactions (24h)" value="89,412" />
            <ActivityRow label="Active Addresses" value="42,891" />
            <ActivityRow label="DEX Volume (24h)" value="12.4M ADA" />
            <ActivityRow label="Total Value Locked" value="312M ADA" />
            <ActivityRow label="Avg Block Time" value="20.1s" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, change, sublabel, positive }: {
  label: string;
  value: string;
  change?: string;
  sublabel?: string;
  positive?: boolean;
}) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)",
      padding: "16px 20px",
      transition: "border-color 0.15s",
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 500,
        color: "var(--color-text-muted)",
        marginBottom: 8,
        textTransform: "uppercase" as const,
        letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{
          fontSize: 24,
          fontWeight: 700,
          color: "var(--color-text-primary)",
        }}>
          {value}
        </span>
        {change && (
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: positive ? "var(--color-positive)" : "var(--color-negative)",
          }}>
            {change}
          </span>
        )}
      </div>
      {sublabel && (
        <div style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginTop: 4,
        }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function TokenRow({ rank, name, price, change, positive }: {
  rank: number;
  name: string;
  price: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      borderRadius: "var(--radius-md)",
      background: "var(--color-bg-hover)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          width: 20,
          textAlign: "center" as const,
        }}>
          {rank}
        </span>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "var(--font-mono)",
        }}>
          {name}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-mono)",
        }}>
          {price} ADA
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: positive ? "var(--color-positive)" : "var(--color-negative)",
          minWidth: 60,
          textAlign: "right" as const,
        }}>
          {change}
        </span>
      </div>
    </div>
  );
}

function ActivityRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      borderRadius: "var(--radius-md)",
      background: "var(--color-bg-hover)",
    }}>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      <span style={{
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
      }}>
        {value}
      </span>
    </div>
  );
}
