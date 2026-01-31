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
  const [isLoading, setIsLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    console.debug("[Auth] refreshUser: starting");
    setIsLoading(true);
    try {
      const data = await apiClient.getCurrentUser();

      // Handle empty responses explicitly so we don't log misleading messages like
      // "[Auth] refreshUser: got user undefined".
      if (!data) {
        console.debug("[Auth] refreshUser: no user returned from API");
        setUser(null);
        return;
      }

      console.debug("[Auth] refreshUser: got user", data);
      setUser(data);
    } catch (e) {
      console.error("[Auth] refreshUser: failed", e);
      // Ensure we set user to null on failure so the app knows there is no logged-in user
      // and avoids repeatedly trying to refresh.
      setUser(null);
    } finally {
      setIsLoading(false);
      console.debug("[Auth] refreshUser: finished");
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
    const isAuthPage = pathname.startsWith("/auth");
    // If we're on /login, still attempt to refresh user so reload can detect cookie.
    if (isAuthPage) {
      // Do nothing: auth callbacks handle their own flow (AuthCallback calls getCurrentUser()).
      return;
    }

    (async () => {
      await refreshUser();
    })();
  }, [refreshUser]);

  // login no longer accepts token; backend sets cookie during OAuth flow.
  // Previously this was a no-op that swallowed errors. Perform an explicit call to the backend
  // so callers (e.g. AuthCallback) receive failures and can react (for example, navigate back to /login).
  const login = useCallback(async () => {
    setIsLoading(true);
    try {
      console.debug("[Auth] login: calling getCurrentUser()");
      const data = await apiClient.getCurrentUser();
      console.debug("[Auth] login: got user", data);
      if (!data) {
        setUser(null);
        throw new Error("Login failed: no user returned from server");
      }
      setUser(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      isAuthenticated: !!user,
      isLoading,
      refreshUser,
    }),
    [user, token, login, logout, isLoading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
