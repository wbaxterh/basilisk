"use client";

import { useState, useCallback } from "react";
import EmptyState from "../../../components/EmptyState";
import { fetchProfile, type ProfileData } from "../../../lib/api";

export default function WalletsPage() {
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = useCallback(async () => {
    const addr = input.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfile(addr);
      setProfile(data);
    } catch {
      setError("Could not load profile. Check the address and ensure the API gateway is running.");
    } finally {
      setLoading(false);
    }
  }, [input]);

  const totalAda = profile ? parseFloat(profile.totalValueAda) : 0;

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Wallet Profiler
      </h1>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Look up any Cardano address — holdings, value, and DEX activity.
      </p>

      {/* Address input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Enter stake address (stake1u...) or payment address (addr1q...)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          style={{
            flex: 1, padding: "10px 16px", borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
            color: "var(--color-text-primary)", fontSize: 14, fontFamily: "var(--font-mono)", outline: "none",
          }}
        />
        <button onClick={handleLookup} disabled={loading} style={{
          padding: "10px 20px", borderRadius: "var(--radius-md)", background: "var(--color-brand)",
          color: "#fff", fontWeight: 600, fontSize: 14, opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Loading..." : "Profile"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.1)", color: "var(--color-negative)", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!profile ? (
        <EmptyState icon="👛" title="Profile any wallet" description="Enter a Cardano stake or payment address to see holdings, total value, and recent DEX activity." />
      ) : (
        <>
          {/* Summary */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px",
            background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 4 }}>Total Value</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{formatAda(totalAda)} ADA</div>
            </div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
              {profile.stakeAddress ? `${profile.stakeAddress.slice(0, 12)}...${profile.stakeAddress.slice(-6)}` : profile.address.slice(0, 16) + "..."}
            </div>
          </div>

          {/* Holdings table */}
          <div style={{
            background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden", marginBottom: 16,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--color-border)", fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
              <span>Asset</span>
              <span style={{ textAlign: "right" }}>Ticker</span>
              <span style={{ textAlign: "right" }}>Quantity</span>
              <span style={{ textAlign: "right" }}>Value (ADA)</span>
            </div>
            {profile.holdings.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)", fontSize: 14 }}>No holdings found.</div>
            ) : (
              profile.holdings.map((h) => (
                <div key={h.asset} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: h.asset === "lovelace" ? "var(--color-brand)" : "var(--color-text-primary)", fontWeight: h.asset === "lovelace" ? 600 : 400 }}>
                    {h.asset === "lovelace" ? "ADA" : h.asset.length > 24 ? `${h.asset.slice(0, 10)}...${h.asset.slice(-6)}` : h.asset}
                  </span>
                  <span style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>{h.ticker || "—"}</span>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
                    {h.asset === "lovelace" ? formatAda(Number(h.quantity) / 1_000_000) : Number(h.quantity).toLocaleString()}
                  </span>
                  <span style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{formatAda(parseFloat(h.valueAda))}</span>
                </div>
              ))
            )}
          </div>

          {/* Activity */}
          {profile.activity.length > 0 && (
            <div style={{ background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>Recent DEX Activity</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {profile.activity.slice(0, 20).map((a, i) => (
                  <div key={`${a.txHash}-${i}`} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 100px", gap: 8, padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-hover)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                    <span style={{ color: "var(--color-text-muted)" }}>{a.dex}</span>
                    <span style={{ color: "var(--color-text-secondary)" }}>{a.amountIn} in</span>
                    <span style={{ color: "var(--color-text-secondary)" }}>{a.amountOut} out</span>
                    <span style={{ color: "var(--color-text-muted)", textAlign: "right" }}>{new Date(a.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(2)}K`;
  return ada.toFixed(2);
}
