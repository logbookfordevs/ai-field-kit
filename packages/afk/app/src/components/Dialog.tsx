import { useId, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { Icon } from "@/components/Icon";
import "@/components/Dialog.css";

export interface DialogProps {
  open: boolean;
  /** Called for Escape, a backdrop click and the Close button. Footer actions close by changing `open`. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** small: confirmations; sheet: a side panel on desktop, a dialog on phones. */
  variant?: "default" | "small" | "wide" | "sheet";
  /** false keeps the dialog open (unsaved text, running install) and calls `onCloseBlocked` instead. */
  canClose?: boolean;
  onCloseBlocked?: () => void;
  /** Receives focus on open; defaults to the first field or button in the body. */
  initialFocus?: RefObject<HTMLElement | null>;
}

const focusable = "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])";

/** A radio group is entered at its checked option, so an unchecked radio is never where focus starts. */
function firstFocusable(root: HTMLElement | null): HTMLElement | undefined {
  return [...(root?.querySelectorAll<HTMLElement>(focusable) ?? [])].find(element => !(element instanceof HTMLInputElement && element.type === "radio" && !element.checked));
}

/** Native modal dialog: the page behind is inert, focus starts inside and returns to the opener on close. */
export function Dialog(props: DialogProps) {
  return props.open ? <OpenDialog {...props} /> : null;
}

function OpenDialog({ onClose, title, description, children, footer, variant = "default", canClose = true, onCloseBlocked, initialFocus }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    const first = initialFocus?.current ?? firstFocusable(body.current) ?? firstFocusable(dialog);
    first?.focus();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [initialFocus]);

  const requestClose = () => {
    if (canClose) onClose();
    else onCloseBlocked?.();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  };
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    requestClose();
  };
  const onBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) requestClose();
  };

  return (
    <dialog
      ref={ref}
      className={`dlg ${variant}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={onKeyDown}
      onCancel={onCancel}
      onClick={onBackdrop}
    >
      <header className="dlg-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p className="sub" id={descriptionId}>{description}</p> : null}
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={requestClose}><Icon name="close" /></button>
      </header>
      <div className="dlg-body" ref={body}>{children}</div>
      {footer ? <footer className="dlg-foot">{footer}</footer> : null}
    </dialog>
  );
}
