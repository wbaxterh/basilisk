"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ReactDOM from "react-dom";
import EmptyState from "../../../components/EmptyState";
import type { ScreenerToken, ScreenerResponse, SearchResponse } from "../../../lib/dex-data";

// Next's app router ships React canary, where ReactDOM.preload exists at
// runtime — @types/react-dom@18 just doesn't declare it yet.
const preloadFetch = (
  ReactDOM as unknown as {
    preload?: (href: string, opts: { as: string; crossOrigin?: string }) => void;
  }
).preload;

type Tab = "top" | "favorites" | "trending" | "gainers" | "losers" | "volume" | "new";
type SortKey =
  | "price"
  | "change1h"
  | "change6h"
  | "change24h"
  | "volume24h"
  | "liquidity"
  | "txns"
  | "mcap"
  | "age";
type Status = "loading" | "ok" | "delayed";

interface RowData {
  token: ScreenerToken;
  viaSearch: boolean;
}

const TABS: { key: Tab; label: string; help: string }[] = [
  { key: "top", label: "Top", help: "By DEX liquidity" },
  { key: "favorites", label: "Favorites", help: "Your watchlist — stored in this browser, no login needed" },
  { key: "trending", label: "Trending", help: "Ranked by free community boosts — one wallet, one boost per UTC day" },
  { key: "gainers", label: "Gainers", help: "Best 24H performers" },
  { key: "losers", label: "Losers", help: "Worst 24H performers" },
  { key: "volume", label: "Volume", help: "By 24H trading volume" },
  { key: "new", label: "New Pairs", help: "Most recently created pairs" },
];

const TAB_DEFAULT: Record<Tab, { key: SortKey; desc: boolean }> = {
  top: { key: "liquidity", desc: true },
  favorites: { key: "liquidity", desc: true },
  trending: { key: "volume24h", desc: true },
  gainers: { key: "change24h", desc: true },
  losers: { key: "change24h", desc: false },
  volume: { key: "volume24h", desc: true },
  new: { key: "age", desc: true },
};

const DEX_LABELS: Record<string, string> = {
  sundaeswap: "Sundae",
  wingriders: "WingRiders",
  minswap: "Minswap",
};

const WATCHLIST_KEY = "basilisk.watchlist";
const BOOST_CHUNK = 60; // API contract: at most 60 units per GET

interface BoostSummaryLite {
  unit: string;
  boosts24h: number;
}

/* ─── Formatters ─────────────────────────────────────────── */

function fmtPrice(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v <= 0) return "$0.00";
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return "$" + v.toFixed(2);
  if (v >= 0.01) return "$" + v.toFixed(4);
  const decimals = Math.min(11, 3 - Math.floor(Math.log10(v)));
  return "$" + v.toFixed(decimals);
}

function fmtCompact(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(0);
}

function fmtPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtAge(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 365) return `${d}d`;
  return `${(d / 365).toFixed(1)}y`;
}

/* ─── Sorting ────────────────────────────────────────────── */

function sortVal(t: ScreenerToken, key: SortKey): number | null {
  switch (key) {
    case "price": return t.priceUsd;
    case "change1h": return t.change1h;
    case "change6h": return t.change6h;
    case "change24h": return t.change24h;
    case "volume24h": return t.volume24h;
    case "liquidity": return t.liquidityUsd;
    case "txns": return t.txns24h;
    case "mcap": return t.marketCap;
    case "age": return t.pairCreatedAt;
  }
}

function sortRows(list: RowData[], key: SortKey, desc: boolean): RowData[] {
  return [...list].sort((a, b) => {
    const av = sortVal(a.token, key);
    const bv = sortVal(b.token, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls always last
    if (bv == null) return -1;
    return desc ? bv - av : av - bv;
  });
}

const matches = (t: ScreenerToken, q: string) =>
  t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);

/* ─── Page ───────────────────────────────────────────────── */

