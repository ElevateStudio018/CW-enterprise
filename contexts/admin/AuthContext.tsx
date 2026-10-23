"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { callFunction, supabase } from "@/lib/admin/supabase";
import { isConnected } from "@/lib/admin/config";

export interface Profile {
  id: string;
  email: string;
  role: "admin" | "none";
  fullName: string;
}

interface AuthState {
  /** "loading" until the stored session has been checked. */
  status: "loading" | "signed-out" | "signed-in" | "not-admin";
  session: Session | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthState["status"]>("loading");

  const loadProfile = useCallback(async (current: Session | null) => {
    if (!current) {
      setProfile(null);
      setStatus("signed-out");
      return;
    }
    const { data } = await supabase().from("profiles").select("id, email, role, full_name").eq("id", current.user.id).maybeSingle();
    if (data?.role === "admin") {
      setProfile({ id: data.id, email: data.email, role: "admin", fullName: data.full_name ?? "" });
      setStatus("signed-in");
    } else {
      setProfile(null);
      setStatus("not-admin");
    }
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setStatus("signed-out");
      return;
    }
    const client = supabase();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadProfile(data.session);
    });
    const { data: subscription } = client.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Outside the callback: Supabase calls made inside it can wait on each other forever.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setTimeout(() => void loadProfile(next), 0);
    });
    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Through the admin-login function, which limits failed attempts.
    const { session: tokens } = await callFunction<{ session: { access_token: string; refresh_token: string } }>("admin-login", { email, password });
    const { error } = await supabase().auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, session, profile, signIn, signOut, refreshProfile: () => loadProfile(session) }),
    [status, session, profile, signIn, signOut, loadProfile]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
