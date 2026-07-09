"use client";

/**
 * /agents — public marketing page for the Basilisk hosted MCP server.
 * Standalone layout (own sticky header + footer), not under the (app) group.
 */

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { APP_URL, DOCS_AGENTS_MCP_URL, GITHUB_URL } from "@/lib/site";

const MCP_URL = `${APP_URL}/api/mcp`;
const COVERAGE_CHIP = "DEX data: SundaeSwap + WingRiders via DexScreener";

/* ─── Connect snippets ────────────────────────────────────── */

const SNIPPET_CLAUDE_CODE = `claude mcp add --transport http basilisk ${MCP_URL}`;

const SNIPPET_CLAUDE_DESKTOP = `{
  "mcpServers": {
    "basilisk": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${MCP_URL}"]
    }
  }
}`;

const SNIPPET_CURSOR = `{
  "mcpServers": {
    "basilisk": {
      "url": "${MCP_URL}"
    }
  }
}`;

const CONNECT_TABS = [
  {
    id: "claude-code",
    label: "Claude Code",
    hint: "One command in any terminal",
    snippet: SNIPPET_CLAUDE_CODE,
    lang: "shell",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    hint: "claude_desktop_config.json",
    snippet: SNIPPET_CLAUDE_DESKTOP,
    lang: "json",
  },
  {
    id: "cursor",
    label: "Cursor",
    hint: ".cursor/mcp.json",
    snippet: SNIPPET_CURSOR,
    lang: "json",
  },
] as const;

/* ─── Tool reference ──────────────────────────────────────── */

const TOOLS: Array<{ name: string; desc: string; example: string }> = [
  {
    name: "search_tokens",
    desc: "Find Cardano native tokens by ticker or name — returns asset units, live price, volume, liquidity.",
    example: `{ "query": "SNEK" }`,
  },
  {
    name: "get_screener",
    desc: "Curated token screener: price, 1h/6h/24h change, volume, liquidity, buys vs sells — sortable.",
    example: `{ "sort": "gainers", "limit": 10 }`,
  },
  {
    name: "get_token",
    desc: "Full token detail: per-DEX pairs, supply, decimals, fingerprint, mint time, holder estimate.",
    example: `{ "asset": "279c909f…7a3f534e454b" }`,
  },
  {
    name: "get_wallet",
    desc: "Wallet intelligence: ADA balance, rewards, pool, holdings with USD values where priced.",
    example: `{ "address": "$wes" }`,
  },
  {
    name: "get_ada_price",
    desc: "ADA market snapshot: USD price, 24h change, market cap, volume. Source: CoinGecko.",
    example: `{}`,
  },
  {
    name: "get_chain_tip",
    desc: "Latest mainnet block, epoch, slot, and hash via Koios — a liveness and freshness check.",
    example: `{}`,
  },
];

/* ─── Demo transcript (canonical copy: scripts/agent-demo/demo.md) ── */

type DemoLine =
  | { kind: "phase"; num: number; label: string }
  | { kind: "msg"; agent: "SCOUT" | "TRADER"; text: string }
  | { kind: "tool"; agent: "SCOUT" | "TRADER"; call: string; result: string }
  | { kind: "note"; text: string };

