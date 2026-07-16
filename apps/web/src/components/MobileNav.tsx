"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

/** Same IA as Sidebar minus Alerts — 5 tabs still fit at 390px (~78px each). */
const NAV_ITEMS: NavItem[] = [
  { label: "Screener", href: "/screener", icon: "search" },
  { label: "DeFi", href: "/defi", icon: "chart" },
  { label: "Portfolio", href: "/portfolio", icon: "briefcase" },
  { label: "Dashboard", href: "/dashboard", icon: "home" },
  { label: "Agents", href: "/agents", icon: "robot" },
];

/** Same stroke SVG shapes as Sidebar's NavIcon — duplicated to keep both components self-contained. */
function NavIcon({ name }: { name: string }) {
  const size = 20;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 12l9-9 9 9" /><path d="M9 21V12h6v9" /><rect x="5" y="12" width="14" height="9" rx="1" /></svg>;
    case "briefcase":
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
    case "chart":
      return <svg {...common}><path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 5-6" /></svg>;
    case "robot":
      return <svg {...common}><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 5v4" /><circle cx="12" cy="4" r="1" /><path d="M9 14h.01" /><path d="M15 14h.01" /><path d="M2 13v3" /><path d="M22 13v3" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

/** Fixed bottom tab bar — only visible ≤900px via the .bk-mobilenav class in globals.css. */
export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bk-mobilenav"
      aria-label="Primary"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "calc(56px + env(safe-area-inset-bottom))",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "var(--color-bg-secondary)",
        borderTop: "1px solid var(--color-border)",
        alignItems: "stretch",
        zIndex: 200,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname.startsWith(item.href) ||
          // Token detail pages live under /tokens but belong to the Screener flow.
          (item.href === "/screener" && pathname.startsWith("/tokens"));
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
              fontWeight: isActive ? 600 : 400,
              transition: "color 0.15s",
            }}
          >
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "3px 14px",
              borderRadius: 999,
              background: isActive ? "var(--color-brand-soft)" : "transparent",
              transition: "background 0.15s",
            }}>
              <NavIcon name={item.icon} />
            </span>
            <span style={{ fontSize: 10, letterSpacing: 0.3 }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