export default function ScreenerPage() {
  // Warm the token list: emits <link rel="preload" as="fetch"> in the SSR
  // head so the request starts before hydration + the client effect run.
  preloadFetch?.("/api/v1/tokens", { as: "fetch", crossOrigin: "anonymous" });

  const router = useRouter();
  const [tokens, setTokens] = useState<ScreenerToken[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("top");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDesc, setSortDesc] = useState(true);
  const [remote, setRemote] = useState<{ query: string; tokens: ScreenerToken[]; loading: boolean } | null>(null);
  const [coverage, setCoverage] = useState<string | null>(null);
  // Community boosts: null = not loaded yet OR endpoint unavailable.
  const [boostMap, setBoostMap] = useState<Record<string, number> | null>(null);
  const [boostsDown, setBoostsDown] = useState(false);
  // Watchlist units, persisted to localStorage — no login needed.
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  // ≤900px: rank column leaves the sticky set + Token column tightens so the
  // scrollable data window keeps ≥200px on a 390px viewport.
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Hydrate watchlist from localStorage (client-only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setWatchlist(new Set(arr.filter((u): u is string => typeof u === "string")));
        }
      }
    } catch {
      /* private mode / corrupt value — start empty */
    }
  }, []);

  const toggleWatch = (unit: string) => {
    setWatchlist((cur) => {
      const next = new Set(cur);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable — keep in-memory only */
      }
      return next;
    });
  };

  // Load + 60 s refresh + 10 s retry on failure.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Boost counts ride the same 60 s cycle, fired after each screener load.
    // Failure (e.g. 503 with no DB) hides the chips instead of breaking rows.
    const loadBoosts = async (units: string[]) => {
      if (units.length === 0) return;
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < units.length; i += BOOST_CHUNK) chunks.push(units.slice(i, i + BOOST_CHUNK));
        const results = await Promise.all(
          chunks.map(async (chunk) => {
            const res = await fetch(`/api/v1/community/boosts?units=${chunk.join(",")}`);
            if (!res.ok) throw new Error(`${res.status}`);
            return (await res.json()) as { summaries: BoostSummaryLite[] };
          })
        );
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const r of results) for (const s of r.summaries) map[s.unit] = s.boosts24h;
        setBoostMap(map);
        setBoostsDown(false);
      } catch {
        if (cancelled) return;
        setBoostMap(null);
        setBoostsDown(true);
      }
    };

    const load = async () => {
      try {
        const res = await fetch("/api/v1/tokens");
        if (!res.ok) throw new Error(`${res.status}`);
        const data: ScreenerResponse = await res.json();
        if (cancelled) return;
        setTokens(data.tokens);
        setUpdatedAt(data.updatedAt);
        setCoverage(data.coverage);
        setStatus("ok");
        void loadBoosts(data.tokens.map((t) => t.address.toLowerCase()));
      } catch {
        if (cancelled) return;
        setStatus("delayed");
        retryTimer = setTimeout(load, 10_000);
      }
    };

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // Remote search when the local registry has no match. Keyed on the query +
  // a boolean, NOT the tokens array — the 60 s refresh replaces the array
  // identity and must not wipe/refetch an already-resolved search.
  const q = search.trim().toLowerCase();
  const hasLocalMatch = useMemo(() => tokens.some((t) => matches(t, q)), [tokens, q]);
  useEffect(() => {
    if (q.length < 2 || hasLocalMatch) {
      setRemote(null);
      return;
    }
    setRemote((cur) => (cur && cur.query === q && !cur.loading ? cur : { query: q, tokens: [], loading: true }));
    const timer = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("search failed"))))
        .then((data: SearchResponse) =>
          setRemote((cur) => (cur && cur.query === q ? { query: q, tokens: data.tokens, loading: false } : cur))
        )
        .catch(() =>
          setRemote((cur) => (cur && cur.query === q ? { query: q, tokens: [], loading: false } : cur))
        );
    }, 350);
    return () => clearTimeout(timer);
  }, [q, hasLocalMatch]);

  const searching = search.trim().length > 0;
  const showAge = activeTab === "new" && !searching;
  const colCount = showAge ? 12 : 11;

  // Boosts loaded but nobody has boosted anything today — Trending falls back
  // to a 24H-volume ranking instead of rendering an empty table.
  const boostsAllZero = useMemo(
    () => boostMap != null && tokens.length > 0 && tokens.every((t) => (boostMap[t.address] ?? 0) === 0),
    [boostMap, tokens]
  );

  const rows = useMemo<RowData[]>(() => {
    const q = search.trim().toLowerCase();
    let list: RowData[];
    if (q) {
      const local = tokens.filter((t) => matches(t, q)).map((t) => ({ token: t, viaSearch: false }));
      const seen = new Set(local.map((r) => r.token.address));
      const extra =
        remote && remote.query === q
          ? remote.tokens.filter((t) => !seen.has(t.address)).map((t) => ({ token: t, viaSearch: true }))
          : [];
      list = [...local, ...extra];
      return sortRows(list, sortKey ?? "liquidity", sortKey ? sortDesc : true);
    }
    let base = [...tokens];
    if (activeTab === "gainers") base = base.filter((t) => (t.change24h ?? 0) > 0);
    else if (activeTab === "losers") base = base.filter((t) => (t.change24h ?? 0) < 0);
    else if (activeTab === "new") base = base.filter((t) => t.pairCreatedAt != null);
    else if (activeTab === "favorites") base = base.filter((t) => watchlist.has(t.address));
    else if (activeTab === "trending" && boostMap && !boostsAllZero) base = base.filter((t) => (boostMap[t.address] ?? 0) > 0);
    list = base.map((t) => ({ token: t, viaSearch: false }));
    if (activeTab === "trending" && sortKey == null) {
      // Boosts desc, tiebreak 24H volume. With the endpoint down (boostMap
      // null) every count is 0 → pure volume ranking, flagged by info note.
      return [...list].sort((a, b) => {
        const ab = boostMap?.[a.token.address] ?? 0;
        const bb = boostMap?.[b.token.address] ?? 0;
        if (bb !== ab) return bb - ab;
        return b.token.volume24h - a.token.volume24h;
      });
    }
    const def = TAB_DEFAULT[activeTab];
    return sortRows(list, sortKey ?? def.key, sortKey ? sortDesc : def.desc);
  }, [tokens, remote, search, activeTab, sortKey, sortDesc, watchlist, boostMap, boostsAllZero]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const remoteSearching = searching && remote != null && remote.loading;

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, marginBottom: 4 }}>
          Screener
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Live Cardano DEX pairs, aggregated per token · click any row for full detail
        </p>
      </header>

      {/* Coverage / honesty chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Chip>
          <DatabaseIcon />
          DEX data: {coverage ?? "SundaeSwap + WingRiders via DexScreener"}
        </Chip>
        <Chip>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-positive)", flexShrink: 0 }} />
          Prices live
        </Chip>
        <Chip>
          <UnlockIcon />
          No paywall — everything on this screen is free
        </Chip>
        <a
          href="/api/v1/tokens"
          target="_blank"
          rel="noopener noreferrer"
          title="Same data, as JSON — every human view has an API view"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
            padding: "4px 10px", borderRadius: 999,
            color: "var(--color-brand)", background: "var(--color-brand-soft)",
            border: "1px solid rgba(32, 235, 122, 0.25)",
            fontFamily: "var(--font-mono)", textDecoration: "none",
          }}
        >
          <CodeIcon />
          API · /api/v1/tokens
        </a>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <style>{`.bk-tabscroll::-webkit-scrollbar { display: none; }`}</style>
        <div
          className="bk-tabscroll"
          style={{
            display: "flex", gap: 2, padding: 3, background: "var(--color-bg-elevated)", borderRadius: 6, border: "1px solid var(--color-border)",
            maxWidth: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
          }}
        >
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSortKey(null); setSortDesc(true); }}
                title={t.help}
                style={{
                  padding: "6px 14px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                  minHeight: 40, flexShrink: 0,
                  background: active ? "var(--color-bg-hover)" : "transparent",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  transition: "color 120ms, background 120ms",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 340 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search symbol or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px", background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)", borderRadius: 6,
              color: "var(--color-text-primary)", fontSize: 13, outline: "none",
            }}
          />
        </div>
      </div>

      {/* Delayed banner (stale data still on screen) */}
      {status === "delayed" && tokens.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 10,
          background: "rgba(255, 193, 7, 0.08)", border: "1px solid rgba(255, 193, 7, 0.25)",
          borderRadius: 6, color: "var(--color-warning)", fontSize: 12, fontWeight: 600,
        }}>
          <WarningIcon />
          data delayed — retrying
        </div>
      )}

      {/* Trending fallback note when the boosts endpoint is unavailable */}
      {activeTab === "trending" && boostsDown && !searching && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 10,
          background: "rgba(112, 236, 253, 0.08)", border: "1px solid rgba(112, 236, 253, 0.25)",
          borderRadius: 6, color: "var(--color-info)", fontSize: 12, fontWeight: 600,
        }}>
          <InfoIcon />
          Community boosts temporarily unavailable — ranking by 24H volume instead.
        </div>
      )}

      {/* Trending fallback note when boosts loaded but none cast yet today */}
      {activeTab === "trending" && !boostsDown && boostsAllZero && !searching && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", marginBottom: 10,
          background: "rgba(112, 236, 253, 0.08)", border: "1px solid rgba(112, 236, 253, 0.25)",
          borderRadius: 6, color: "var(--color-info)", fontSize: 12, fontWeight: 600,
        }}>
          <InfoIcon />
          No boosts yet today — showing 24H volume · connect a wallet and cast the first boost
        </div>
      )}

      {/* Table */}
      <div style={{
        background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)", overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1016 }}>
            <thead>
              <tr style={{ background: "var(--color-bg-secondary)", borderBottom: "1px solid var(--color-border)" }}>
                <th aria-label="Watchlist" style={{ ...thStyle, textAlign: "center", width: 44, minWidth: 44, padding: "10px 2px", position: "sticky", left: 0, zIndex: 3, background: "var(--color-bg-secondary)" }}>
                  <span style={{ display: "inline-flex", color: "var(--color-text-muted)" }}><StarIcon filled={false} /></span>
                </th>
                <th style={{
                  ...thStyle, textAlign: "left", width: 44, minWidth: 44,
                  ...(isNarrow ? {} : { position: "sticky" as const, left: 44, zIndex: 3, background: "var(--color-bg-secondary)" }),
                }}>#</th>
                <th style={{
                  ...thStyle, textAlign: "left", minWidth: isNarrow ? 140 : 200,
                  position: "sticky", left: isNarrow ? 44 : 88, zIndex: 3, background: "var(--color-bg-secondary)",
                }}>Token</th>
                {showAge && <SortTh label="Age" k="age" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />}
                <SortTh label="Price" k="price" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
                <SortTh label="1H %" k="change1h" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
                <SortTh label="6H %" k="change6h" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
                <SortTh label="24H %" k="change24h" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
                <SortTh label="24H Volume" k="volume24h" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
                <SortTh label="Liquidity" k="liquidity" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
                <SortTh label="24H Txns" k="txns" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
                <SortTh label="Mcap" k="mcap" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {status === "loading" ? (
                Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
              ) : status === "delayed" && tokens.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: 48, textAlign: "center", color: "var(--color-warning)", fontSize: 13, fontWeight: 600 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <WarningIcon />
                      data delayed — retrying
                    </span>
                  </td>
                </tr>
              ) : rows.length === 0 && activeTab === "favorites" && !searching ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: 16 }}>
                    <div
                      onClickCapture={(e) => {
                        if ((e.target as HTMLElement).closest("button")) setActiveTab("top");
                      }}
                      style={{ position: "sticky", left: 16, maxWidth: "calc(100vw - 96px)" }}
                    >
                      <EmptyState
                        svg={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        }
                        title="No favorites yet"
                        description="Star tokens to build your watchlist — no login needed"
                        action="Browse top tokens"
                      />
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                    {remoteSearching
                      ? "searching DEX pairs…"
                      : searching
                      ? "No matches on SundaeSwap or WingRiders."
                      : activeTab === "trending"
                      ? "No boosts yet today — connect a wallet on any token page and cast the first one."
                      : "No tokens in this view."}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <TokenRow
                    key={row.token.address}
                    row={row}
                    rank={i + 1}
                    showAge={showAge}
                    boosts={boostMap?.[row.token.address] ?? 0}
                    narrow={isNarrow}
                    watched={watchlist.has(row.token.address)}
                    onToggleWatch={() => toggleWatch(row.token.address)}
                    onOpen={() => router.push(`/tokens/${row.token.address}`)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {status !== "loading" && (
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 10, letterSpacing: 0.3, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span>{rows.length} token{rows.length === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>DEX data: {coverage ?? "SundaeSwap + WingRiders via DexScreener"}</span>
          {updatedAt && (
            <>
              <span>·</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>updated {new Date(updatedAt).toLocaleTimeString()}</span>
            </>
          )}
          <span>·</span>
          <span>refreshes every 60s</span>
        </div>
      )}
    </div>
  );
}