const DEMO_LINES: DemoLine[] = [
  { kind: "phase", num: 1, label: "REQUEST" },
  {
    kind: "msg",
    agent: "TRADER",
    text: "Need one CNT candidate under $0.005 with real liquidity for a 500 ADA rotation. Justify it with live data.",
  },
  {
    kind: "tool",
    agent: "SCOUT",
    call: `get_screener({ sort: "volume", limit: 10 })`,
    result:
      `24 tokens · coverage: "SundaeSwap + WingRiders via DexScreener" · top by 24h vol: SNEK $412.8K, HOSKY $88.1K, WMTX $61.4K …`,
  },
  {
    kind: "tool",
    agent: "SCOUT",
    call: `get_token({ asset: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b" })`,
    result:
      "SNEK · $0.00315 · +4.2% 24h · liquidity $2.41M across 6 pairs · buys 1,842 / sells 1,506 · holders ≈ 41,400",
  },
  { kind: "phase", num: 2, label: "NEGOTIATE" },
  {
    kind: "msg",
    agent: "SCOUT",
    text: "Proposing SNEK. A 500 ADA clip is under 0.02% of pooled liquidity on the covered DEXes — negligible impact. Buy/sell ratio 1.22 over 24h.",
  },
  {
    kind: "msg",
    agent: "TRADER",
    text: "How fresh is that read, and what is 500 ADA in USD right now?",
  },
  {
    kind: "tool",
    agent: "SCOUT",
    call: "get_chain_tip()",
    result: "block 13,644,102 · epoch 641 · block_time 34s ago · coverage: Koios (Cardano mainnet)",
  },
  {
    kind: "tool",
    agent: "SCOUT",
    call: "get_ada_price()",
    result: "ADA $0.8700 · +1.9% 24h · coverage: CoinGecko (CEX + DEX)",
  },
  {
    kind: "msg",
    agent: "SCOUT",
    text: "Chain tip is 34 seconds old — data is current. 500 ADA ≈ $435 → target fill ≈ 138,000 SNEK at $0.00315.",
  },
  { kind: "phase", num: 3, label: "TRANSACT" },
  {
    kind: "tool",
    agent: "TRADER",
    call: `get_wallet({ address: "$fund-ops" })`,
    result: "stake1u9x…q4lz · 12,480 ADA · rewards 41.2 ADA · 17 holdings · total ≈ $11,930",
  },
  {
    kind: "msg",
    agent: "TRADER",
    text: "Balance confirmed. Composing swap intent: 500 ADA → min 136,600 SNEK (1% slippage) on the deepest SundaeSwap pair. Emitting UNSIGNED transaction for approval.",
  },
  {
    kind: "note",
    text: "Execution stops here by design: the intent is an unsigned transaction. A human approves signing in their own wallet — Basilisk never holds keys.",
  },
  { kind: "phase", num: 4, label: "EVALUATE" },
  {
    kind: "tool",
    agent: "SCOUT",
    call: `get_token({ asset: "279c909f…534e454b" })`,
    result: "SNEK · $0.00317 · liquidity $2.41M · re-check scheduled vs entry $0.00315",
  },
  {
    kind: "msg",
    agent: "SCOUT",
    text: "Logged: entry thesis, coverage caveat (SundaeSwap + WingRiders only), and a 24h re-evaluation. Session complete.",
  },
];

/* ─── Roadmap ─────────────────────────────────────────────── */

interface RoadmapTier {
  status: string;
  color: string;
  bg: string;
  border: string;
  items: Array<{ title: string; detail: string }>;
}

const ROADMAP: RoadmapTier[] = [
  {
    status: "LIVE",
    color: "var(--color-positive)",
    bg: "rgba(32,235,122,0.08)",
    border: "rgba(32,235,122,0.25)",
    items: [
      {
        title: "Hosted MCP server",
        detail: "Six tools over streamable HTTP at /api/mcp. No key, no payment — connect and query.",
      },
      {
        title: "Free public /api/v1",
        detail: "The same data as REST. TapTools' API had no free tier ($9–199/mo, now shut down); Basilisk starts free.",
      },
      {
        title: "Screener, token & wallet data",
        detail: "Live prices, liquidity, holders, wallet holdings — SundaeSwap + WingRiders via DexScreener, on-chain via Koios.",
      },
    ],
  },
  {
    status: "IN DEVELOPMENT",
    color: "var(--color-warning)",
    bg: "rgba(255,193,7,0.08)",
    border: "rgba(255,193,7,0.25)",
    items: [
      {
        title: "x402 pay-per-query",
        detail: "Metered premium queries via Masumi Network's community x402-cardano facilitator — currently at testnet proof-of-concept stage.",
      },
      {
        title: "Watchlists & alerts for agents",
        detail: "Persistent agent watchlists and threshold alerts delivered through MCP.",
      },
    ],
  },
  {
    status: "RESEARCH",
    color: "var(--color-info)",
    bg: "rgba(112,236,253,0.08)",
    border: "rgba(112,236,253,0.25)",
    items: [
      {
        title: "Autonomous settlement",
        detail: "Agent-to-agent settlement with Masumi identity and Charli3 oracle verification. Research track — not live, not on mainnet.",
      },
    ],
  },
];

