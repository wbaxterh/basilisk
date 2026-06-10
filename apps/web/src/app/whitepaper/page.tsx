import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { GITHUB_URL } from "../../lib/site";
import "./whitepaper.css";

export const metadata: Metadata = {
  title: "Whitepaper · Basilisk",
  description: "Basilisk MVP implementation plan + architecture decisions. Public engineering whitepaper for the Cardano analytics & agent-native trading layer.",
};

// Allow Next to regenerate at most once an hour in production
export const revalidate = 3600;

interface Doc {
  slug: string;
  title: string;
  body: string;
}

async function loadDocs(): Promise<{ plan: Doc; adrs: Doc[] }> {
  // /apps/web → ../../docs
  const docsRoot = path.resolve(process.cwd(), "../../docs");

  const planBody = await fs.readFile(path.join(docsRoot, "BASILISK_MVP_PLAN.md"), "utf8");
  const plan: Doc = { slug: "mvp-plan", title: "MVP Implementation Plan", body: planBody };

  const adrDir = path.join(docsRoot, "adr");
  const entries = await fs.readdir(adrDir);
  const adrFiles = entries
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  const adrs: Doc[] = await Promise.all(
    adrFiles.map(async (f) => {
      const body = await fs.readFile(path.join(adrDir, f), "utf8");
      const titleMatch = body.match(/^#\s+(.+)$/m);
      return {
        slug: f.replace(/\.md$/, ""),
        title: titleMatch?.[1] ?? f,
        body,
      };
    })
  );

  return { plan, adrs };
}

function MdImg(props: ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} alt={props.alt ?? ""} />;
}

const mdComponents = { img: MdImg };

export default async function WhitepaperPage() {
  const { plan, adrs } = await loadDocs();

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

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 32px 96px" }}>
        {/* Table of contents */}
        <aside style={{
          border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-elevated)", padding: 20, marginBottom: 40,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
            Contents
          </div>
          <ol style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 18, fontSize: 14 }}>
            <li><a href={`#${plan.slug}`} style={{ color: "var(--color-text-primary)" }}>{plan.title}</a></li>
            {adrs.map((adr, i) => (
              <li key={adr.slug}>
                <a href={`#${adr.slug}`} style={{ color: "var(--color-text-primary)" }}>
                  ADR-{String(i + 1).padStart(3, "0")} · {adr.title.replace(/^ADR[-\s]?\d+[:\s]+/i, "")}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        {/* Plan */}
        <article id={plan.slug} className="md">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{plan.body}</ReactMarkdown>
        </article>

        {/* ADRs */}
        {adrs.map((adr) => (
          <article key={adr.slug} id={adr.slug} className="md" style={{ marginTop: 72, paddingTop: 48, borderTop: "1px solid var(--color-border)" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{adr.body}</ReactMarkdown>
          </article>
        ))}

        <div style={{
          marginTop: 80, padding: 24, borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 14 }}>
            This whitepaper is generated from the live source files in the public repo.
            Latest version always at{" "}
            <a href={`${GITHUB_URL}/tree/main/docs`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>
              {GITHUB_URL.replace(/^https?:\/\//, "")}/docs
            </a>.
          </div>
          <Link href="/#waitlist" style={{
            display: "inline-block",
            padding: "10px 20px", borderRadius: "var(--radius-md)",
            background: "var(--color-brand)", color: "#001A0E",
            fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
          }}>
            REQUEST EARLY ACCESS
          </Link>
        </div>
      </div>
    </div>
  );
}
