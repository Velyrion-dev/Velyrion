"use client";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { ToastProvider } from "./ToastProvider";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password"];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublic) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, isPublic, router]);

  // Public pages (landing, login, signup)
  if (isPublic) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  // Loading auth state
  if (isLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--bg-primary)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 36, fontWeight: 800, letterSpacing: 3,
            background: "linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 16,
          }}>VELYRION</div>
          <div className="loading-shimmer" style={{ width: 200, height: 4, borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  // Not authenticated — will redirect via useEffect
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated — show sidebar layout
  return (
    <ToastProvider>
      <button
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>
      <div className={sidebarOpen ? "sidebar-overlay active" : "sidebar-overlay"} onClick={() => setSidebarOpen(false)} />
      <Sidebar className={sidebarOpen ? "open" : ""} />
      <main className="main-content">{children}</main>
    </ToastProvider>
  );
}