/* ─── Page ────────────────────────────────────────────────── */

export default function AgentsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-primary)" }}>
      <AgentsTopBar />
      <Hero />
      <ConnectSection />
      <ToolsSection />
      <TranscriptSection />
      <RoadmapSection />
      <WhyNowSection />
      <PageFooter />
    </div>
  );
}

/* ─── Header / footer ─────────────────────────────────────── */

function AgentsTopBar() {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      borderBottom: "1px solid var(--color-border)",
      background: "rgba(0,0,0,0.7)", backdropFilter: "saturate(180%) blur(14px)",
      WebkitBackdropFilter: "saturate(180%) blur(14px)",
    }}>
      <div style={{
        maxWidth: "var(--container-max)", margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 32px", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center" }}>
            <BrandLogo size={22} wordmarkSize={17} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <TopLink href="/dashboard">Dashboard</TopLink>
            <TopLink href="/screener">Screener</TopLink>
            <TopLink href={DOCS_AGENTS_MCP_URL} external>Docs</TopLink>
          </div>
        </div>
        <a href="#connect" style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 0.3, padding: "8px 14px",
          borderRadius: "var(--radius-md)", background: "var(--color-brand)", color: "#001A0E",
        }}>
          CONNECT CLAUDE
        </a>
      </div>
    </nav>
  );
}

function TopLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>
      {children}
    </Link>
  );
}


function PageFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
      <div style={{
        maxWidth: "var(--container-max)", margin: "0 auto", padding: "28px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandLogo size={22} wordmark={false} />
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Basilisk — Cardano analytics for humans & agents
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--color-text-muted)", flexWrap: "wrap" }}>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href={DOCS_AGENTS_MCP_URL} target="_blank" rel="noopener noreferrer">MCP Docs</a>
          <a href={`${APP_URL}/api/v1`} target="_blank" rel="noopener noreferrer">API</a>
          <Link href="/whitepaper">Whitepaper</Link>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Shared bits ─────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
      color: "var(--color-text-muted)", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function CoverageChip() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "4px 10px", borderRadius: 999,
      border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
      fontSize: 11, color: "var(--color-text-secondary)", letterSpacing: 0.3,
      fontFamily: "var(--font-mono)",
    }}>
      <IconDatabase />
      {COVERAGE_CHIP}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — no-op
    }
  };
  return (
    <button
      onClick={onCopy}
      aria-label="Copy to clipboard"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px", borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        background: copied ? "var(--color-brand-soft)" : "var(--color-bg-tile)",
        color: copied ? "var(--color-brand)" : "var(--color-text-secondary)",
        fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
        transition: "all 120ms", cursor: "pointer",
      }}
    >
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

/* ─── 1. Hero ─────────────────────────────────────────────── */

function Hero() {
  return (
    <section style={{ borderBottom: "1px solid var(--color-border)", position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: -220, left: "50%", transform: "translateX(-50%)",
        width: 960, height: 620,
        background: "radial-gradient(ellipse at center, rgba(32,235,122,0.10) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "84px 32px 64px", position: "relative" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 999,
          border: "1px solid rgba(32,235,122,0.25)", background: "var(--color-brand-soft)",
          fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: "var(--color-brand)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--color-brand)", boxShadow: "0 0 8px var(--color-brand)" }} />
          THE HOSTED MCP SERVER FOR CARDANO MARKET DATA
        </span>

        <h1 style={{
          fontSize: 58, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2.2,
          margin: "22px 0 18px", maxWidth: 840,
        }}>
          Your agents already have<br />a <span style={{ color: "var(--color-brand)" }}>Cardano terminal</span>.
        </h1>

        <p style={{ fontSize: 17, color: "var(--color-text-secondary)", maxWidth: 640, lineHeight: 1.55, marginBottom: 34 }}>
          Basilisk is — to our knowledge — the first hosted MCP server for Cardano market
          data: screener, token analytics, wallet intelligence. Free, live now.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <a href="#connect" style={{
            fontSize: 13, fontWeight: 700, letterSpacing: 0.3, padding: "12px 22px",
            borderRadius: "var(--radius-md)", background: "var(--color-brand)", color: "#001A0E",
          }}>
            CONNECT CLAUDE
          </a>
          <a href={DOCS_AGENTS_MCP_URL} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 13, fontWeight: 600, padding: "12px 22px",
            borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-strong)",
            color: "var(--color-text-primary)", background: "var(--color-bg-elevated)",
          }}>
            Read the docs
          </a>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            {MCP_URL.replace(/^https?:\/\//, "")}
          </span>
        </div>

        <div style={{ marginTop: 26 }}>
          <CoverageChip />
        </div>
      </div>
    </section>
  );
}

