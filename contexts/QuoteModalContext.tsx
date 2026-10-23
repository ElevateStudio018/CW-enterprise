"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface QuoteModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  showConfirmation: () => void;
  confirmationVisible: boolean;
}

const QuoteModalContext = createContext<QuoteModalContextValue | null>(null);

/** How long the thank-you message stays. */
export const CONFIRMATION_MS = 4500;

// How long the quote window stays after the thank-you appears: the tick takes about 0.7 s to draw, and then it can be read.
const AUTO_CLOSE_MS = 1500;

export function QuoteModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const confirmationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpenRef = useRef(false);

  const open = useCallback(() => {
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    triggerRef.current = document.activeElement as HTMLElement;
    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    isOpenRef.current = false;
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const showConfirmation = useCallback(() => {
    setConfirmationVisible(true);
    if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
    confirmationTimeoutRef.current = setTimeout(() => setConfirmationVisible(false), CONFIRMATION_MS);

    // A quote window that is open when the thank-you appears closes by itself a moment later.
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    if (isOpenRef.current) autoCloseTimeoutRef.current = setTimeout(close, AUTO_CLOSE_MS);
  }, [close]);

  useEffect(() => {
    return () => {
      if (confirmationTimeoutRef.current) clearTimeout(confirmationTimeoutRef.current);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  return (
    <QuoteModalContext.Provider value={{ isOpen, open, close, showConfirmation, confirmationVisible }}>
      {children}
    </QuoteModalContext.Provider>
  );
}

export function useQuoteModal(): QuoteModalContextValue {
  const ctx = useContext(QuoteModalContext);
  if (!ctx) throw new Error("useQuoteModal must be used within QuoteModalProvider");
  return ctx;
}
