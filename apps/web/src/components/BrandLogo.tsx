import { useId } from "react";

/**
 * The one canonical Basilisk brand lockup — gradient diamond mark plus the
 * two-tone "Basi/lisk" wordmark. Every surface (landing, app sidebar,
 * /agents, whitepaper) renders THIS component so the logo stays
 * interchangeable; never inline a copy of the SVG again.
 *
 * The gradient id is scoped with useId so multiple instances on one page
 * (header + footer) don't collide on a document-global SVG id.
 */
export default function BrandLogo({
  size = 22,
  wordmark = true,
  wordmarkSize,
}: {
  /** Icon edge length in px. */
  size?: number;
  /** Render the "Basilisk" wordmark next to the icon. */
  wordmark?: boolean;
  /** Wordmark font size in px (defaults to ~0.8× the icon). */
  wordmarkSize?: number;
}) {
  const gradId = useId();
  const textSize = wordmarkSize ?? Math.round(size * 0.8);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.max(8, Math.round(size * 0.4)) }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{ display: "inline-block", filter: "drop-shadow(0 0 8px rgba(32,235,122,0.35))", flexShrink: 0 }}
        aria-label="Basilisk"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#20EB7A" />
            <stop offset="100%" stopColor="#16A35A" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="7" fill={`url(#${gradId})`} />
        <path d="M16 7 L25 16 L16 25 L7 16 Z" fill="#001A0E" />
      </svg>
      {wordmark && (
        <span
          style={{
            fontSize: textSize,
            fontWeight: 800,
            letterSpacing: -(textSize * 0.045),
            lineHeight: 1,
          }}
        >
          <span style={{ color: "var(--color-text-primary)" }}>Basi</span>
          <span style={{ color: "var(--color-brand)" }}>lisk</span>
        </span>
      )}
    </span>
  );
}
