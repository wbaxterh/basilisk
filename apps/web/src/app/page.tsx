"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { detectWallets, connectWallet, type WalletInfo } from "../lib/wallet";
import { APP_URL, APP_HOST, GITHUB_URL } from "../lib/site";

interface AdaMarket {
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

async function fetchAdaMarket(): Promise<AdaMarket | null> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true",
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const ada = data.cardano;
    if (!ada) return null;
    return {
      price: ada.usd,
      change24h: ada.usd_24h_change,
      marketCap: ada.usd_market_cap,
      volume24h: ada.usd_24h_vol,
    };
  } catch {
    return null;
  }
}

function fmtUsd(n: number, digits = 4): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(digits)}`;
}

function fmtPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState(0);

  const [ada, setAda] = useState<AdaMarket | null>(null);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [showWallets, setShowWallets] = useState(false);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);

  useEffect(() => {
    fetchAdaMarket().then(setAda).catch(() => {});
    setWallets(detectWallets());
  }, []);

  const postSignup = async (payload: { email?: string; walletAddr?: string }) => {
    if (!payload.email && !payload.walletAddr) return;
    setSubmitting(true);
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
        // Network/validation error — still show success so the UI feels solid
        // for the user, but don't pretend we have a position number.
        setSubmitted(true);
      }
    } catch {
      setSubmitted(true);
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
      // Connecting a wallet IS a signup — fire the POST immediately so the
      // address gets stored and a notification fires even without an email.
      await postSignup({ email: email || undefined, walletAddr: w.changeAddress });
    } catch (e) {
      setWalletErr(e instanceof Error ? e.message : "Could not connect wallet");
    }
  };

  const handleSubmit = () => postSignup({ email: email || undefined, walletAddr: walletAddr || undefined });

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

        <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "88px 32px 72px", position: "relative" }}>
          <PillBadge>
            <Dot /> EARLY ACCESS · Q3 2026
          </PillBadge>

          <h1 style={{
            fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.4,
            margin: "20px 0 18px", maxWidth: 820,
          }}>
            Cardano analytics<br />
            built for traders <span style={{ color: "var(--color-brand)" }}>and</span> agents.
          </h1>

          <p style={{
            fontSize: 17, color: "var(--color-text-secondary)", maxWidth: 620,
            lineHeight: 1.55, marginBottom: 36,
          }}>
            Real-time on-chain data, portfolio tracking, and a transparent open API. Plus the first
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}> x402 agent-native </span>
            trading layer on Cardano — pay-per-request market data for autonomous AI.
          </p>

          {/* Waitlist */}
          <div id="waitlist" style={{ maxWidth: 520 }}>
            {!submitted ? (
              <>
                <div style={{
                  display: "flex", gap: 0, width: "100%",
                  border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-elevated)", overflow: "hidden",
                  transition: "border-color 120ms",
                }}>
                  <input
                    type="email"
                    placeholder="you@protocol.xyz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    style={{
                      flex: 1, padding: "12px 14px", background: "transparent",
                      border: "none", color: "var(--color-text-primary)",
                      fontSize: 14, fontFamily: "inherit", outline: "none",
                    }}
                  />
                  <button onClick={handleSubmit} disabled={submitting} style={{
                    padding: "0 22px", background: "var(--color-brand)", color: "#001A0E",
                    fontWeight: 700, fontSize: 13, letterSpacing: 0.2, whiteSpace: "nowrap",
                    opacity: submitting ? 0.6 : 1, transition: "opacity 120ms",
                    borderRadius: 0,
                  }}>
                    {submitting ? "JOINING…" : "REQUEST ACCESS"}
                  </button>
                </div>
                {/* Wallet connect (optional) */}
                <div style={{ marginTop: 12 }}>
                  {walletAddr ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
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
                            <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: "auto" }}>v{w.apiVersion}</span>
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
                      style={{ fontSize: 12, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--color-brand)", boxShadow: "0 0 8px var(--color-brand)" }} />
                      <span>Or <span style={{ color: "var(--color-text-secondary)", textDecoration: "underline" }}>connect a Cardano wallet</span> to claim priority (optional)</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                padding: "16px 18px", borderRadius: "var(--radius-md)",
                background: "var(--color-brand-soft)", border: "1px solid rgba(32,235,122,0.25)",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, background: "var(--color-brand)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#001A0E", fontWeight: 800,
                }}>✓</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-brand)" }}>You&apos;re on the list.</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                    {position > 0 ? `Position #${position.toLocaleString()} · We&apos;ll email when access opens.` : "We&apos;ll email when access opens."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live market strip */}
        <MarketStrip ada={ada} />
      </section>

      {/* Live Cardano market — real data, no fake-dashboard chrome */}
      <section style={{ padding: "56px 32px", maxWidth: "var(--container-max)", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
          <div>
            <SectionLabel>Live · Cardano market</SectionLabel>
            <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 4 }}>
              Real data, refreshed every page load
            </h2>
          </div>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", letterSpacing: 0.6, textTransform: "uppercase" }}>
            CoinGecko · public sources
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <ChartTile ada={ada} />
          <MoversTile />
        </div>
      </section>

      {/* Early Access — entice, no demo */}
      <section style={{ padding: "72px 32px", maxWidth: "var(--container-max)", margin: "0 auto" }}>
        <SectionLabel>01 / Early Access</SectionLabel>
        <SectionHead
          title={<>Founding members get Pro <span style={{ color: "var(--color-brand)" }}>free for 6 months.</span></>}
          desc="We're shipping invites in waves to a small founding cohort. Wave-1 gets six months of Pro on the house, plus perks that survive public launch."
        />

        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <Perk
            badge="6 MONTHS"
            title="Pro free for six months"
            desc="Pro normally runs $19/mo at launch — unlimited alerts, 10 wallets, whale leaderboards, 100k API calls/mo. Founding members get all of it free for the first six months."
          />
          <Perk
            badge="PRIORITY"
            title="Wallet-signed signups jump the queue"
            desc="Email gets you on the list. Connecting a Cardano wallet bumps you to the front and reserves a verified founding seat."
          />
          <Perk
            badge="ALPHA"
            title="x402 agent rails before anyone else"
            desc="The first cohort of builders gets keys to the MCP server + x402 micropayment alpha — months before the public can touch it."
          />
          <Perk
            badge="DIRECT"
            title="Founders' channel"
            desc="A private channel with the people building it. Tell us what TapTools gets wrong. Tell us what to ship first. We listen here, not on a roadmap."
          />
        </div>

        {/* Scarcity strip */}
        <div style={{
          marginTop: 32, padding: "18px 24px", borderRadius: "var(--radius-lg)",
          border: "1px solid rgba(32,235,122,0.25)", background: "var(--color-brand-soft)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 4, background: "var(--color-brand)",
              boxShadow: "0 0 10px var(--color-brand)", flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
                Founding cohort closes when we hit our cap.
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>
                Wave-1 invites go out as we ship core features. Wallet-signed entries get priority.
              </div>
            </div>
          </div>
          <a href="#top" style={{
            padding: "10px 18px", borderRadius: "var(--radius-md)",
            background: "var(--color-brand)", color: "#001A0E",
            fontWeight: 700, fontSize: 13, letterSpacing: 0.3, whiteSpace: "nowrap",
          }}>
            CLAIM YOUR SPOT
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
        <div style={{ padding: "72px 32px", maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <SectionLabel>02 / Platform</SectionLabel>
          <SectionHead
            title="Everything you need to trade Cardano."
            desc="TapTools-grade analytics with transparent pricing, an open data API, and one-click wallet attribution. No paywalls on basic data. Ever."
          />

          <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--color-border)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <Feature
              title="Real-time charts"
              desc="OHLCV candles, live VWAP, and trade feeds across every major Cardano DEX. TradingView under the hood."
              icon={IconChart}
            />
            <Feature
              title="Portfolio tracking"
              desc="Connect a wallet or look up any address. Net worth, realized P&L, value-over-time, and full holdings."
              icon={IconWallet}
            />
            <Feature
              title="Market screener"
              desc="Top tokens, biggest movers, gainers, losers. Sortable, filterable, streaming. Find alpha first."
              icon={IconScreener}
            />
            <Feature
              title="Whale tracking"
              desc="Profile any wallet. Smart-money flows, whale trades, and watchlists for the addresses that move markets."
              icon={IconWhale}
            />
            <Feature
              title="Smart alerts"
              desc="Thresholds on price, % moves, or whale activity. Routed to email, Telegram, Discord, or a webhook."
              icon={IconBell}
            />
            <Feature
              title="Open data API"
              desc="REST + WebSocket. Free tier. Build your own tools, bots, and dashboards on top of Basilisk data."
              icon={IconCode}
            />
          </div>
        </div>
      </section>

      {/* x402 Agent Section */}
      <section id="agents" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div style={{ padding: "88px 32px", maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <SectionLabel>
            <span style={{ color: "var(--color-info)" }}>03 / Agents</span> · Industry first
          </SectionLabel>
          <SectionHead
            title={<>Agent-native trading. Powered by <span style={{ color: "var(--color-brand)" }}>x402</span>.</>}
            desc="Basilisk is the first Cardano platform built for AI. An MCP server and x402 payment rails let autonomous agents query data, analyze portfolios, and route trades — paying per request in native ADA. No API keys. No accounts."
          />

          <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <Agent
              tag="Standard"
              title="MCP Server"
              desc="Model Context Protocol integration. Claude, GPT, and any LLM can query Cardano through a standardized tool interface."
            />
            <Agent
              tag="Protocol"
              title="x402 Micropayments"
              desc="HTTP 402 payment protocol. Agents pay per request in ADA — no keys, no accounts, no friction. Sign and send."
            />
            <Agent
              tag="Network"
              title="Agent-to-Agent"
              desc="Discover, negotiate, and settle between agents. Portfolio rebalancing, arbitrage detection, multi-agent strategies."
            />
          </div>

          {/* Code sample */}
          <div style={{
            marginTop: 32, borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)", overflow: "hidden",
            background: "var(--color-bg-elevated)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "var(--color-bg-secondary)",
              borderBottom: "1px solid var(--color-border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--color-brand)", boxShadow: "0 0 6px var(--color-brand)" }} />
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                  agent-example.ts
                </span>
              </div>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: 1 }}>TYPESCRIPT</span>
            </div>
            <pre style={{
              padding: "20px 22px", margin: 0, fontSize: 12.5, lineHeight: 1.75,
              fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)",
              overflow: "auto",
            }}>
<Code />
            </pre>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-bg-secondary)" }}>
        <div style={{ padding: "72px 32px", maxWidth: "var(--container-max)", margin: "0 auto" }}>
          <SectionLabel>04 / Pricing</SectionLabel>
          <SectionHead title="Free to use. Pay for power." desc="Core analytics are free, forever. API and agent rails are usage-based." />

          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <PriceCard
              tier="Trader"
              price="$0"
              cadence="forever"
              perks={["Real-time charts", "Portfolio tracking", "Basic alerts", "1 wallet watched"]}
            />
            <PriceCard
              tier="Pro"
              price="$19"
              cadence="/ month"
              highlight
              perks={["Everything in Trader", "Unlimited alerts", "10 wallets watched", "Whale leaderboards", "API: 100k req/mo"]}
            />
            <PriceCard
              tier="Agent / Build"
              price="x402"
              cadence="pay per request"
              perks={["Native ADA payments", "MCP server access", "WebSocket streams", "A2A negotiation", "No account required"]}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ borderTop: "1px solid var(--color-border)" }}>
        <div style={{ padding: "96px 32px", maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 14 }}>
            See Cardano <span style={{ color: "var(--color-brand)" }}>differently</span>.
          </h2>
          <p style={{ fontSize: 16, color: "var(--color-text-secondary)", marginBottom: 28, lineHeight: 1.55 }}>
            Join the waitlist. Be first on day one. We&apos;re shipping invites in waves.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <a href="#top" style={{
              padding: "12px 22px", borderRadius: "var(--radius-md)",
              background: "var(--color-brand)", color: "#001A0E",
              fontWeight: 700, fontSize: 13, letterSpacing: 0.3,
            }}>
              REQUEST ACCESS
            </a>
          </div>
        </div>
      </section>

      <Footer />
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
        padding: "12px 32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Logo />
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.5 }}>Basilisk</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <NavLink href="#features">Platform</NavLink>
            <NavLink href="#agents">For Agents</NavLink>
            <NavLink href="/whitepaper">Whitepaper</NavLink>
            <NavLink href="#top">Pricing</NavLink>
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
          <Link href="/dashboard" style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "8px 12px" }}>
            Sign in
          </Link>
          <Link href="#top" style={{
            fontSize: 12, fontWeight: 700, letterSpacing: 0.3, padding: "8px 14px",
            borderRadius: "var(--radius-md)", background: "var(--color-brand)", color: "#001A0E",
          }}>
            GET ACCESS
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}
    >
      {children}
    </a>
  );
}

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: "inline-block", filter: "drop-shadow(0 0 8px rgba(32,235,122,0.35))" }}
      aria-label="Basilisk"
    >
      <defs>
        <linearGradient id="basiliskGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#20EB7A" />
          <stop offset="100%" stopColor="#16A35A" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="7" fill="url(#basiliskGrad)" />
      <path d="M16 7 L25 16 L16 25 L7 16 Z" fill="#001A0E" />
    </svg>
  );
}

