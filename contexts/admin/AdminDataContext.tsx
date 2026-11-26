"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DraftStore, type DraftState } from "@/lib/admin/draftStore";
import { applyPrime } from "@/lib/admin/prime";

export interface PendingReset {
  id: string;
  created_at: string;
  expires_at: string;
  reason: string;
}

interface AdminData {
  store: DraftStore;
  credits: number | null;
  refreshCredits: () => Promise<void>;
  newQuotes: number;
  refreshQuotes: () => Promise<void>;
  /** Employees' suggestions for the website not yet seen (Hemsidan → Förslag). */
  newSuggestions: number;
  refreshSuggestions: () => Promise<void>;
  /** A "Rensa alla ändringar" request waiting for Elevate Studio, if any. */
  pendingReset: PendingReset | null;
  refreshReset: () => Promise<void>;
}

const AdminDataContext = createContext<AdminData | null>(null);

/** One draft store, credit balance and inbox counters for the whole panel, kept while moving between its pages. */
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<DraftStore | null>(null);
  storeRef.current ??= new DraftStore();
  const store = storeRef.current;
  const [credits, setCredits] = useState<number | null>(null);
  const [newQuotes, setNewQuotes] = useState(0);
  const [newSuggestions, setNewSuggestions] = useState(0);
  const [pendingReset, setPendingReset] = useState<PendingReset | null>(null);

  // The site is published from GitHub without a server: no credits, inbox, suggestions or reset requests to count.
  // Quote requests arrive by e-mail (FormSubmit). The counters stay for the panel's layout and read as nothing.
  const refreshReset = useCallback(async () => setPendingReset(null), []);
  const refreshCredits = useCallback(async () => setCredits(null), []);
  const refreshQuotes = useCallback(async () => setNewQuotes(0), []);
  const refreshSuggestions = useCallback(async () => setNewSuggestions(0), []);

  useEffect(() => {
    void store.start();
  }, [store]);

  // The prime colour follows the saved setting.
  const adminPrime = useSyncExternalStore(store.subscribe, () => store.getState().adminColors.primary, () => undefined);
  useEffect(() => {
    // Until it has loaded, the colour remembered in this browser (applied before the first paint) stays.
    if (adminPrime) applyPrime(adminPrime);
  }, [adminPrime]);

  const value = useMemo(
    () => ({ store, credits, refreshCredits, newQuotes, refreshQuotes, newSuggestions, refreshSuggestions, pendingReset, refreshReset }),
    [store, credits, refreshCredits, newQuotes, refreshQuotes, newSuggestions, refreshSuggestions, pendingReset, refreshReset]
  );
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData(): AdminData {
  const value = useContext(AdminDataContext);
  if (!value) throw new Error("useAdminData must be used inside AdminDataProvider");
  return value;
}

/** The draft store's state; re-renders when it changes. */
export function useDraft(): DraftState & { store: DraftStore } {
  const { store } = useAdminData();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { ...state, store };
}
