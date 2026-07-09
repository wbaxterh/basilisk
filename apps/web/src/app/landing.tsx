"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { detectWallets, connectWallet, type WalletInfo } from "../lib/wallet";
import BrandLogo from "../components/BrandLogo";
import { APP_URL, GITHUB_URL } from "../lib/site";
import { fmtUsd, fmtPct } from "../lib/public-data";

/* ─── Data (server-cached via /api/v1 — no direct CoinGecko calls) ── */

interface AdaMarket {
  priceUsd: number;
  change24h: number | null;
  marketCap: number;
  volume24h: number;
}

interface MarketPayload {
  ada: AdaMarket | null;
  series: Array<[number, number]>;
}

const marketCache = new Map<number, MarketPayload>();

async function fetchMarket(days: number): Promise<MarketPayload> {
  const cached = marketCache.get(days);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/v1/market?days=${days}`, { cache: "no-store" });
    if (!res.ok) return { ada: null, series: [] };
    const data = await res.json();
    const out: MarketPayload = {
      ada: data.ada ?? null,
      series: (data.series ?? []) as Array<[number, number]>,
    };
    marketCache.set(days, out);
    return out;
  } catch {
    return { ada: null, series: [] };
  }
}

interface MoverRow {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24h: number | null;
}

async function fetchMovers(limit = 6): Promise<MoverRow[] | null> {
  try {
    const res = await fetch(`/api/v1/tokens`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const tokens = (data.tokens ?? []) as MoverRow[];
    return [...tokens]
      .filter((t) => t.change24h != null)
      .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
      .slice(0, limit);
  } catch {
    return null;
  }
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/* ─── Page ─────────────────────────────────────────────────── */

export default function LandingClient() {
  const [ada, setAda] = useState<AdaMarket | null>(null);
  const [marketLoaded, setMarketLoaded] = useState(false);

  useEffect(() => {
    fetchMarket(1).then((m) => {
      setAda(m.ada);
      setMarketLoaded(true);
    });
  }, []);

  return (
    <div id="top" style={{ minHeight: "100vh", background: "var(--color-bg-primary)" }}>
      <TopBar />

      {/* Hero */}
      <section style={{ borderBottom: "1px solid var(--color-border)", position: "relative", overflow: "hidden" }}>
        <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.6, pointerEvents: "none" }} />
        <div style={{
          position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)",
          width: 900, height: 600, background: "radial-gradient(ellipse at center, rgba(32,235,122,0.10) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />

        <div className="lp-hero-pad" style={{ maxWidth: "var(--container-max)", margin: "0 auto", position: "relative" }}>
          <PillBadge>
            <Dot /> LIVE · FREE PUBLIC API + MCP SERVER
          </PillBadge>

          <h1 className="lp-h1" style={{ fontWeight: 800, lineHeight: 1.05, margin: "20px 0 18px", maxWidth: 860 }}>
            TapTools is gone.<br />
            Basilisk is <span style={{ color: "var(--color-brand)" }}>live</span>.
          </h1>

          <p style={{
            fontSize: 17, color: "var(--color-text-secondary)", maxWidth: 640,
            lineHeight: 1.55, marginBottom: 32,
          }}>
            The Cardano terminal for humans <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>and AI agents</span> —
            real-time screener, token analytics, wallet intelligence. Free, open API, no NFT passes.
          </p>

          <div className="lp-cta-row">
            <Link href="/screener" style={{
              padding: "13px 24px", borderRadius: "var(--radius-md)",
              background: "var(--color-brand)", color: "#001A0E",
              fontWeight: 700, fontSize: 14, letterSpacing: 0.2, whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              Open the screener
              <IconArrowRight />
            </Link>
            <Link href="/agents" style={{
              padding: "12px 24px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-strong)", background: "var(--color-bg-elevated)",
              color: "var(--color-text-primary)", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap",
            }}>
              For agents →
            </Link>
          </div>

          {/* Trust row */}
          <div style={{
            marginTop: 22, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            fontSize: 12, color: "var(--color-text-muted)",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Dot /> Live data
            </span>
            <span>·</span>
            <span>SundaeSwap + WingRiders coverage</span>
            <span>·</span>
            <span>Built on community rails (Koios · DexScreener)</span>
          </div>
        </div>

        {/* Live market strip */}
        <MarketStrip ada={ada} loaded={marketLoaded} />
      </section>

      {/* Live Cardano market — real data */}
      <section className="lp-section-pad" style={{ maxWidth: "var(--container-max)", margin: "0 auto", paddingTop: 56, paddingBottom: 56 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
          <div>
            <SectionLabel>Live · Cardano market</SectionLabel>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 4 }}>
              This is the product. It&apos;s already running.
            </h2>
          </div>
          <CoverageChip />
        </div>
        <div className="lp-market-grid">
          <ChartTile ada={ada} />
          <MoversTile />
        </div>
      </section>

      {/* Successor section */}
      <section id="successor" style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
        <div className="lp-section-pad" style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <SectionLabel>01 / The successor</SectionLabel>
          <SectionHead
            title={<>What happened to <span style={{ color: "var(--color-text-muted)" }}>TapTools</span>?</>}
            desc="TapTools shut down in June 2026 and taptools.io is now a farewell page. Cardano lost its main analytics terminal overnight. Basilisk rebuilt the essentials on sustainable rails — free screener, free token analytics, free wallet lookup, free API, and a hosted MCP server — agent-native from day one."
          />

          <div className="lp-table-wrap" style={{
            marginTop: 36, border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-elevated)", overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th style={thStyle}></th>
                  <th style={thStyle}>TapTools</th>
                  <th style={{ ...thStyle, color: "var(--color-brand)" }}>Basilisk</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow label="API access" a="$9–199 / mo" b="Free" />
                <CompareRow label="Premium gating" a="Tappy NFT passes" b="No NFT passes" />
                <CompareRow label="Source" a="Closed" b="Open source" />
                <CompareRow label="Agent interface" a="—" b="MCP server + open REST API" />
                <CompareRow
                  label="Status"
                  a="Shut down June 2026"
                  b="Live"
                  aColor="var(--color-negative)"
                  bColor="var(--color-brand)"
                  last
                />
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6, maxWidth: 640 }}>
            TapTools set the bar for Cardano analytics for years — this is a rebuild of what the ecosystem
            lost, not a victory lap. DEX aggregates currently cover SundaeSwap + WingRiders via DexScreener.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="lp-section-pad" style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <SectionLabel>02 / Platform</SectionLabel>
          <SectionHead
            title="Everything free. Everything live."
            desc="No paywalls on data. The screener, token pages, wallet lookup, public API, and MCP server are all running right now — open a tab and check."
          />

          <div className="lp-feature-grid" style={{
            marginTop: 40, background: "var(--color-border)",
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden",
          }}>
            <Feature
              title="Market screener"
              status="live"
              href="/screener"
              desc="Price, 24h change, volume, liquidity, and buy/sell pressure across covered DEX pairs. Sortable, filterable, no login."
              icon={IconScreener}
            />
            <Feature
              title="Token analytics"
              status="live"
              href="/screener"
              desc="Per-token pages: live chart, market data, pair breakdown, supply, holders. Linked straight from the screener."
              icon={IconChart}
            />
            <Feature
              title="Wallet intelligence"
              status="live"
              href="/portfolio"
              desc="Look up any Cardano address — holdings, balances, and token positions. No account required."
              icon={IconWallet}
            />
            <Feature
              title="Free public API"
              status="live"
              href="/agents"
              desc="REST endpoints under /api/v1 — tokens, market, wallets, search. TapTools charged $9–199/mo for API access. Ours is free."
              icon={IconCode}
            />
            <Feature
              title="Hosted MCP server"
              status="live"
              href="/agents"
              desc="Claude and any MCP-capable agent can query Cardano market data through a standard tool interface. One command to add."
              icon={IconBot}
            />
            <Feature
              title="Alerts & watchlists"
              status="coming"
              desc="Price and move thresholds routed to email, Telegram, or webhooks. Shipping with Pro — in development."
              icon={IconBell}
            />
          </div>
        </div>
      </section>

      {/* Agents section */}
      <section id="agents" style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
        <div className="lp-section-pad" style={{ maxWidth: "var(--container-max)", margin: "0 auto", paddingTop: 88, paddingBottom: 88 }}>
          <SectionLabel>
            <span style={{ color: "var(--color-info)" }}>03 / Agents</span>
          </SectionLabel>
          <SectionHead
            title={<>Agents are <span style={{ color: "var(--color-brand)" }}>first-class citizens</span>.</>}
            desc="Basilisk isn't a human dashboard with an API bolted on. Every surface — screener, token data, wallet lookup — is reachable by an AI agent today, through free REST endpoints and a hosted MCP server."
          />

          <div className="lp-grid-3" style={{ marginTop: 40 }}>
            <Agent
              tag="Live"
              live
              title="Hosted MCP server"
              desc="Model Context Protocol over HTTP. Claude, and any MCP-capable client, can query Cardano market data with zero setup beyond one command."
            />
            <Agent
              tag="Live"
              live
              title="Free REST API"
              desc="Open /api/v1 endpoints for tokens, market snapshots, wallets, and search. No key, no account, no rate-card. Build bots and dashboards on it."
            />
            <Agent
              tag="In development"
              title="x402 pay-per-query"
              desc="Machine-payable premium endpoints via x402 — targeted through Masumi Network's community x402-cardano facilitator, currently at testnet proof-of-concept stage."
            />
          </div>

          <CodeTabs />

          <p style={{ marginTop: 18, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.65, maxWidth: 720 }}>
            Roadmap: x402 is the emerging open standard for agent payments, governed by the x402 Foundation
            under the Linux Foundation (Coinbase, Cloudflare, AWS, and Google are members). Cardano support is
            in development via Masumi Network&apos;s community x402-cardano facilitator (testnet PoC). Live trades
            feed and autonomous settlement are research-stage.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="lp-section-pad" style={{ maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <SectionLabel>04 / Pricing</SectionLabel>
          <SectionHead
            title="Free today. Pro when it earns it."
            desc="Everything you can see and query right now costs nothing. Pro adds the power tools when they ship."
          />

          <div className="lp-grid-3" style={{ marginTop: 32 }}>
            <PriceCard
              tier="Free"
              price="$0"
              cadence="forever"
              note="LIVE NOW"
              perks={["Market screener", "Token analytics", "Wallet lookup", "Public /api/v1 REST API", "Hosted MCP server"]}
            />
            <PriceCard
              tier="Pro"
              price="$19"
              cadence="/ month"
              highlight
              note="COMING"
              perks={["Everything in Free", "Price & move alerts", "Watchlists", "Multi-wallet tracking", "Priority support"]}
            />
            <PriceCard
              tier="Agents"
              price="x402"
              cadence="pay per query"
              note="IN DEVELOPMENT"
              perks={["Machine-payable endpoints", "No account, no API key", "Via Masumi x402-cardano facilitator", "Testnet proof-of-concept stage"]}
            />
          </div>

          {/* Founding member waitlist */}
          <div style={{
            marginTop: 40, padding: "28px 28px", borderRadius: "var(--radius-lg)",
            border: "1px solid rgba(32,235,122,0.25)", background: "var(--color-brand-soft)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--color-brand)", marginBottom: 10 }}>
              Founding members
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
              Get Pro free for 6 months when it ships.
            </h3>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.6, maxWidth: 560, marginBottom: 20 }}>
              Join the founding cohort and lock in six months of Pro on the house — alerts, watchlists,
              multi-wallet tracking — the day it launches. Connecting a Cardano wallet reserves a verified seat.
            </p>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
        <div style={{ padding: "96px 24px", maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(28px, 6vw, 40px)", fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 14 }}>
            The terminal is <span style={{ color: "var(--color-brand)" }}>already open</span>.
          </h2>
          <p style={{ fontSize: 16, color: "var(--color-text-secondary)", marginBottom: 28, lineHeight: 1.55 }}>
            No waitlist for the product — it&apos;s live. The waitlist is only for founding-member Pro perks.
          </p>
          <div className="lp-cta-row" style={{ justifyContent: "center" }}>
            <Link href="/screener" style={{
              padding: "13px 24px", borderRadius: "var(--radius-md)",
              background: "var(--color-brand)", color: "#001A0E",
              fontWeight: 700, fontSize: 14, letterSpacing: 0.2,
            }}>
              Open the screener
            </Link>
            <a href="#pricing" style={{
              padding: "12px 24px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border-strong)", background: "var(--color-bg-elevated)",
              color: "var(--color-text-primary)", fontWeight: 600, fontSize: 14,
            }}>
              Claim founding perks
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ─── Waitlist (founding-member capture) ──────────────────── */

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);

  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [showWallets, setShowWallets] = useState(false);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);

  const postSignup = async (payload: { email?: string; walletAddr?: string }) => {
    if (!payload.email && !payload.walletAddr) {
      setError("Enter an email or connect a wallet first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setPosition(data.data?.position ?? 0);
        setSubmitted(true);
      } else {
        let msg = "Couldn't join the list — please try again.";
        try {
          const body = await res.json();
          if (body?.error && typeof body.error === "string") msg = body.error;
        } catch {
          // keep default message
        }
        setError(msg);
      }
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnect = async (id: string) => {
    setWalletErr(null);
    try {
      const w = await connectWallet(id);
      setWalletAddr(w.changeAddress);
      setShowWallets(false);
      await postSignup({ email: email || undefined, walletAddr: w.changeAddress });
    } catch (e) {
      setWalletErr(e instanceof Error ? e.message : "Could not connect wallet");
    }
  };

  if (submitted) {
    return (
      <div style={{
        padding: "16px 18px", borderRadius: "var(--radius-md)", maxWidth: 520,
        background: "var(--color-bg-elevated)", border: "1px solid rgba(32,235,122,0.25)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{
          width: 32, height: 32, borderRadius: 16, background: "var(--color-brand)", flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#001A0E",
        }}>
          <IconCheck />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-brand)" }}>You&apos;re on the list.</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
            {position > 0
              ? <>Position <span style={{ fontFamily: "var(--font-mono)" }}>#{position.toLocaleString()}</span> · We&apos;ll email when Pro opens.</>
              : "We'll email when Pro opens."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="waitlist" style={{ maxWidth: 520 }}>
      <div style={{
        display: "flex", gap: 0, width: "100%",
        border: `1px solid ${error ? "rgba(255,66,43,0.5)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg-elevated)", overflow: "hidden",
        transition: "border-color 120ms",
      }}>
        <input
          type="email"
          placeholder="you@protocol.xyz"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && postSignup({ email: email || undefined, walletAddr: walletAddr || undefined })}
          style={{
            flex: 1, minWidth: 0, padding: "12px 14px", background: "transparent",
            border: "none", color: "var(--color-text-primary)",
            fontSize: 14, fontFamily: "inherit", outline: "none",
          }}
        />
        <button
          onClick={() => postSignup({ email: email || undefined, walletAddr: walletAddr || undefined })}
          disabled={submitting}
          style={{
            padding: "0 22px", background: "var(--color-brand)", color: "#001A0E",
            fontWeight: 700, fontSize: 13, letterSpacing: 0.2, whiteSpace: "nowrap",
            opacity: submitting ? 0.6 : 1, transition: "opacity 120ms",
            borderRadius: 0,
          }}
        >
          {submitting ? "JOINING…" : "JOIN WAITLIST"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-negative)", display: "flex", alignItems: "center", gap: 6 }}>
          <IconAlert />
          {error}
        </div>
      )}

      {/* Wallet connect (optional priority) */}
      <div style={{ marginTop: 12 }}>
        {walletAddr ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-secondary)", flexWrap: "wrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--color-brand)", boxShadow: "0 0 8px var(--color-brand)" }} />
            Wallet linked: <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>{shortAddr(walletAddr)}</span>
            <button onClick={() => setWalletAddr(null)} style={{ fontSize: 11, color: "var(--color-text-muted)", textDecoration: "underline" }}>
              unlink
            </button>
          </div>
        ) : showWallets ? (
          <div style={{
            display: "flex", flexDirection: "column", gap: 4, padding: 8,
            border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
            background: "var(--color-bg-elevated)",
          }}>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", letterSpacing: 0.5, padding: "4px 6px" }}>
              SELECT A CIP-30 WALLET
            </div>
            {wallets.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: 10 }}>
                No Cardano wallet detected. Install{" "}
                <a href="https://lace.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>Lace</a>
                {", "}
                <a href="https://eternl.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>Eternl</a>
                {", or "}
                <a href="https://namiwallet.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand)" }}>Nami</a>.
              </div>
            ) : (
              wallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleConnect(w.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                    borderRadius: 4, fontSize: 13, color: "var(--color-text-primary)",
                    textAlign: "left", transition: "background 120ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.icon} alt={w.name} style={{ width: 18, height: 18, borderRadius: 3 }} />
                  <span style={{ fontWeight: 600 }}>{w.name}</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>v{w.apiVersion}</span>
                </button>
              ))
            )}
            <button
              onClick={() => { setShowWallets(false); setWalletErr(null); }}
              style={{ fontSize: 11, color: "var(--color-text-muted)", padding: "6px", alignSelf: "flex-start" }}
            >
              Cancel
            </button>
            {walletErr && (
              <div style={{ fontSize: 11, color: "var(--color-negative)", padding: "4px 6px" }}>{walletErr}</div>
            )}
          </div>
        ) : (
          <button
            onClick={() => { setWallets(detectWallets()); setShowWallets(true); }}
            style={{ fontSize: 12, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--color-brand)", boxShadow: "0 0 8px var(--color-brand)", flexShrink: 0 }} />
            <span>Or <span style={{ color: "var(--color-text-secondary)", textDecoration: "underline" }}>connect a Cardano wallet</span> to reserve a verified seat (optional)</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Layout pieces ───────────────────────────────────────── */

function TopBar() {
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
        padding: "12px 24px", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32, minWidth: 0 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center" }}>
            <BrandLogo size={22} wordmarkSize={17} />
          </Link>
          <div className="lp-nav-links">
            <NavLink href="/screener">Screener</NavLink>
            <NavLink href="/portfolio">Portfolio</NavLink>
            <NavLink href="/agents">For Agents</NavLink>
            <NavLink href="#pricing">Pricing</NavLink>
            <NavLink href="/whitepaper">Whitepaper</NavLink>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: "var(--radius-md)",
              color: "var(--color-text-secondary)",
              transition: "color 120ms, background 120ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; e.currentTarget.style.background = "var(--color-bg-elevated)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "transparent"; }}
          >
            <IconGithub />
          </a>
          <Link href="/screener" style={{
            fontSize: 12, fontWeight: 700, letterSpacing: 0.3, padding: "8px 14px",
            borderRadius: "var(--radius-md)", background: "var(--color-brand)", color: "#001A0E",
            whiteSpace: "nowrap",
          }}>
            OPEN APP
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>
      {children}
    </a>
  );
}


