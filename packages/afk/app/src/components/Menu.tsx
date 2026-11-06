import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import "@/components/Menu.css";

const MenuContext = createContext<{ close: () => void } | null>(null);

export interface MenuProps {
  /** Accessible name of the trigger, e.g. "More for kami". */
  label: string;
  /** Visible trigger content; defaults to the ⋯ icon. */
  trigger?: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
}

/**
 * A popover of native buttons for rare actions. Tab moves between them,
 * Escape or an outside click closes it, and focus returns to the trigger.
 */
export function Menu({ label, trigger, triggerClassName, children }: MenuProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const place = useCallback(() => {
    const anchor = triggerRef.current?.getBoundingClientRect();
    const menu = popover.current;
    if (!anchor || !menu) return;
    const width = menu.offsetWidth, height = menu.offsetHeight;
    const left = Math.max(12, Math.min(anchor.right - width, innerWidth - width - 12));
    const below = anchor.bottom + 6;
    const top = below + height > innerHeight - 12 ? Math.max(12, anchor.top - height - 6) : below;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, []);

  useEffect(() => {
    const menu = popover.current;
    if (!menu) return;
    const onToggle = (event: Event) => {
      const opened = (event as ToggleEvent).newState === "open";
      setOpen(opened);
      if (opened) return;
      const focusWasInside = menu.contains(document.activeElement) || document.activeElement === document.body;
      if (focusWasInside) triggerRef.current?.focus();
    };
    menu.addEventListener("toggle", onToggle);
    return () => menu.removeEventListener("toggle", onToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    popover.current?.querySelector<HTMLButtonElement>("button")?.focus();
    addEventListener("resize", place);
    addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place, { capture: true });
    };
  }, [open, place]);

  const close = useCallback(() => {
    if (popover.current?.matches(":popover-open")) popover.current.hidePopover();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? "icon-btn"}
        aria-label={trigger ? undefined : label}
        aria-expanded={open}
        aria-controls={id}
        popoverTarget={id}
      >
        {trigger ?? <Icon name="dots" />}
      </button>
      <div ref={popover} id={id} className="menu" popover="auto">
        <MenuContext.Provider value={{ close }}>{children}</MenuContext.Provider>
      </div>
    </>
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  danger?: boolean;
  /** Makes the item unavailable but still focusable, with this reason read out and shown under it. */
  disabledReason?: string;
}

export function MenuItem({ onSelect, children, danger = false, disabledReason }: MenuItemProps) {
  const menu = useContext(MenuContext);
  const reasonId = useId();
  const unavailable = disabledReason !== undefined;
  const choose = () => {
    if (unavailable) return;
    menu?.close();
    onSelect();
  };
  return (
    <>
      <button
        type="button"
        className={danger ? "danger-text" : undefined}
        aria-disabled={unavailable || undefined}
        aria-describedby={unavailable ? reasonId : undefined}
        onClick={choose}
      >
        {children}
      </button>
      {unavailable ? <p className="why" id={reasonId}>{disabledReason}</p> : null}
    </>
  );
}

export function MenuSeparator() {
  return <hr />;
}

/** Plain text inside a menu, such as a version line. */
export function MenuNote({ children }: { children: ReactNode }) {
  return <p className="menu-note">{children}</p>;
}
