"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getToken, setToken, verifyToken } from "@/lib/admin/github";

export interface Profile {
  id: string;
  email: string;
  role: "admin" | "none";
  fullName: string;
}

interface AuthState {
  /** "loading" until the stored key has been checked. */
  status: "loading" | "signed-out" | "signed-in" | "not-admin";
  profile: Profile | null;
  /** Signs in with the site's key (a GitHub token allowed to change this site's repository). */
  signIn: (key: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  const check = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setProfile(null);
      setStatus("signed-out");
      return;
    }
    try {
      const name = await verifyToken(token);
      setProfile({ id: "github", email: "", role: "admin", fullName: name });
      setStatus("signed-in");
    } catch {
      setToken(null);
      setProfile(null);
      setStatus("signed-out");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const signIn = useCallback(async (key: string) => {
    const token = key.trim();
    const name = await verifyToken(token);
    setToken(token);
    setProfile({ id: "github", email: "", role: "admin", fullName: name });
    setStatus("signed-in");
  }, []);

  const signOut = useCallback(async () => {
    setToken(null);
    setProfile(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo<AuthState>(() => ({ status, profile, signIn, signOut, refreshProfile: check }), [status, profile, signIn, signOut, check]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
