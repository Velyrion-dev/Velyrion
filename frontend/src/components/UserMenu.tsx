"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleBadgeColor: Record<string, string> = {
    ADMIN: "var(--accent-red)",
    OPERATOR: "var(--accent-yellow)",
    VIEWER: "var(--accent-cyan)",
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="user-menu-wrapper" ref={ref}>
      <button className="user-menu-trigger" onClick={() => setOpen(!open)}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.name} className="user-avatar" />
        ) : (
          <div className="user-avatar-initials">{initials}</div>
        )}
        <div className="user-menu-info">
          <span className="user-menu-name">{user.name}</span>
          <span className="user-menu-role" style={{ color: roleBadgeColor[user.role] || "var(--text-muted)" }}>
            {user.role}
          </span>
        </div>
        <span className="user-menu-chevron" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-dropdown-header">
            <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user.email}</div>
          </div>
          <div className="user-menu-dropdown-divider" />
          <button className="user-menu-dropdown-item" onClick={() => { setOpen(false); }}>
            👤 Profile Settings
          </button>
          <button className="user-menu-dropdown-item" onClick={() => { setOpen(false); }}>
            🔑 API Keys
          </button>
          <div className="user-menu-dropdown-divider" />
          <button className="user-menu-dropdown-item user-menu-logout" onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