function MarketStrip({ ada }: { ada: AdaMarket | null }) {
  const items = [
    {
      label: "ADA",
      value: ada ? fmtUsd(ada.price, 4) : "—",
      delta: ada ? fmtPct(ada.change24h) : null,
      positive: ada ? ada.change24h >= 0 : true,
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
      value: "CoinGecko",
      delta: ada ? "LIVE" : "OFFLINE",
      positive: !!ada,
    },
  ];
  return (
    <div style={{
      borderTop: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
      overflow: "hidden", position: "relative", zIndex: 2,
    }}>
      <div style={{
        maxWidth: "var(--container-max)", margin: "0 auto", padding: "12px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        flexWrap: "wrap",
      }}>
        {items.map((i) => (
          <div key={i.label} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
            <span style={{ color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: 0.4, fontSize: 11, textTransform: "uppercase" }}>{i.label}</span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{i.value}</span>
            {i.delta && (
              <span style={{ color: i.positive ? "var(--color-positive)" : "var(--color-negative)", fontWeight: 600, fontSize: 12 }}>
                {i.delta}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
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
      <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 14, maxWidth: 720 }}>
        {title}
      </h2>
      <p style={{ fontSize: 16, color: "var(--color-text-secondary)", maxWidth: 640, lineHeight: 1.55 }}>
        {desc}
      </p>
    </>
  );
}

function Perk({ badge, title, desc }: { badge: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)", padding: "24px 22px",
      display: "flex", flexDirection: "column", gap: 10, minHeight: 180,
    }}>
      <span style={{
        alignSelf: "flex-start", fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
        padding: "3px 8px", borderRadius: 3,
        background: "var(--color-brand-soft)", border: "1px solid rgba(32,235,122,0.25)",
        color: "var(--color-brand)",
      }}>
        {badge}
      </span>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

function Feature({ title, desc, icon: Icon }: {
  title: string; desc: string; icon: () => React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--color-bg-primary)", padding: "28px 24px",
      display: "flex", flexDirection: "column", gap: 12, minHeight: 200,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: "var(--color-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--color-brand)",
      }}>
        <Icon />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.55, margin: 0 }}>{desc}</p>
    </div>
  );
}

