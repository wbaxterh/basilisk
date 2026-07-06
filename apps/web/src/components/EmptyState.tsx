import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: string;
  /** Optional stroke-SVG icon node; falls back to a default wallet glyph. */
  svg?: ReactNode;
}

const DEFAULT_SVG = (
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
    <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13v4" />
    <path d="M3 5v13a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1" />
    <path d="M16 13.5h.01" />
  </svg>
);

export default function EmptyState({ title, description, action, svg }: EmptyStateProps) {
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
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: "var(--color-brand-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
      }}>
        {svg ?? DEFAULT_SVG}
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
          color: "#001A0E",
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
