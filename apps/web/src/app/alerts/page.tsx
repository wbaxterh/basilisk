export default function AlertsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Alerts
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 32 }}>
        Price alerts, whale moves, and balance change notifications.
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
        Sign in to create and manage alerts.
      </div>
    </div>
  );
}