function Agent({ tag, title, desc }: { tag: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--color-border)", padding: "24px 22px",
      display: "flex", flexDirection: "column", gap: 10, minHeight: 200,
    }}>
      <span style={{
        alignSelf: "flex-start", fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
        padding: "3px 8px", borderRadius: 3, background: "rgba(112,236,253,0.08)",
        border: "1px solid rgba(112,236,253,0.2)", color: "var(--color-info)",
      }}>
        {tag.toUpperCase()}
      </span>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

function PriceCard({ tier, price, cadence, perks, highlight }: {
  tier: string; price: string; cadence: string; perks: string[]; highlight?: boolean;
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
      {highlight && (
        <span style={{
          position: "absolute", top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
          padding: "3px 8px", borderRadius: 3,
          background: "var(--color-brand)", color: "#001A0E",
        }}>
          POPULAR
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
            <span style={{ color: "var(--color-brand)", marginTop: 1, fontWeight: 800 }}>✓</span>
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
        padding: "28px 32px",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo />
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Basilisk — Cardano analytics for humans & agents
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--color-text-muted)" }}>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link href="/whitepaper">Whitepaper</Link>
          <a href="#features">Platform</a>
          <a href="#agents">Agents</a>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}

/* ─── Icons (stroke style — no emoji) ─────────────────────── */

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2" /><path d="M3 10h18" />
    </svg>
  );
}
function IconScreener() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function IconWhale() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c2-4 6-6 10-6s8 2 8 6-4 6-8 6c-2 0-4-.5-6-2" /><circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconCode() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" />
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