/* ─── 2. Connect block ────────────────────────────────────── */

function ConnectSection() {
  const [active, setActive] = useState<(typeof CONNECT_TABS)[number]["id"]>("claude-code");
  const tab = CONNECT_TABS.find((t) => t.id === active) ?? CONNECT_TABS[0];

  return (
    <section id="connect" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "64px 32px" }}>
        <SectionLabel>Connect in 30 seconds</SectionLabel>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.3, lineHeight: 1.12, marginBottom: 12, maxWidth: 720 }}>
          One URL. No API key. No signup.
        </h2>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", maxWidth: 620, lineHeight: 1.55, marginBottom: 28 }}>
          Point any MCP client at the endpoint and six Cardano data tools appear in your agent&apos;s toolbox.
        </p>

        <div style={{
          maxWidth: 780, background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden",
        }}>
          {/* Tab pills */}
          <div style={{
            display: "flex", gap: 4, padding: 8, borderBottom: "1px solid var(--color-border)",
            flexWrap: "wrap", alignItems: "center",
          }}>
            {CONNECT_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                style={{
                  padding: "7px 14px", borderRadius: "var(--radius-md)",
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                  background: t.id === active ? "var(--color-bg-hover)" : "transparent",
                  color: t.id === active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  border: t.id === active ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                  transition: "all 120ms", cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-muted)", paddingRight: 6 }}>
              {tab.hint}
            </span>
          </div>

          {/* Code body */}
          <div style={{ position: "relative", padding: "18px 20px", background: "var(--color-bg-secondary)" }}>
            <div style={{ position: "absolute", top: 12, right: 12 }}>
              <CopyButton text={tab.snippet} />
            </div>
            <pre style={{
              margin: 0, fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.7,
              whiteSpace: "pre-wrap", wordBreak: "break-all",
              color: "var(--color-text-primary)", paddingRight: 84,
            }}>
              {tab.lang === "shell" ? (
                <>
                  <span style={{ color: "var(--color-text-muted)" }}>$ </span>
                  <span>{tab.snippet}</span>
                </>
              ) : (
                <TintedJson code={tab.snippet} />
              )}
            </pre>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 14, maxWidth: 780 }}>
          Streamable HTTP transport. Prefer plain REST? The same data is free at{" "}
          <a href={`${APP_URL}/api/v1`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)", fontFamily: "var(--font-mono)" }}>
            {APP_URL.replace(/^https?:\/\//, "")}/api/v1
          </a>.
        </p>
      </div>
    </section>
  );
}

/** Minimal JSON syntax tint: keys brand-dim, strings info, punctuation muted. */
function TintedJson({ code }: { code: string }) {
  const parts = code.split(/("(?:[^"\\]|\\.)*")/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^".*"$/.test(part)) {
          const rest = parts.slice(i + 1).join("");
          const isKey = /^\s*:/.test(rest);
          return (
            <span key={i} style={{ color: isKey ? "var(--color-brand)" : "var(--color-info)" }}>
              {part}
            </span>
          );
        }
        return (
          <span key={i} style={{ color: "var(--color-text-muted)" }}>
            {part}
          </span>
        );
      })}
    </>
  );
}

/* ─── 3. Tool reference grid ──────────────────────────────── */

