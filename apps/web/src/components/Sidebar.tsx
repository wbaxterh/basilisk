"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import BrandLogo from "./BrandLogo";
import { DOCS_URL } from "@/lib/site";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Screener", href: "/screener", icon: "search" },
  { label: "Portfolio", href: "/portfolio", icon: "briefcase" },
  { label: "Dashboard", href: "/dashboard", icon: "home" },
  { label: "Alerts", href: "/alerts", icon: "bell" },
  { label: "Agents", href: "/agents", icon: "robot" },
];

/** Simple SVG icons — keep it lightweight, no icon library needed. */
function NavIcon({ name }: { name: string }) {
  const size = 20;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 12l9-9 9 9" /><path d="M9 21V12h6v9" /><rect x="5" y="12" width="14" height="9" rx="1" /></svg>;
    case "briefcase":
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>;
    case "chart":
      return <svg {...common}><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-6" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
    case "wallet":
      return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M16 12h.01" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case "robot":
      return <svg {...common}><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 5v4" /><circle cx="12" cy="4" r="1" /><path d="M9 14h.01" /><path d="M15 14h.01" /><path d="M2 13v3" /><path d="M22 13v3" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bk-sidebar" style={{
      width: "var(--sidebar-width)",
      height: "100vh",
      position: "fixed",
      top: 0,
      left: 0,
      background: "var(--color-bg-secondary)",
      borderRight: "1px solid var(--color-border)",
      display: "flex",
      flexDirection: "column",
      zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 20px",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <BrandLogo size={24} wordmarkSize={22} />
      </Link>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 8px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) ||
                // Token detail pages live under /tokens but belong to the Screener flow.
                (item.href === "/screener" && pathname.startsWith("/tokens"));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
                background: isActive ? "var(--color-brand-soft)" : "transparent",
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                transition: "all 0.15s",
                marginBottom: 2,
              }}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer nav — back out to the landing page, docs, and API */}
      <div style={{
        padding: "14px 20px",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <Link
          href="/"
          style={{ fontSize: 12, color: "var(--color-text-muted)", transition: "color 120ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          ← Home
        </Link>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: "var(--color-text-muted)", transition: "color 120ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          Docs
        </a>
        <a
          href="/api/v1"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", transition: "color 120ms" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          API
        </a>
      </div>
    </aside>
  );
}