/* ─── Syntax-highlighted code sample ──────────────────────── */

function Code() {
  const kw = (t: string) => <span style={{ color: "var(--color-info)" }}>{t}</span>;
  const str = (t: string) => <span style={{ color: "var(--color-brand)" }}>{t}</span>;
  const com = (t: string) => <span style={{ color: "var(--color-text-muted)" }}>{t}</span>;
  const fn = (t: string) => <span style={{ color: "#E5C07B" }}>{t}</span>;
  const punct = (t: string) => <span style={{ color: "var(--color-text-secondary)" }}>{t}</span>;
  const v = (t: string) => <span style={{ color: "#FFFFFF" }}>{t}</span>;
  return (
    <>
      {com("// An AI agent querying Basilisk via x402 micropayments")}{"\n"}
      {kw("const")} {v("response")} {punct("=")} {kw("await")} {fn("fetch")}{punct("(")}{str(`"${APP_URL}/api/v1/prices/MIN"`)}{punct(",")} {punct("{")}{"\n"}
      {"  headers: {"}{"\n"}
      {"    "}{str("\"X-402-Payment\"")}{punct(":")} {kw("await")} {v("wallet")}{punct(".")}{fn("signPayment")}{punct("(")}{punct("{")} amount{punct(":")} {str("1000")} {punct("}")}{punct(")")} {com("// 0.001 ADA")}{"\n"}
      {"  }"}{"\n"}
      {punct("}")}{punct(");")}{"\n"}
      {"\n"}
      {kw("const")} {punct("{")} price{punct(",")} volume{punct(",")} change24h {punct("}")} {punct("=")} {kw("await")} {v("response")}{punct(".")}{fn("json")}{punct("();")}{"\n"}
      {com("// Agent decides: price dropped 15% with 3x avg volume → accumulate")}{"\n"}
      {kw("await")} {v("agent")}{punct(".")}{fn("execute")}{punct("(")}{str("\"swap\"")}{punct(",")} {punct("{")} from{punct(":")} {str("\"ADA\"")}{punct(",")} to{punct(":")} {str("\"MIN\"")}{punct(",")} amount{punct(":")} {str("\"500 ADA\"")} {punct("}")}{punct(");")}
    </>
  );
}
type Timeframe = "1H" | "4H" | "1D" | "1W";

