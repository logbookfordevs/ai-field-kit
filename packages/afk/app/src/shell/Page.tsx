import type { ReactNode } from "react";

export interface PageProps {
  /** The page's h1; the shell focuses it when the section opens. */
  title: string;
  description?: ReactNode;
  /** Page-level actions, at most one primary. */
  actions?: ReactNode;
  children?: ReactNode;
}

export function Page({ title, description, actions, children }: PageProps) {
  return (
    <>
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>{title}</h1>
          {description ? <p className="sub">{description}</p> : null}
        </div>
        {actions ? <div className="head-actions">{actions}</div> : null}
      </header>
      {children}
    </>
  );
}
