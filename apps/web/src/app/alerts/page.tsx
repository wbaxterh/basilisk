"use client";

import { useState, useEffect, useCallback } from "react";
import EmptyState from "../../components/EmptyState";
import { fetchAlerts, createAlert, deleteAlert, type AlertRuleData } from "../../lib/api";

const RULE_TYPES = [
  { value: "price_above", label: "Price Above" },
  { value: "price_below", label: "Price Below" },
  { value: "pct_change", label: "% Change (24h)" },
];

// Placeholder user ID until auth is built.
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [asset, setAsset] = useState("");
  const [type, setType] = useState("price_above");
  const [threshold, setThreshold] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlerts(data);
    } catch {
      // API offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleCreate = async () => {
    if (!asset.trim() || !threshold.trim()) return;
    setSubmitting(true);
    try {
      const condition = type === "pct_change"
        ? { pctThreshold: parseFloat(threshold) }
        : { threshold };
      await createAlert({ userId: DEMO_USER_ID, type, asset: asset.trim(), condition });
      setAsset("");
      setThreshold("");
      setShowForm(false);
      await loadAlerts();
    } catch {
      // Handle error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // Handle error
    }
  };

  const inputStyle = {
    padding: "10px 14px", borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)", background: "var(--color-bg-elevated)",
    color: "var(--color-text-primary)", fontSize: 14, outline: "none", width: "100%" as const,
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Alerts</h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: 14, margin: 0 }}>
            Price alerts, whale moves, and balance change notifications.
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: "10px 20px", borderRadius: "var(--radius-md)", background: "var(--color-brand)",
          color: "#fff", fontWeight: 600, fontSize: 14,
        }}>
          {showForm ? "Cancel" : "+ New Alert"}
        </button>
      </div>

      {/* Create alert form */}
      {showForm && (
        <div style={{
          background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)",
          padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>Asset ID</label>
              <input type="text" placeholder="policyId + assetName" value={asset} onChange={(e) => setAsset(e.target.value)} style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>Rule Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
                {type === "pct_change" ? "% Threshold" : "Price Threshold (ADA)"}
              </label>
              <input type="number" step="any" placeholder={type === "pct_change" ? "e.g. 10" : "e.g. 0.05"} value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ ...inputStyle, fontFamily: "var(--font-mono)" }} />
            </div>
          </div>
          <button onClick={handleCreate} disabled={submitting || !asset.trim() || !threshold.trim()} style={{
            alignSelf: "flex-end", padding: "10px 24px", borderRadius: "var(--radius-md)",
            background: "var(--color-brand)", color: "#fff", fontWeight: 600, fontSize: 14,
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? "Creating..." : "Create Alert"}
          </button>
        </div>
      )}

      {/* Alerts list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>Loading alerts...</div>
      ) : alerts.length === 0 && !showForm ? (
        <EmptyState icon="🔔" title="No alerts configured" description="Create price alerts, whale movement notifications, or balance change triggers. Get notified when conditions are met." action="Create Alert" />
      ) : alerts.length > 0 ? (
        <div style={{ background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--color-border)", fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
            <span>Asset</span>
            <span>Type</span>
            <span>Condition</span>
            <span></span>
          </div>
          {alerts.map((a) => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px", gap: 16, padding: "12px 20px", borderBottom: "1px solid var(--color-border)", fontSize: 13, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                {a.asset ? (a.asset.length > 24 ? `${a.asset.slice(0, 10)}...${a.asset.slice(-6)}` : a.asset) : "—"}
              </span>
              <span style={{ color: "var(--color-text-secondary)" }}>
                {RULE_TYPES.find((t) => t.value === a.type)?.label || a.type}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
                {formatCondition(a.type, a.condition)}
              </span>
              <button onClick={() => handleDelete(a.id)} style={{ fontSize: 12, color: "var(--color-negative)", textAlign: "right" }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatCondition(type: string, condition: Record<string, unknown>): string {
  if (type === "pct_change") return `${condition.pctThreshold}%`;
  if (condition.threshold) return `${condition.threshold} ADA`;
  return JSON.stringify(condition);
}
