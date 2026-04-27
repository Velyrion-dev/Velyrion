"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
      </div>

      <div className="auth-container">
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo-text">VELYRION</div>
            <div className="auth-logo-sub">Agent Governance Platform</div>
          </div>

          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to your governance dashboard</p>

          {error && (
            <div className="auth-error">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@velyrion.ai"
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <Link href="/forgot-password" className="auth-link" style={{ fontSize: 12 }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button className="auth-btn auth-btn-google" onClick={() => setError("Configure GOOGLE_CLIENT_ID in .env to enable Google Sign-In")}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>

          <div className="auth-footer">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="auth-link">Create account</Link>
          </div>

          {/* Demo credentials */}
          <div className="auth-demo">
            <div className="auth-demo-title">Demo Accounts</div>
            <div className="auth-demo-row" onClick={() => { setEmail("admin@velyrion.ai"); setPassword("admin123"); }}>
              <span className="auth-demo-badge admin">ADMIN</span>
              <span>admin@velyrion.ai</span>
            </div>
            <div className="auth-demo-row" onClick={() => { setEmail("operator@velyrion.ai"); setPassword("operator123"); }}>
              <span className="auth-demo-badge operator">OPERATOR</span>
              <span>operator@velyrion.ai</span>
            </div>
            <div className="auth-demo-row" onClick={() => { setEmail("viewer@velyrion.ai"); setPassword("viewer123"); }}>
              <span className="auth-demo-badge viewer">VIEWER</span>
              <span>viewer@velyrion.ai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
