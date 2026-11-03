"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X, type LucideIcon } from "../icons";
import { cx } from "../lib/cx";

export type ToastTone = "success" | "error" | "info" | "warning";

export type ToastInput = {
  message: ReactNode;
  title?: ReactNode;
  tone?: ToastTone;
  duration?: number;
};

type ToastRecord = ToastInput & { id: number; tone: ToastTone };

interface ToastContextValue {
  push: (input: ToastInput | string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcons: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: TriangleAlert,
};

const defaultDuration: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 0,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((input: ToastInput | string) => {
    const record: ToastInput = typeof input === "string" ? { message: input } : input;
    counter.current += 1;
    setItems((current) => [
      ...current.slice(-3),
      { ...record, id: counter.current, tone: record.tone ?? "success" },
    ]);
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="mp-toast-region" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <ToastCard key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}) {
  const Icon = toneIcons[toast.tone];
  useEffect(() => {
    const duration = toast.duration ?? defaultDuration[toast.tone];
    if (duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, toast.tone, onDismiss]);

  return (
    <div
      className={cx("mp-toast", `mp-toast--${toast.tone}`)}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <Icon className="mp-toast__icon" aria-hidden="true" />
      <div className="mp-toast__body">
        {toast.title ? <p className="mp-toast__title">{toast.title}</p> : null}
        <div className="mp-toast__message">{toast.message}</div>
      </div>
      <button
        type="button"
        className="mp-toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