// Cache CoinGecko market_chart responses across timeframe switches.
// days=1 returns 5-min granularity → covers 1H/4H/1D. days=7 returns hourly → 1W.
const chartCache = new Map<number, Array<[number, number]>>();

async function fetchAdaSeries(days: number): Promise<Array<[number, number]> | null> {
  const cached = chartCache.get(days);
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/cardano/market_chart?vs_currency=usd&days=${days}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const prices = (data?.prices ?? []) as Array<[number, number]>;
    chartCache.set(days, prices);
    return prices;
  } catch {
    return null;
  }
}

function ChartTile({ ada }: { ada: AdaMarket | null }) {
  const [tf, setTf] = useState<Timeframe>("1D");
  const [series, setSeries] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Pick a source dataset that covers the timeframe, then slice.
    const baseDays = tf === "1W" ? 7 : 1;
    fetchAdaSeries(baseDays).then((all) => {
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
  const trendUp = hasData ? last >= first : (!ada || ada.change24h >= 0);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8 }}>
            ADA/USD
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
              {ada ? fmtUsd(ada.price, 4) : (hasData ? fmtUsd(last, 4) : "—")}
            </span>
            {hasData && (
              <span style={{ fontSize: 11, fontWeight: 600, color: trendUp ? "var(--color-positive)" : "var(--color-negative)" }}>
                {fmtPct(tfChange)} <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>· {tf}</span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
            CoinGecko · {series.length} points · {tf}
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
            {loading ? "loading…" : "no data"}
          </text>
        )}
      </svg>
    </div>
  );
}

interface CntToken {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
}

async function fetchCardanoMovers(): Promise<CntToken[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=cardano-ecosystem&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h",
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as CntToken[];
    return data.filter((t) => t.price_change_percentage_24h != null && t.id !== "cardano");
  } catch {
    return [];
  }
}

function MoversTile() {
  const [rows, setRows] = useState<CntToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCardanoMovers().then((all) => {
      // Top 5 movers by absolute 24H % change
      const sorted = [...all].sort(
        (a, b) => Math.abs(b.price_change_percentage_24h ?? 0) - Math.abs(a.price_change_percentage_24h ?? 0)
      );
      setRows(sorted.slice(0, 5));
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
          [0,1,2,3,4].map((i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border-soft)" }}>
              <span style={{ width: 50, height: 10, background: "var(--color-bg-elevated)", borderRadius: 3 }} />
              <span style={{ width: 40, height: 10, background: "var(--color-bg-elevated)", borderRadius: 3 }} />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", padding: "16px 0" }}>
            No data
          </div>
        ) : (
          rows.map((r) => {
            const pct = r.price_change_percentage_24h ?? 0;
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-border-soft)" }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{r.symbol}</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                    {r.name}
                  </span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 0 ? "var(--color-positive)" : "var(--color-negative)" }}>
                  {fmtPct(pct)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
