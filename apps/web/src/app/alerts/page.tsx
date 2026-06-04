import EmptyState from "../../components/EmptyState";

export default function AlertsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Alerts
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Price alerts, whale moves, and balance change notifications.
      </p>
      <EmptyState
        icon="🔔"
        title="No alerts configured"
        description="Set up price alerts, whale movement notifications, or balance change triggers. Get notified via email, Telegram, or Discord."
        action="Create Alert"
      />
    </div>
  );
}
