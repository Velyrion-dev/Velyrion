"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

interface UserData {
  user_id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: string;
  email_verified: boolean;
  created_at: string;
}

interface AuthContextType {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function authFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

async function authFetchWithToken(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("velyrion_access_token");
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveTokens = (accessToken: string, refreshToken: string, userData: UserData) => {
    localStorage.setItem("velyrion_access_token", accessToken);
    localStorage.setItem("velyrion_refresh_token", refreshToken);
    localStorage.setItem("velyrion_user", JSON.stringify(userData));
    setUser(userData);
  };

  const clearTokens = () => {
    localStorage.removeItem("velyrion_access_token");
    localStorage.removeItem("velyrion_refresh_token");
    localStorage.removeItem("velyrion_user");
    setUser(null);
  };

  const tryRefresh = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem("velyrion_refresh_token");
    if (!refreshToken) return false;
    try {
      const data = await authFetch("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      saveTokens(data.access_token, data.refresh_token, data.user);
      return true;
    } catch {
      clearTokens();
      return false;
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("velyrion_access_token");
      const cachedUser = localStorage.getItem("velyrion_user");

      if (!token) {
        setIsLoading(false);
        return;
      }

      // Try cached user first for instant UI
      if (cachedUser) {
        try { setUser(JSON.parse(cachedUser)); } catch { /* ignore */ }
      }

      // Verify token with server
      try {
        const me = await authFetchWithToken("/api/auth/me");
        setUser(me);
        localStorage.setItem("velyrion_user", JSON.stringify(me));
      } catch {
        // Token might be expired, try refresh
        const refreshed = await tryRefresh();
        if (!refreshed) clearTokens();
      }

      setIsLoading(false);
    };
    init();
  }, [tryRefresh]);

  // Auto-refresh token before expiry (every 12 min)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      tryRefresh();
    }, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, tryRefresh]);

  const login = async (email: string, password: string) => {
    const data = await authFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveTokens(data.access_token, data.refresh_token, data.user);
  };

  const signup = async (name: string, email: string, password: string) => {
    const data = await authFetch("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    saveTokens(data.access_token, data.refresh_token, data.user);
  };

  const googleLogin = async (credential: string) => {
    const data = await authFetch("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    saveTokens(data.access_token, data.refresh_token, data.user);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("velyrion_refresh_token");
    if (refreshToken) {
      try {
        await authFetch("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch { /* ignore logout errors */ }
    }
    clearTokens();
  };

  const refreshUser = async () => {
    try {
      const me = await authFetchWithToken("/api/auth/me");
      setUser(me);
      localStorage.setItem("velyrion_user", JSON.stringify(me));
    } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, signup, googleLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("velyrion_access_token");
}

/** RBAC permission helpers */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || "VIEWER";
  return {
    isAdmin: role === "ADMIN",
    isOperator: role === "OPERATOR",
    isViewer: role === "VIEWER",
    canKillAgents: role === "ADMIN",
    canManagePolicies: role === "ADMIN",
    canManageWebhooks: role === "ADMIN",
    canApprove: role === "ADMIN" || role === "OPERATOR",
    canRegisterAgents: role === "ADMIN" || role === "OPERATOR",
    canExportReports: role === "ADMIN" || role === "OPERATOR",
    role,
  };
}
