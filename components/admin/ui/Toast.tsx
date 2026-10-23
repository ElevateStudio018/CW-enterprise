"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";
interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
  action?: ToastAction;
}

const ToastContext = createContext<((message: string, tone?: Tone, action?: ToastAction) => void) | null>(null);

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const toneClasses = {
  success: "text-emerald-700",
  error: "text-red-700",
  info: "text-admin",
};

/** Short messages in the corner after saving, sending or failing; read out to screen readers too. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), []);
  const show = useCallback(
    (message: string, tone: Tone = "success", action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-3), { id, tone, message, action }]);
      // A message with a button stays a little longer, so there is time to press it.
      setTimeout(() => dismiss(id), tone === "error" || action ? 8000 : 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[400] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6">
        {toasts.map((toast) => {
          const Icon = icons[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className="admin-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_12px_32px_-12px_rgba(30,30,28,0.35)] ring-1 ring-admin-line"
            >
              <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${toneClasses[toast.tone]}`} />
              <p className="flex-1 text-[14px] leading-snug text-admin-ink">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="-my-1 shrink-0 rounded-lg px-2 py-1 text-[14px] font-semibold text-admin hover:bg-admin/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
                >
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Stäng meddelandet"
                className="-m-1 rounded-lg p-1 text-admin-muted hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return useMemo(
    () => ({
      success: (message: string, action?: ToastAction) => show(message, "success", action),
      error: (message: string, action?: ToastAction) => show(message, "error", action),
      info: (message: string, action?: ToastAction) => show(message, "info", action),
    }),
    [show]
  );
}
