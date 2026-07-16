"use client";

/**
 * DexHunter swap widget wrapper.
 *
 * - The widget lib (@dexhunterio/swaps v2, ~2.5MB unpacked + heavy peers) is
 *   loaded via next/dynamic with ssr:false so it never enters the initial
 *   route JS — the token page additionally only mounts this component after
 *   an explicit user tap.
 * - Themed to the Basilisk palette through the widget's `colors` prop
 *   (keys per lib/main.d.ts: mainText/subText/background/containers/
 *   buttonText/accent).
 * - partnerCode comes from NEXT_PUBLIC_DEXHUNTER_PARTNER (empty-safe).
 * - Any load/render failure is caught by an error boundary that falls back
 *   to a deep link: app.dexhunter.io/swap?tokenIdSell=&tokenIdBuy={unit}.
 */

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";

export interface SwapWidgetProps {
  /** Cardano asset unit — policyId (56 hex) + assetName hex. */
  unit: string;
  symbol: string;
}

const PARTNER_CODE = process.env.NEXT_PUBLIC_DEXHUNTER_PARTNER ?? "";

export function dexhunterSwapUrl(unit: string): string {
  return `https://app.dexhunter.io/swap?tokenIdSell=&tokenIdBuy=${encodeURIComponent(unit)}`;
}

// ---------------------------------------------------------------------------
// Skeleton shown while the widget chunk streams in
// ---------------------------------------------------------------------------

function WidgetSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading trade widget"
      style={{
        height: 420,
        borderRadius: 8,
        border: "1px solid var(--color-border-soft)",
        background: "var(--color-bg-secondary)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
      }}
    >
      {[64, 64, 44].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            borderRadius: 8,
            background: "var(--color-bg-hover)",
            opacity: 0.55,
          }}
        />
      ))}
      <div
        style={{
          marginTop: "auto",
          fontSize: 10.5,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          fontWeight: 700,
          color: "var(--color-text-muted)",
          textAlign: "center",
        }}
      >
        Loading DexHunter…
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fallback — deep link out to app.dexhunter.io if the widget can't load
// ---------------------------------------------------------------------------

export function SwapFallback({ unit, symbol }: SwapWidgetProps) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid var(--color-border-soft)",
        background: "var(--color-bg-secondary)",
        padding: "22px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.55, maxWidth: 320 }}>
        The embedded trade widget couldn&apos;t load here. You can still route this swap through
        every Cardano DEX at once on DexHunter.
      </p>
      <a
        href={dexhunterSwapUrl(unit)}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 18px",
          borderRadius: 6,
          background: "var(--color-brand)",
          color: "#001A0E",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Trade {symbol} on DexHunter
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <path d="M15 3h6v6" />
          <path d="M10 14L21 3" />
        </svg>
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary — widget is third-party code; never let it take the page down
// ---------------------------------------------------------------------------

class WidgetErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[SwapWidget] DexHunter widget failed, showing fallback:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// The widget itself — lazy chunk, client-only (uses window/wallet APIs)
// ---------------------------------------------------------------------------

const DexHunterSwap = dynamic(
  async () => {
    // CSS rides along in the lazy chunk, not the route bundle.
    // @ts-expect-error — plain CSS side-effect import has no type declaration
    await import("@dexhunterio/swaps/lib/assets/style.css");
    return import("@dexhunterio/swaps");
  },
  { ssr: false, loading: () => <WidgetSkeleton /> }
);

/** Basilisk palette → DexHunter theme keys. */
const BASILISK_COLORS = {
  mainText: "#FFFFFF",
  subText: "#9898A1",
  background: "#15161A",
  containers: "#1C1E23",
  buttonText: "#001A0E",
  accent: "#20EB7A",
} as const;

export default function SwapWidget({ unit, symbol }: SwapWidgetProps) {
  return (
    <WidgetErrorBoundary fallback={<SwapFallback unit={unit} symbol={symbol} />}>
      <div style={{ minWidth: 0 }}>
        <DexHunterSwap
          partnerName="Basilisk"
          partnerCode={PARTNER_CODE}
          defaultTokenIn=""
          defaultTokenOut={unit}
          orderTypes={["SWAP", "LIMIT"]}
          theme="dark"
          colors={BASILISK_COLORS}
          width="100%"
        />
      </div>
    </WidgetErrorBoundary>
  );
}
