"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";

const NAV_ITEMS = [
  { section: "Overview" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/events", label: "Activity Feed", icon: "⚡" },
  { section: "Governance" },
  { href: "/agents", label: "Agent Registry", icon: "🤖" },
  { href: "/policies", label: "Policies", icon: "📜" },
  { href: "/violations", label: "Violations", icon: "🛡️" },
  { href: "/anomalies", label: "Anomalies", icon: "⚠️" },
  { href: "/incidents", label: "Incidents", icon: "🚨" },
  { section: "Intelligence" },
  { href: "/replay", label: "Agent Replay", icon: "🔍" },
  { section: "Operations" },
  { href: "/approvals", label: "Approvals", icon: "✋" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
  { href: "/webhooks", label: "Webhooks", icon: "🔗" },
  { href: "/reports", label: "Reports", icon: "📋" },
];

export default function Sidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-logo">
        <h1>VELYRION</h1>
        <p>Agent Governance Platform</p>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item, i) => {
          if ("section" in item && !("href" in item)) {
            return <div key={i} className="nav-section-label">{item.section}</div>;
          }
          if (!("href" in item)) return null;
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href!);
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "8px 0 0" }}>
        <UserMenu />
        <div style={{ padding: "8px 16px" }}>
          <Link href="/" className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginBottom: 6, fontSize: 11 }}>
            ← Marketing Site
          </Link>
          <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            <span className="pulse-dot pulse-green" />
            System Operational · v2.0
          </div>
        </div>
      </div>
    </aside>
  );
}