function MarketStrip({ ada, loaded }: { ada: AdaMarket | null; loaded: boolean }) {
  const items = [
    {
      label: "ADA",
      value: ada ? fmtUsd(ada.priceUsd, 4) : "—",
      delta: ada && ada.change24h != null ? fmtPct(ada.change24h) : null,
      positive: ada ? (ada.change24h ?? 0) >= 0 : true,
    },
    {
      label: "Market Cap",
      value: ada ? fmtUsd(ada.marketCap) : "—",
      delta: null,
      positive: true,
    },
    {
      label: "24H Volume",
      value: ada ? fmtUsd(ada.volume24h) : "—",
      delta: null,
      positive: true,
    },
    {
      label: "Source",
      value: "/api/v1/market",
      delta: !loaded ? null : ada ? "LIVE" : "DELAYED",
      positive: !!ada,
    },
  ];
  return (
    <div style={{
      borderTop: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
      overflow: "hidden", position: "relative", zIndex: 2,
    }}>
      <div style={{
        maxWidth: "var(--container-max)", margin: "0 auto", padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        flexWrap: "wrap",
      }}>
        {items.map((i) => (
          <div key={i.label} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
            <span style={{ color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: 0.4, fontSize: 11, textTransform: "uppercase" }}>{i.label}</span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{i.value}</span>
            {i.delta && (
              <span style={{ color: i.positive ? "var(--color-positive)" : "var(--color-warning)", fontWeight: 600, fontSize: 12, fontFamily: "var(--font-mono)" }}>
                {i.delta}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageChip() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999,
      border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
      fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
      color: "var(--color-text-muted)", whiteSpace: "nowrap",
    }}>
      <IconLayers />
      DEX data: SundaeSwap + WingRiders via DexScreener
    </span>
  );
}

function PillBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 999,
      border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
      fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: "var(--color-text-secondary)",
    }}>
      {children}
    </span>
  );
}

