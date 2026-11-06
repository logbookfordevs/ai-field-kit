import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@/components/Toast.css";

export interface ToastOptions {
  action?: { label: string; onAction: () => void };
  /** Shows a spinner and stays until replaced or dismissed. */
  busy?: boolean;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  dismiss: () => void;
}

interface Current extends ToastOptions { message: string; id: number }

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const next = useRef(0);
  const dismiss = useCallback(() => setCurrent(null), []);
  const show = useCallback((message: string, options: ToastOptions = {}) => setCurrent({ ...options, message, id: next.current++ }), []);

  useEffect(() => {
    if (!current || current.busy) return;
    const timer = setTimeout(dismiss, current.action ? 7_000 : 4_500);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const runAction = () => {
    current?.action?.onAction();
    dismiss();
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={current ? "toast show" : "toast"} role="status" aria-live="polite">
        {current ? (
          <>
            {current.busy ? <span className="spin" aria-hidden="true" /> : null}
            <span>{current.message}</span>
            {current.action ? <button type="button" onClick={runAction}>{current.action.label}</button> : null}
          </>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs a ToastProvider.");
  return api;
}
