import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { apiClient } from "../api/client";
import type { User } from "../types";
import { AuthContext, type AuthContextType } from "./auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Token is no longer stored in localStorage (httpOnly cookie flow). Keep token state null.
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiClient.getCurrentUser();
      setUser(data);
    } catch (e) {
      console.error("Failed to refresh user:", e);
      // Ensure we set user to null on failure so the app knows there is no logged-in user
      // and avoids repeatedly trying to refresh.
      setUser(null);
    }
  }, []);

  // On mount, try to refresh user (backend will check cookie)
  // Skip attempting refresh when we are on auth-related pages (login, oauth callback)
  // to avoid causing redirect/reload loops while the auth flow is in progress.
  useEffect(() => {
    const pathname =
      typeof window !== "undefined" && window.location
        ? window.location.pathname
        : "";
    const isAuthPage = pathname === "/login" || pathname.startsWith("/auth");
    if (isAuthPage) {
      // Explicitly mark as not-authenticated while on auth pages so other code
      // doesn't repeatedly try to refresh the user. Schedule the update asynchronously
      // to avoid calling setState synchronously inside an effect (which can trigger cascading renders).
      Promise.resolve().then(() => setUser(null));
      return;
    }

    (async () => {
      await refreshUser();
    })();
  }, [refreshUser]);

  // login no longer accepts token; backend sets cookie during OAuth flow. Provide a no-op login to satisfy callers.
  const login = useCallback(() => {
    // no-op: token is set via httpOnly cookie by backend
    (async () => {
      try {
        await refreshUser();
      } catch {
        // ignore
      }
    })();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token,
      isLoading,
      refreshUser,
    }),
    [user, token, login, logout, isLoading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