function Dot() {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: 3, background: "var(--color-brand)",
      boxShadow: "0 0 8px var(--color-brand)",
      display: "inline-block",
    }} />
  );
}

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

function SectionHead({ title, desc }: { title: React.ReactNode; desc: string }) {
  return (
    <>
      <h2 style={{ fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 14, maxWidth: 720 }}>
        {title}
      </h2>
      <p style={{ fontSize: 16, color: "var(--color-text-secondary)", maxWidth: 660, lineHeight: 1.55 }}>
        {desc}
      </p>
    </>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 20px",
  fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
  color: "var(--color-text-muted)",
};

function CompareRow({ label, a, b, aColor, bColor, last }: {
  label: string; a: string; b: string; aColor?: string; bColor?: string; last?: boolean;
}) {
  const tdBase: React.CSSProperties = {
    padding: "13px 20px", fontSize: 13,
    borderBottom: last ? "none" : "1px solid var(--color-border-soft)",
  };
  return (
    <tr>
      <td style={{ ...tdBase, color: "var(--color-text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
        {label}
      </td>
      <td style={{ ...tdBase, color: aColor ?? "var(--color-text-secondary)" }}>{a}</td>
      <td style={{ ...tdBase, color: bColor ?? "var(--color-text-primary)", fontWeight: 600 }}>{b}</td>
    </tr>
  );
}

function StatusPill({ status }: { status: "live" | "coming" }) {
  const live = status === "live";
  return (
    <span style={{
      marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
      padding: "2px 7px", borderRadius: 999, textTransform: "uppercase",
      background: live ? "var(--color-brand-soft)" : "rgba(255,193,7,0.1)",
      border: `1px solid ${live ? "rgba(32,235,122,0.25)" : "rgba(255,193,7,0.25)"}`,
      color: live ? "var(--color-brand)" : "var(--color-warning)",
    }}>
      {live ? "Live" : "Coming"}
    </span>
  );
}

function Feature({ title, desc, icon: Icon, status, href }: {
  title: string; desc: string; icon: () => React.ReactNode; status: "live" | "coming"; href?: string;
}) {
  const body = (
    <div style={{
      background: "var(--color-bg-primary)", padding: "28px 24px",
      display: "flex", flexDirection: "column", gap: 12, minHeight: 200, height: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "var(--color-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-brand)", flexShrink: 0,
        }}>
          <Icon />
        </div>
        <StatusPill status={status} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55, margin: 0 }}>{desc}</p>
      {href && (
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-brand)", marginTop: "auto" }}>
          Open →
        </span>
      )}
    </div>
  );
  return href ? <Link href={href} style={{ display: "block" }}>{body}</Link> : body;
}

