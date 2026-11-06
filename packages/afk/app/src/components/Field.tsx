import { useId, type ReactElement, type ReactNode, cloneElement } from "react";

export interface FieldProps {
  label: string;
  /** Validation message; empty or absent when the field is fine. */
  error?: string;
  hint?: ReactNode;
  /** The input, select or textarea; it receives the id, `aria-invalid` and `aria-describedby`. */
  children: ReactElement<{ id?: string | undefined; "aria-invalid"?: boolean | undefined; "aria-describedby"?: string | undefined }>;
}

/** A labelled control with its error and hint announced with it. The error is not part of the label's name. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : "", hint ? hintId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? <span className="hint" id={hintId}>{hint}</span> : null}
      {error ? <span className="field-error" id={errorId}>{error}</span> : null}
    </div>
  );
}
