"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type Toast = { id: number; text: string; tone: "ok" | "warn" | "danger" };

const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100%-32px))] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              "pointer-events-auto rounded-lg border border-line bg-surface px-3 py-2 text-[13px]",
              toast.tone === "danger" && "text-danger",
              toast.tone === "warn" && "text-warn",
              toast.tone === "ok" && "text-text",
            )}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