function Agent({ tag, title, desc, live }: { tag: string; title: string; desc: string; live?: boolean }) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)", padding: "24px 22px",
      display: "flex", flexDirection: "column", gap: 10, minHeight: 180,
    }}>
      <span style={{
        alignSelf: "flex-start", fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
        padding: "3px 8px", borderRadius: 3,
        background: live ? "var(--color-brand-soft)" : "rgba(255,193,7,0.08)",
        border: `1px solid ${live ? "rgba(32,235,122,0.25)" : "rgba(255,193,7,0.2)"}`,
        color: live ? "var(--color-brand)" : "var(--color-warning)",
      }}>
        {tag.toUpperCase()}
      </span>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

function PriceCard({ tier, price, cadence, perks, highlight, note }: {
  tier: string; price: string; cadence: string; perks: string[]; highlight?: boolean; note?: string;
}) {
  return (
    <div style={{
      background: highlight ? "var(--color-bg-elevated)" : "var(--color-bg-primary)",
      borderRadius: "var(--radius-lg)",
      border: `1px solid ${highlight ? "rgba(32,235,122,0.4)" : "var(--color-border)"}`,
      padding: 24,
      position: "relative",
      boxShadow: highlight ? "0 0 30px rgba(32,235,122,0.08)" : "none",
    }}>
      {note && (
        <span style={{
          position: "absolute", top: 14, right: 14,
          fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
          padding: "3px 8px", borderRadius: 3, textTransform: "uppercase",
          background: note === "LIVE NOW" ? "var(--color-brand-soft)" : "var(--color-bg-elevated)",
          border: `1px solid ${note === "LIVE NOW" ? "rgba(32,235,122,0.25)" : "var(--color-border)"}`,
          color: note === "LIVE NOW" ? "var(--color-brand)" : "var(--color-text-muted)",
        }}>
          {note}
        </span>
      )}
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 14 }}>
        {tier}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
        <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, fontFamily: "var(--font-mono)" }}>{price}</span>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{cadence}</span>
      </div>
      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {perks.map((p) => (
          <li key={p} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>
            <span style={{ color: "var(--color-brand)", marginTop: 2, flexShrink: 0 }}><IconCheck size={13} /></span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
      <div style={{
        maxWidth: "var(--container-max)", margin: "0 auto",
        padding: "28px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandLogo size={22} wordmark={false} />
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Basilisk — the Cardano terminal for humans & agents
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--color-text-muted)", flexWrap: "wrap" }}>
          <Link href="/screener">Screener</Link>
          <Link href="/agents">For Agents</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link href="/whitepaper">Whitepaper</Link>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Agent code samples (real, runnable) ─────────────────── */

function CodeTabs() {
  const [tab, setTab] = useState<"rest" | "mcp">("rest");
  return (
    <div style={{
      marginTop: 32, borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)", overflow: "hidden",
      background: "var(--color-bg-elevated)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px", background: "var(--color-bg-secondary)",
        borderBottom: "1px solid var(--color-border)", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{
          display: "flex", gap: 2, padding: 2, background: "var(--color-bg-elevated)",
          borderRadius: 6, border: "1px solid var(--color-border)",
        }}>
          {([
            { id: "rest" as const, label: "REST API" },
            { id: "mcp" as const, label: "MCP" },
          ]).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                  background: active ? "var(--color-bg-hover)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  transition: "color 120ms, background 120ms",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--color-brand)", letterSpacing: 1, fontWeight: 700 }}>
          <Dot /> WORKS TODAY
        </span>
      </div>
      <pre style={{
        padding: "20px 22px", margin: 0, fontSize: 12.5, lineHeight: 1.75,
        fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)",
        overflow: "auto",
      }}>
        {tab === "rest" ? <RestSnippet /> : <McpSnippet />}
      </pre>
    </div>
  );
}

function RestSnippet() {
  const prompt = (t: string) => <span style={{ color: "var(--color-text-muted)" }}>{t}</span>;
  const cmd = (t: string) => <span style={{ color: "#FFFFFF" }}>{t}</span>;
  const key = (t: string) => <span style={{ color: "var(--color-info)" }}>{t}</span>;
  const str = (t: string) => <span style={{ color: "var(--color-brand)" }}>{t}</span>;
  const num = (t: string) => <span style={{ color: "#E5C07B" }}>{t}</span>;
  return (
    <>
      {prompt("$ ")}{cmd(`curl ${APP_URL}/api/v1/tokens | jq '.tokens[0]'`)}{"\n\n"}
      {"{"}{"\n"}
      {"  "}{key("\"symbol\"")}: {str("\"SNEK\"")},{"\n"}
      {"  "}{key("\"name\"")}: {str("\"Snek\"")},{"\n"}
      {"  "}{key("\"address\"")}: {str("\"279c909f…0014df105349454b\"")},{"\n"}
      {"  "}{key("\"priceUsd\"")}: {num("0.00415")},{"\n"}
      {"  "}{key("\"change24h\"")}: {num("3.42")},{"\n"}
      {"  "}{key("\"volume24h\"")}: {num("388420.51")},{"\n"}
      {"  "}{key("\"liquidityUsd\"")}: {num("2811940.07")},{"\n"}
      {"  "}{key("\"buys24h\"")}: {num("1243")},{"\n"}
      {"  "}{key("\"sells24h\"")}: {num("981")},{"\n"}
      {"  "}{key("\"dexIds\"")}: [{str("\"sundaeswap\"")}, {str("\"wingriders\"")}]{"\n"}
      {"}"}
    </>
  );
}

function McpSnippet() {
  const prompt = (t: string) => <span style={{ color: "var(--color-text-muted)" }}>{t}</span>;
  const cmd = (t: string) => <span style={{ color: "#FFFFFF" }}>{t}</span>;
  const com = (t: string) => <span style={{ color: "var(--color-text-muted)" }}>{t}</span>;
  const ask = (t: string) => <span style={{ color: "var(--color-brand)" }}>{t}</span>;
  return (
    <>
      {prompt("$ ")}{cmd(`claude mcp add --transport http basilisk ${APP_URL}/api/mcp`)}{"\n\n"}
      {com("# then ask:")}{"\n"}
      {prompt("> ")}{ask("which Cardano token had the most buy pressure today?")}
    </>
  );
}

/* ─── Live chart + movers (via /api/v1) ───────────────────── */

type Timeframe = "1H" | "4H" | "1D" | "1W";

function ChartTile({ ada }: { ada: AdaMarket | null }) {
  const [tf, setTf] = useState<Timeframe>("1D");
  const [series, setSeries] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Pick a source dataset that covers the timeframe, then slice.
    const baseDays = tf === "1W" ? 7 : 1;
    fetchMarket(baseDays).then(({ series: all }) => {
      if (cancelled) return;
      if (!all || all.length === 0) {
        setSeries([]);
        setLoading(false);
        return;
      }
      const now = all[all.length - 1][0];
      const windowMs =
        tf === "1H" ? 60 * 60_000 :
        tf === "4H" ? 4 * 60 * 60_000 :
        tf === "1D" ? 24 * 60 * 60_000 :
        7 * 24 * 60 * 60_000;
      const sliced = all.filter(([t]) => t >= now - windowMs);
      setSeries(sliced.length > 1 ? sliced : all);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tf]);

  const w = 600, h = 200, pad = 8;
  const hasData = series.length > 1;
  const first = hasData ? series[0][1] : 0;
  const last = hasData ? series[series.length - 1][1] : 0;
  const tfChange = hasData ? ((last - first) / first) * 100 : 0;
  const trendUp = hasData ? last >= first : (!ada || (ada.change24h ?? 0) >= 0);

  let line = "";
  let area = "";
  if (hasData) {
    const vals = series.map((p) => p[1]);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const range = max - min || 1;
    const xStep = (w - pad * 2) / (series.length - 1);
    const norm = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
    line = series.map(([, v], i) => `${i === 0 ? "M" : "L"} ${pad + i * xStep} ${norm(v)}`).join(" ");
    area = `${line} L ${pad + (series.length - 1) * xStep} ${h} L ${pad} ${h} Z`;
  }

  return (
    <div style={{
      background: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", padding: 16, minHeight: 240,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8 }}>
            ADA/USD
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              {ada ? fmtUsd(ada.priceUsd, 4) : (hasData ? fmtUsd(last, 4) : "—")}
            </span>
            {hasData && (
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", color: trendUp ? "var(--color-positive)" : "var(--color-negative)" }}>
                {fmtPct(tfChange)} <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>· {tf}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
            /api/v1/market · {series.length} points · {tf}
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--color-bg-elevated)", borderRadius: 6, border: "1px solid var(--color-border)" }}>
          {(["1H", "4H", "1D", "1W"] as Timeframe[]).map((t) => {
            const active = tf === t;
            return (
              <button
                key={t}
                onClick={() => setTf(t)}
                style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                  background: active ? "var(--color-bg-hover)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  transition: "color 120ms, background 120ms",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 200, display: "block" }}>
        <defs>
          <linearGradient id="g1up" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(32,235,122,0.35)" />
            <stop offset="100%" stopColor="rgba(32,235,122,0)" />
          </linearGradient>
          <linearGradient id="g1down" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,66,43,0.30)" />
            <stop offset="100%" stopColor="rgba(255,66,43,0)" />
          </linearGradient>
        </defs>
        {hasData ? (
          <>
            <path d={area} fill={trendUp ? "url(#g1up)" : "url(#g1down)"} />
            <path d={line} fill="none" stroke={trendUp ? "var(--color-brand)" : "var(--color-negative)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <text x={w / 2} y={h / 2} textAnchor="middle" fill="var(--color-text-muted)" fontSize="11" fontFamily="var(--font-mono)">
            {loading ? "loading…" : "data delayed — retry shortly"}
          </text>
        )}
      </svg>
    </div>
  );
}

function MoversTile() {
  const [rows, setRows] = useState<MoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchMovers(6).then((r) => {
      if (r === null) {
        setFailed(true);
      } else {
        setRows(r);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div style={{
      background: "var(--color-bg-secondary)", borderRadius: "var(--radius-md)",
      border: "1px solid var(--color-border)", padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Top Movers</div>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: 0.6 }}>CNT · 24H</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border-soft)" }}>
              <span className="lp-skeleton" style={{ width: 60, height: 10 }} />
              <span className="lp-skeleton" style={{ width: 42, height: 10 }} />
            </div>
          ))
        ) : failed || rows.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", padding: "16px 0" }}>
            Data delayed — refresh in a moment.
          </div>
        ) : (
          rows.map((r) => {
            const pct = r.change24h ?? 0;
            return (
              <Link
                key={r.address}
                href={`/tokens/${r.address}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border-soft)" }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{r.symbol}</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                    {r.name}
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  {r.priceUsd != null && (
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {fmtUsd(r.priceUsd, 5)}
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", textAlign: "right", minWidth: 58, color: pct >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}>
                    {fmtPct(pct)}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "var(--color-text-muted)", letterSpacing: 0.4 }}>
        SundaeSwap + WingRiders via DexScreener · <Link href="/screener" style={{ color: "var(--color-brand)" }}>full screener →</Link>
      </div>
    </div>
  );
}

/* ─── Icons (stroke style — no emoji) ─────────────────────── */

function IconArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}
function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 10 6-10 6L2 8Z" /><path d="m2 14 10 6 10-6" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2" /><path d="M3 10h18" />
    </svg>
  );
}
function IconScreener() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" />
    </svg>
  );
}
function IconBot() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4" /><circle cx="12" cy="3" r="1" />
      <path d="M9 13v2" /><path d="M15 13v2" />
    </svg>
  );
}
function IconGithub() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.02c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.99 0 1.98.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .3.21.67.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
