import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@/components/Toast.css";

export interface ToastOptions {
  action?: { label: string; onAction: () => void };
  /** Shows a spinner and stays until replaced or dismissed. */
  busy?: boolean;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  /** A failure stays, with a Dismiss button, until the person dismisses or replaces it. */
  fail: (message: string) => void;
  dismiss: () => void;
}

interface Current extends ToastOptions {
  message: string;
  id: number;
  failure?: boolean;
  /** The control that caused the message; focus goes back to it when the toast's own button closes it. */
  origin: HTMLElement | null;
}

const ToastContext = createContext<ToastApi | null>(null);

function focusedControl(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const [held, setHeld] = useState({ focus: false, pointer: false });
  const next = useRef(0);
  const dismiss = useCallback(() => setCurrent(null), []);
  const replace = useCallback((toast: Omit<Current, "id" | "origin">) => {
    setHeld(state => ({ ...state, focus: false }));
    setCurrent({ ...toast, id: next.current++, origin: focusedControl() });
  }, []);
  const show = useCallback((message: string, options: ToastOptions = {}) => replace({ ...options, message }), [replace]);
  const fail = useCallback((message: string) => replace({ message, failure: true }), [replace]);

  const paused = held.focus || held.pointer;
  useEffect(() => {
    if (!current || current.busy || current.failure || paused) return;
    const timer = setTimeout(dismiss, current.action ? 7_000 : 4_500);
    return () => clearTimeout(timer);
  }, [current, paused, dismiss]);

  const api = useMemo(() => ({ show, fail, dismiss }), [show, fail, dismiss]);

  const close = (action?: () => void) => {
    action?.();
    const origin = current?.origin;
    if (origin?.isConnected) origin.focus();
    setHeld({ focus: false, pointer: false });
    dismiss();
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className={current ? "toast show" : "toast"}
        role="status"
        aria-live="polite"
        onFocus={() => setHeld(state => ({ ...state, focus: true }))}
        onBlur={() => setHeld(state => ({ ...state, focus: false }))}
        onMouseEnter={() => setHeld(state => ({ ...state, pointer: true }))}
        onMouseLeave={() => setHeld(state => ({ ...state, pointer: false }))}
      >
        {current ? (
          <>
            {current.busy ? <span className="spin" aria-hidden="true" /> : null}
            <span>{current.message}</span>
            {current.action ? <button type="button" onClick={() => close(current.action?.onAction)}>{current.action.label}</button> : null}
            {current.failure ? <button type="button" onClick={() => close()}>Dismiss</button> : null}
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
