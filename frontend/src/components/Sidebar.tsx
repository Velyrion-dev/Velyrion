"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";
import {
  LayoutDashboard,
  Radio,
  Activity,
  BarChart3,
  Bot,
  Cpu,
  Network,
  GitFork,
  ShieldCheck,
  CheckCircle2,
  ShieldAlert,
  AlertOctagon,
  HeartPulse,
  Award,
  FileCheck,
  History,
  FlaskConical,
  Sparkles,
  Building2,
  Webhook,
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  Dna,
  Zap,
  SearchCode,
  Coins,
  Crosshair,
  Trophy,
  SlidersHorizontal,
  Grid,
  Lock,
  FileText,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const PRIMARY_SECTIONS: NavSection[] = [
  {
    title: "Telemetry & Logs",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/live", label: "Live Telemetry", icon: Radio },
      { href: "/events", label: "Event Stream", icon: Activity },
      { href: "/analytics", label: "Metrics & Trends", icon: BarChart3 },
    ],
  },
  {
    title: "Fleet Management",
    items: [
      { href: "/agents", label: "Agent Fleet", icon: Bot },
      { href: "/connect", label: "Connect Agent", icon: Cpu },
      { href: "/graph", label: "Topology Graph", icon: Network },
      { href: "/multi-agent", label: "Multi-Agent Mesh", icon: GitFork },
    ],
  },
  {
    title: "Governance & Safety",
    items: [
      { href: "/policies", label: "Policy Engine", icon: ShieldCheck },
      { href: "/approvals", label: "HITL Approvals", icon: CheckCircle2 },
      { href: "/violations", label: "Violations & Guardrails", icon: ShieldAlert },
      { href: "/incidents", label: "Incidents & War Room", icon: AlertOctagon },
    ],
  },
  {
    title: "Audit & Intelligence",
    items: [
      { href: "/governance-score", label: "Governance Score", icon: Award },
      { href: "/regulatory", label: "Regulatory Compliance", icon: FileCheck },
      { href: "/replay", label: "Execution Replay", icon: History },
      { href: "/sandbox", label: "Sandbox Simulation", icon: FlaskConical },
      { href: "/copilot", label: "Governance Copilot", icon: Sparkles },
    ],
  },
  {
    title: "Organization",
    items: [
      { href: "/org", label: "Organization & Teams", icon: Building2 },
      { href: "/webhooks", label: "Webhooks & Alerts", icon: Webhook },
      { href: "/status", label: "System Health", icon: HeartPulse },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const EXTENDED_MODULES: NavItem[] = [
  { href: "/behavioral-dna", label: "Behavioral Profiling", icon: Dna },
  { href: "/threat-intel", label: "Threat Intelligence", icon: Zap },
  { href: "/forensics", label: "Trace Forensics", icon: SearchCode },
  { href: "/cost-optimizer", label: "Token Cost Optimizer", icon: Coins },
  { href: "/insurance-scoring", label: "Insurance Risk Model", icon: Shield },
  { href: "/trust-registry", label: "Trust Registry", icon: ShieldCheck },
  { href: "/trust-mesh", label: "Trust Mesh Protocol", icon: Network },
  { href: "/oags", label: "OAGS Protocol Spec", icon: FileText },
  { href: "/mission-control", label: "Mission Control", icon: Crosshair },
  { href: "/leaderboard", label: "Fleet Leaderboard", icon: Trophy },
  { href: "/compare", label: "Agent Comparator", icon: SlidersHorizontal },
  { href: "/heatmap", label: "Activity Heatmap", icon: Grid },
  { href: "/admin", label: "Platform Admin", icon: Lock },
  { href: "/docs", label: "API Documentation", icon: FileText },
];

export default function Sidebar({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  // Auto-expand specialized modules if currently on one of their pages
  const isExtendedActive = EXTENDED_MODULES.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const [extendedOpen, setExtendedOpen] = useState(isExtendedActive);

  return (
    <aside className={`sidebar ${className}`}>
      {/* Brand Header */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Shield style={{ width: 18, height: 18 }} />
        </div>
        <div className="sidebar-logo-text">
          <h1>
            VELYRION
            <span className="sidebar-logo-badge">Enterprise</span>
          </h1>
          <p>Agent Governance Layer</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="sidebar-nav">
        {PRIMARY_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="nav-section-label">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${isActive ? "active" : ""}`}
                >
                  <Icon className="nav-icon" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        {/* Collapsible Extended Tools Drawer */}
        <button
          type="button"
          onClick={() => setExtendedOpen(!extendedOpen)}
          className="nav-special-toggle"
          aria-expanded={extendedOpen}
        >
          <span>Extended Modules ({EXTENDED_MODULES.length})</span>
          {extendedOpen ? (
            <ChevronDown style={{ width: 14, height: 14, opacity: 0.7 }} />
          ) : (
            <ChevronRight style={{ width: 14, height: 14, opacity: 0.7 }} />
          )}
        </button>

        {extendedOpen && (
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 1 }}>
            {EXTENDED_MODULES.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${isActive ? "active" : ""}`}
                  style={{ paddingLeft: 12 }}
                >
                  <Icon className="nav-icon" />
                  <span style={{ fontSize: 12.5 }}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer controls */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "8px 0 0" }}>
        <UserMenu />
        <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          <ThemeToggle />
          <Link
            href="/"
            className="btn btn-ghost btn-sm"
            style={{ width: "100%", justifyContent: "center", fontSize: 11 }}
          >
            ← Marketing Site
          </Link>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <span className="pulse-dot pulse-green" />
            Governance Node Operational
          </div>
        </div>
      </div>
    </aside>
  );
}
