import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

/**
 * Global 404 — branded dark page rendered inside the root layout, so it
 * inherits the near-black body background (no white flash). Styling mirrors
 * EmptyState: elevated card, brand-soft icon well, brand + outlined CTAs.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "56px 40px",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <BrandLogo size={28} />
        <div
          style={{
            marginTop: 16,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            fontFamily: "var(--font-mono)",
            color: "var(--color-brand)",
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.4,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          404 — this pool doesn&apos;t exist.
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            maxWidth: 340,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          The page you&apos;re after was never minted, or its link has rugged.
          Everything liquid lives on the screener.
        </p>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link
            href="/screener"
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 20px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-brand)",
              color: "#001A0E",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Open the screener
          </Link>
          <Link
            href="/"
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: "10px 20px",
              borderRadius: "var(--radius-md)",
              background: "transparent",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-text-secondary)",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