function ToolsSection() {
  return (
    <section style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "64px 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <SectionLabel>Tool reference</SectionLabel>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.3, lineHeight: 1.12 }}>
              Six tools, zero setup.
            </h2>
          </div>
          <CoverageChip />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
        }}>
          {TOOLS.map((tool) => (
            <div key={tool.name} style={{
              background: "var(--color-bg-tile)", border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)", padding: "18px 18px 16px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--color-brand)", display: "inline-flex" }}><IconTool /></span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {tool.name}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55, margin: 0, flex: 1 }}>
                {tool.desc}
              </p>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-text-muted)",
                background: "var(--color-bg-secondary)", border: "1px solid var(--color-border-soft)",
                borderRadius: "var(--radius-sm)", padding: "6px 9px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {tool.example}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 4. Agent-to-agent transcript ────────────────────────── */

const PHASE_COLORS: Record<number, string> = {
  1: "var(--color-info)",
  2: "var(--color-warning)",
  3: "var(--color-brand)",
  4: "var(--color-text-secondary)",
};

function TranscriptSection() {
  return (
    <section style={{ borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "64px 32px" }}>
        <SectionLabel>Agent-to-agent trading, replayable</SectionLabel>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.3, lineHeight: 1.12, marginBottom: 12, maxWidth: 760 }}>
          Scout finds it. Trader sizes it.<br />A human signs it.
        </h2>
        <p style={{ fontSize: 15, color: "var(--color-text-secondary)", maxWidth: 680, lineHeight: 1.55, marginBottom: 24 }}>
          Two Claude agents sharing one Basilisk MCP connection walk the full Request → Negotiate →
          Transact → Evaluate loop — the same phase vocabulary used by agent commerce protocols.
          Every tool call below is a real Basilisk tool you can run right now.
        </p>

        <div style={{
          maxWidth: 880, background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden",
        }}>
          {/* Terminal chrome */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
            borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
            flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#FF422B", "#FFC107", "#20EB7A"].map((c) => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: 5, background: c, opacity: 0.75 }} />
              ))}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-text-muted)" }}>
              scout × trader — basilisk mcp session
            </span>
            <span style={{
              marginLeft: "auto", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
              padding: "3px 9px", borderRadius: 3,
              background: "rgba(255,193,7,0.08)", border: "1px solid rgba(255,193,7,0.25)",
              color: "var(--color-warning)",
            }}>
              ILLUSTRATIVE SESSION · REPRODUCE IT YOURSELF — THE TOOLS ARE LIVE
            </span>
          </div>

          {/* Transcript body */}
          <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
            {DEMO_LINES.map((line, i) => {
              if (line.kind === "phase") {
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: i === 0 ? 0 : 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: 1,
                      padding: "3px 9px", borderRadius: 3,
                      border: `1px solid ${PHASE_COLORS[line.num]}`,
                      color: PHASE_COLORS[line.num],
                      fontFamily: "var(--font-mono)",
                    }}>
                      PHASE {line.num} · {line.label}
                    </span>
                    <span style={{ flex: 1, height: 1, background: "var(--color-border-soft)" }} />
                  </div>
                );
              }
              if (line.kind === "tool") {
                return (
                  <div key={i} style={{ paddingLeft: 14, borderLeft: "2px solid var(--color-border)" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-brand)", wordBreak: "break-all" }}>
                      <span style={{ color: "var(--color-text-muted)" }}>{line.agent.toLowerCase()} ▸ </span>
                      {line.call}
                    </div>
                    <div style={{
                      fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-text-secondary)",
                      marginTop: 4, lineHeight: 1.6, wordBreak: "break-word",
                    }}>
                      <span style={{ color: "var(--color-text-muted)" }}>→ </span>
                      {line.result}
                    </div>
                  </div>
                );
              }
              if (line.kind === "note") {
                return (
                  <div key={i} style={{
                    fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.6,
                    background: "var(--color-brand-soft)", border: "1px solid rgba(32,235,122,0.25)",
                    borderRadius: "var(--radius-md)", padding: "10px 14px",
                  }}>
                    <span style={{ fontWeight: 700, color: "var(--color-brand)" }}>Human in the loop: </span>
                    {line.text}
                  </div>
                );
              }
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
                    color: line.agent === "SCOUT" ? "var(--color-info)" : "var(--color-brand)",
                    border: `1px solid ${line.agent === "SCOUT" ? "rgba(112,236,253,0.3)" : "rgba(32,235,122,0.3)"}`,
                    borderRadius: 3, padding: "2px 7px", marginTop: 1, flexShrink: 0,
                  }}>
                    {line.agent}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.6 }}>
                    {line.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 14, maxWidth: 880 }}>
          Reproduce it: the runbook and canonical transcript live in{" "}
          <a href={`${GITHUB_URL}/tree/main/scripts/agent-demo`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)", fontFamily: "var(--font-mono)" }}>
            scripts/agent-demo
          </a>{" "}
          — two Claude Code sessions, one MCP URL. Numbers above are illustrative; live values change with the market.
        </p>
      </div>
    </section>
  );
}

