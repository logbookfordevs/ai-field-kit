const paths = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  dots: <><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>,
  chev: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5" /><circle cx="12" cy="16.3" r=".6" fill="currentColor" /></>,
  cloudoff: <><path d="M7 18h10.5a3.5 3.5 0 0 0 .6-6.95A5.5 5.5 0 0 0 7.6 9.1 4.5 4.5 0 0 0 7 18Z" /><path d="m4 4 16 16" /></>,
  cloud: <path d="M7 18h10.5a3.5 3.5 0 0 0 .6-6.95A5.5 5.5 0 0 0 7.6 9.1 4.5 4.5 0 0 0 7 18Z" />,
  edit: <><path d="M14.5 5.5 18.5 9.5" /><path d="M5 19l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9.5 18Z" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />,
  back: <path d="M19 12H5m5-5-5 5 5 5" />,
};

export type IconName = keyof typeof paths;

/** Decorative stroke icon; give the surrounding control its accessible name. */
export function Icon({ name, size = "md", className = "" }: { name: IconName; size?: "sm" | "md"; className?: string }) {
  const classes = ["i", size === "sm" ? "sm" : "", className].filter(Boolean).join(" ");
  return <svg className={classes} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
