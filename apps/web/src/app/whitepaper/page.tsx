import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { GITHUB_URL } from "../../lib/site";
import { plan } from "./content.generated";
import "./whitepaper.css";

export const metadata: Metadata = {
  title: "Whitepaper · Basilisk",
  description: "Basilisk MVP implementation plan + architecture decisions. Public engineering whitepaper for the Cardano analytics & agent-native trading layer.",
};

// Whitepaper content is generated at build time from docs/ — see
// scripts/generate-whitepaper-content.mjs, wired as the `prebuild` script.

function MdImg(props: ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} alt={props.alt ?? ""} />;
}

const mdComponents = { img: MdImg };

export default function WhitepaperPage() {
  return (
    <div style={{ background: "var(--color-bg-primary)", minHeight: "100vh" }}>
      {/* Mini nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid var(--color-border)",
        background: "rgba(0,0,0,0.7)", backdropFilter: "saturate(180%) blur(14px)",
        WebkitBackdropFilter: "saturate(180%) blur(14px)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 32px",
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <svg width="22" height="22" viewBox="0 0 32 32" style={{ display: "inline-block", filter: "drop-shadow(0 0 8px rgba(32,235,122,0.35))" }} aria-label="Basilisk">
              <defs>
                <linearGradient id="basiliskGradWp" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#20EB7A" />
                  <stop offset="100%" stopColor="#16A35A" />
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="30" height="30" rx="7" fill="url(#basiliskGradWp)" />
              <path d="M16 7 L25 16 L16 25 L7 16 Z" fill="#001A0E" />
            </svg>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.5 }}>Basilisk</span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", letterSpacing: 1, marginLeft: 8, paddingLeft: 8, borderLeft: "1px solid var(--color-border)" }}>
              WHITEPAPER
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
            <Link href="/" style={{ color: "var(--color-text-secondary)" }}>← Back to site</Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-text-secondary)" }}
            >
              View on GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header style={{ borderBottom: "1px solid var(--color-border)", position: "relative", overflow: "hidden" }}>
        <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none" }} />
        <div style={{
          position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)",
          width: 900, height: 500, background: "radial-gradient(ellipse at center, rgba(32,235,122,0.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "72px 32px 56px", position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 11px", borderRadius: 999,
            border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
            fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: "var(--color-text-secondary)",
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--color-brand)", boxShadow: "0 0 8px var(--color-brand)" }} />
            PUBLIC ENGINEERING DOC · v0.1 · 2026
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.8, lineHeight: 1.1, marginBottom: 14 }}>
            The Basilisk Whitepaper
          </h1>
          <p style={{ fontSize: 17, color: "var(--color-text-secondary)", lineHeight: 1.55, marginBottom: 0, maxWidth: 680 }}>
            Architecture, scope, and roadmap for Basilisk — a Cardano analytics platform plus the first
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}> x402 agent-native </span>
            trading layer. This document is the working implementation plan; ADRs follow.
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 32px 96px" }}>
        <article id={plan.slug} className="md">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{plan.body}</ReactMarkdown>
        </article>

        <div style={{
          marginTop: 64, padding: 28, borderRadius: "var(--radius-lg)",
          border: "1px solid rgba(32,235,122,0.25)", background: "var(--color-brand-soft)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 6 }}>
            Convinced? Join the founding cohort.
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20, lineHeight: 1.55 }}>
            Wave-1 invites go to founding members. Pro free for six months. Alpha access to x402 + MCP. Direct line to the founders.
          </div>
          <Link href="/#top" style={{
            display: "inline-block",
            padding: "12px 24px", borderRadius: "var(--radius-md)",
            background: "var(--color-brand)", color: "#001A0E",
            fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
          }}>
            CLAIM YOUR SPOT →
          </Link>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 16 }}>
            Source on GitHub:{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>
              {GITHUB_URL.replace(/^https?:\/\//, "")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