/* ─── 5. Roadmap ──────────────────────────────────────────── */

function RoadmapSection() {
  return (
    <section style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "64px 32px" }}>
        <SectionLabel>Roadmap — labeled honestly</SectionLabel>
        <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.3, lineHeight: 1.12, marginBottom: 28 }}>
          What&apos;s live, what&apos;s next, what&apos;s research.
        </h2>

        <div style={{
          border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
          overflow: "hidden", background: "var(--color-bg-tile)",
        }}>
          {ROADMAP.map((tier, ti) => (
            <div key={tier.status} style={{ borderTop: ti === 0 ? "none" : "1px solid var(--color-border)" }}>
              {tier.items.map((item, ii) => (
                <div key={item.title} style={{
                  display: "grid",
                  gridTemplateColumns: "170px minmax(160px, 1fr) minmax(240px, 2fr)",
                  gap: 16, padding: "16px 20px", alignItems: "start",
                  borderTop: ii === 0 ? "none" : "1px solid var(--color-border-soft)",
                }}>
                  <div>
                    {ii === 0 && (
                      <span style={{
                        display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                        padding: "3px 9px", borderRadius: 3,
                        background: tier.bg, border: `1px solid ${tier.border}`, color: tier.color,
                      }}>
                        {tier.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 14, maxWidth: 820, lineHeight: 1.6 }}>
          x402 is the emerging open standard for agent payments, governed by the x402 Foundation under
          the Linux Foundation (Coinbase, Cloudflare, AWS, Google members). Cardano support runs through
          Masumi Network&apos;s community x402-cardano facilitator and is at testnet proof-of-concept stage —
          nothing here implies autonomous mainnet trading.
        </p>
      </div>
    </section>
  );
}

/* ─── 6. Why now ──────────────────────────────────────────── */

function WhyNowSection() {
  const items = [
    {
      title: "TapTools shut down June 2026",
      desc: "Cardano's dominant analytics API is gone — taptools.io is a farewell page. Its API cost $9–199/mo and never had a free tier.",
    },
    {
      title: "Basilisk fills the vacuum, free",
      desc: "Screener, token, and wallet data — live today through a free public REST API and a hosted MCP server. No key, no invoice.",
    },
    {
      title: "Agent-native from day one",
      desc: "Built for the x402 era: the emerging open standard for agent payments, governed by the x402 Foundation under the Linux Foundation (Coinbase, Cloudflare, AWS, Google members).",
    },
  ];
  return (
    <section>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "64px 32px 72px" }}>
        <SectionLabel>Why Cardano, why now</SectionLabel>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {items.map((item, i) => (
            <div key={item.title} style={{
              background: "var(--color-bg-tile)", border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)", padding: "22px 20px",
            }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-brand)",
                marginBottom: 10, letterSpacing: 1,
              }}>
                0{i + 1}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 28, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-elevated)", padding: "18px 22px",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Give your agent a Cardano terminal.</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-secondary)", wordBreak: "break-all" }}>
            {SNIPPET_CLAUDE_CODE}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <CopyButton text={SNIPPET_CLAUDE_CODE} />
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── Icons (stroke only, no emoji) ───────────────────────── */

function IconCopy() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconTool() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function IconDatabase() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  );
}