/* ─── Table pieces ───────────────────────────────────────── */

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  whiteSpace: "nowrap",
};

function SortTh({ label, k, sortKey, sortDesc, onSort }: {
  label: string; k: SortKey; sortKey: SortKey | null; sortDesc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onSort(k)}
      style={{
        ...thStyle,
        textAlign: "right",
        cursor: "pointer",
        userSelect: "none",
        color: active ? "var(--color-text-primary)" : "var(--color-text-muted)",
      }}
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: 8, opacity: active ? 1 : 0 }}>
        {active && !sortDesc ? "▲" : "▼"}
      </span>
    </th>
  );
}

function TokenRow({ row, rank, showAge, boosts, narrow, watched, onToggleWatch, onOpen }: {
  row: RowData; rank: number; showAge: boolean; boosts: number; narrow: boolean;
  watched: boolean; onToggleWatch: () => void; onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const t = row.token;
  const stickyBg = hovered ? "var(--color-bg-hover)" : "var(--color-bg-elevated)";

  return (
    <tr
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      tabIndex={0}
      role="link"
      style={{
        borderBottom: "1px solid var(--color-border-soft)",
        cursor: "pointer",
        background: hovered ? "var(--color-bg-hover)" : "transparent",
        transition: "background 100ms",
      }}
    >
      <td style={{ ...tdStyle, width: 44, minWidth: 44, padding: "5px 2px", textAlign: "center", position: "sticky", left: 0, zIndex: 1, background: stickyBg }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWatch(); }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={watched ? `Remove ${t.symbol} from watchlist` : `Add ${t.symbol} to watchlist`}
          aria-pressed={watched}
          title={watched ? "Remove from watchlist" : "Add to watchlist"}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, borderRadius: 4, background: "transparent",
            color: watched ? "var(--color-brand)" : "var(--color-text-muted)",
            transition: "color 120ms",
          }}
        >
          <StarIcon filled={watched} size={20} />
        </button>
      </td>
      <td style={{
        ...tdStyle, width: 44, minWidth: 44,
        ...(narrow ? {} : { position: "sticky" as const, left: 44, zIndex: 1, background: stickyBg }),
      }}>
        <span style={{ color: "var(--color-text-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}>{rank}</span>
      </td>
      <td style={{ ...tdStyle, minWidth: narrow ? 140 : 200, position: "sticky", left: narrow ? 44 : 88, zIndex: 1, background: stickyBg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TokenLogo unit={t.address} symbol={t.symbol} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>{t.symbol}</span>
              {boosts > 0 && <BoostChip count={boosts} />}
              {t.dexIds.map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                    padding: "1px 5px", borderRadius: 4,
                    border: "1px solid var(--color-border)", color: "var(--color-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {DEX_LABELS[d] ?? d}
                </span>
              ))}
              {row.viaSearch && (
                <span style={{
                  fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                  padding: "1px 5px", borderRadius: 4,
                  border: "1px solid rgba(112, 236, 253, 0.25)", background: "rgba(112, 236, 253, 0.08)",
                  color: "var(--color-info)", whiteSpace: "nowrap",
                }}>
                  via search
                </span>
              )}
            </div>
            {!narrow && (
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
                {t.name}
              </div>
            )}
          </div>
        </div>
      </td>
      {showAge && (
        <td style={{ ...tdStyle, textAlign: "right" }}>
          <span style={{ fontSize: 12.5, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
            {fmtAge(t.pairCreatedAt)}
          </span>
        </td>
      )}
      <NumTd>{fmtPrice(t.priceUsd)}</NumTd>
      <PctTd v={t.change1h} />
      <PctTd v={t.change6h} />
      <PctTd v={t.change24h} />
      <NumTd>{fmtCompact(t.volume24h)}</NumTd>
      <NumTd>{fmtCompact(t.liquidityUsd)}</NumTd>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
            <span style={{ color: "var(--color-positive)" }}>{t.buys24h.toLocaleString("en-US")}</span>
            <span style={{ color: "var(--color-text-muted)" }}> / </span>
            <span style={{ color: "var(--color-negative)" }}>{t.sells24h.toLocaleString("en-US")}</span>
          </span>
          <PressureBar buys={t.buys24h} sells={t.sells24h} />
        </div>
      </td>
      <NumTd>{fmtCompact(t.marketCap)}</NumTd>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

function NumTd({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ ...tdStyle, textAlign: "right" }}>
      <span style={{ fontSize: 12.5, fontFamily: "var(--font-mono)" }}>{children}</span>
    </td>
  );
}

function PctTd({ v }: { v: number | null }) {
  const color =
    v == null || v === 0 ? "var(--color-text-muted)"
    : v > 0 ? "var(--color-positive)"
    : "var(--color-negative)";
  return (
    <td style={{ ...tdStyle, textAlign: "right" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-mono)", color }}>{fmtPct(v)}</span>
    </td>
  );
}

/** Buy/sell pressure micro-bar: green vs red split by 24H buys/sells ratio. */
function PressureBar({ buys, sells }: { buys: number; sells: number }) {
  const total = buys + sells;
  return (
    <div style={{ width: 40, height: 3, borderRadius: 2, overflow: "hidden", display: "flex", background: "var(--color-border)" }}>
      {total > 0 && (
        <>
          <div style={{ width: `${(buys / total) * 100}%`, background: "var(--color-positive)" }} />
          <div style={{ flex: 1, background: "var(--color-negative)" }} />
        </>
      )}
    </div>
  );
}

/** Token avatar via the logo API route (always answers with an image and
 * falls back upstream itself) — the letter monogram is load-error-only. */
function TokenLogo({ unit, symbol }: { unit: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        background: "var(--color-bg-hover)", border: "1px solid var(--color-border)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, color: "var(--color-text-secondary)",
      }}>
        {symbol.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/v1/tokens/${unit}/logo`}
      alt=""
      width={22}
      height={22}
      onError={() => setFailed(true)}
      style={{ borderRadius: "50%", flexShrink: 0, background: "var(--color-bg-hover)", objectFit: "cover" }}
    />
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--color-border-soft)" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "13px 12px" }}>
          <span style={{
            display: "block", height: 10, borderRadius: 3,
            width: i === 0 ? 12 : i === 2 ? "80%" : "60%",
            marginLeft: i > 2 ? "auto" : undefined,
            background: "var(--color-bg-secondary)",
          }} />
        </td>
      ))}
    </tr>
  );
}

/* ─── Chips & icons ──────────────────────────────────────── */

/** Flame chip with the 24H community-boost count (free, 1 per wallet per day). */
function BoostChip({ count }: { count: number }) {
  return (
    <span
      title={`${count} community boost${count === 1 ? "" : "s"} in the last 24H — free, one per wallet per UTC day`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
        padding: "1px 6px", borderRadius: 999,
        color: "var(--color-brand)", background: "var(--color-brand-soft)",
        border: "1px solid rgba(32, 235, 122, 0.25)", whiteSpace: "nowrap",
      }}
    >
      <FlameIcon />
      {count.toLocaleString("en-US")}
    </span>
  );
}

function StarIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11, color: "var(--color-text-secondary)",
      padding: "4px 10px", borderRadius: 999,
      background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)",
      // The coverage string is long — wrapping beats forcing 500px+ of page
      // width on phones (the 390px-viewport blocker class from the audit).
      maxWidth: "100%", lineHeight: 1.4,
    }}>
      {children}
    </span>
  );
}

function DatabaseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
