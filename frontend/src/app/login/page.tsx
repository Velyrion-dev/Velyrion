"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, googleLogin, isAuthenticated, isLoading } = useAuth();
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
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError("Google sign-in failed — no credential received.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Call our Next.js API proxy (same-origin, no CORS issues)
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      
      // Read as text first to handle non-JSON responses
      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        // Response is not JSON (probably HTML error page)
        setError(`Server error (${res.status}): ${text.substring(0, 100)}`);
        return;
      }
      
      if (!res.ok) {
        setError(String(data.detail || data.error || data.message || "Sign-in failed. Please try again."));
        return;
      }
      
      // Success! Save tokens and redirect
      localStorage.setItem("velyrion_access_token", data.access_token as string);
      localStorage.setItem("velyrion_refresh_token", data.refresh_token as string);
      localStorage.setItem("velyrion_user", JSON.stringify(data.user));
      router.push("/dashboard");
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Google sign-in error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-text" style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.15em", color: "var(--text-primary)" }}>
              VELYRION
            </div>
            <div className="auth-logo-sub" style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>
              Enterprise Safety &amp; Control Plane
            </div>
          </div>

          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-subtitle">Sign in to your enterprise governance workspace</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@velyrion.com" required autoFocus autoComplete="email" />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <Link href="/forgot-password" className="auth-link" style={{ fontSize: 12 }}>Forgot password?</Link>
            </div>
            <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : "Sign in"}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in was cancelled or failed.")}
              theme="filled_black"
              size="large"
              width="350"
              text="signin_with"
              shape="rectangular"
            />
          </div>

          <div className="auth-footer">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="auth-link">Create account</Link>
          </div>

          <div className="auth-demo">
            <div className="auth-demo-title">Demo Accounts</div>
            <div className="auth-demo-row" onClick={() => { setEmail("admin@velyrion.com"); setPassword(""); }}>
              <span className="auth-demo-badge admin">ADMIN</span>
              <span>admin@velyrion.com</span>
            </div>
            <div className="auth-demo-row" onClick={() => { setEmail("operator@velyrion.com"); setPassword(""); }}>
              <span className="auth-demo-badge operator">OPERATOR</span>
              <span>operator@velyrion.com</span>
            </div>
            <div className="auth-demo-row" onClick={() => { setEmail("viewer@velyrion.com"); setPassword(""); }}>
              <span className="auth-demo-badge viewer">VIEWER</span>
              <span>viewer@velyrion.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
