import Link from "next/link";

const PLANNED = [
  { label: "Price above / below", desc: "Threshold crossings on any indexed token" },
  { label: "24h % change", desc: "Momentum triggers on movers" },
  { label: "Wallet balance changes", desc: "Watch any addr1 / stake1 / $handle" },
];

const BellIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--color-brand)"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export default function AlertsPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Alerts</h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0 }}>
          Price alerts, whale moves, and balance change notifications.
        </p>
      </div>

      {/* Coming-with-accounts gate */}
      <div style={{
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "56px 40px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--color-brand-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}>
          {BellIcon}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Alerts are coming with accounts
        </h2>
        <p style={{
          fontSize: 14,
          color: "var(--color-text-secondary)",
          maxWidth: 440,
          margin: 0,
          lineHeight: 1.6,
        }}>
          Alert rules need somewhere to live and somewhere to notify you.
          Accounts are in development — join the waitlist and you&apos;ll be
          first in when they ship.
        </p>
        <Link
          href="/#waitlist"
          style={{
            marginTop: 10,
            display: "inline-block",
            padding: "10px 22px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-brand)",
            color: "#001A0E",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Join the waitlist
        </Link>

        {/* Planned rule types */}
        <div style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          width: "100%",
          maxWidth: 640,
        }}>
          {PLANNED.map((p) => (
            <div key={p.label} style={{
              background: "var(--color-bg-tile)",
              border: "1px solid var(--color-border-soft)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
              textAlign: "left",
            }}>
              <div style={{
                fontSize: 10,
                textTransform: "uppercase" as const,
                letterSpacing: 1,
                color: "var(--color-text-muted)",
                marginBottom: 6,
              }}>
                In development
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
