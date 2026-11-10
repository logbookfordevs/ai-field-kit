import { useId } from "react";

/** A globe with an agent in orbit: the one folder every agent reads. */
export function SharedFolderIcon() {
  const front = useId();
  const orbit = { cx: 14, cy: 14, rx: 11.2, ry: 3.9, fill: "none", stroke: "currentColor", strokeWidth: 1.3 };

  return (
    <svg className="agent-icon agent-icon-shared" viewBox="0 0 28 28" width={28} height={28} aria-hidden="true">
      <defs><clipPath id={front}><rect x="0" y="14" width="28" height="14" /></clipPath></defs>
      <rect width="28" height="28" rx="6" className="tile" />
      <g transform="rotate(-22 14 14)"><ellipse {...orbit} /></g>
      <circle cx="14" cy="14" r="7" className="tile" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="14" cy="14" rx="3" ry="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 14h14" stroke="currentColor" strokeWidth="1.2" />
      <g transform="rotate(-22 14 14)">
        <ellipse {...orbit} clipPath={`url(#${front})`} />
        <circle cx="4.4" cy="16" r="2.1" fill="currentColor" />
      </g>
    </svg>
  );
}
