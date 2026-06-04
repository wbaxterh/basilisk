interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: string;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)",
      borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)",
      padding: "60px 40px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "rgba(45, 182, 124, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        marginBottom: 4,
      }}>
        {icon}
      </div>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: "var(--color-text-primary)",
        margin: 0,
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: 14,
        color: "var(--color-text-muted)",
        maxWidth: 360,
        margin: 0,
        lineHeight: 1.5,
      }}>
        {description}
      </p>
      {action && (
        <button style={{
          marginTop: 8,
          fontSize: 13,
          fontWeight: 600,
          padding: "10px 20px",
          borderRadius: "var(--radius-md)",
          background: "var(--color-brand)",
          color: "#fff",
          cursor: "pointer",
          border: "none",
          transition: "opacity 0.15s",
        }}>
          {action}
        </button>
      )}
    </div>
  );
}
