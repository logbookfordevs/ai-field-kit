export const STATUS: Record<string, { tone: string; label: string }> = {
  current: { tone: "on", label: "Current" },
  outdated: { tone: "stale", label: "Out of date" },
  never: { tone: "", label: "Never synced" },
  conflict: { tone: "warn", label: "Conflict" },
  off: { tone: "off", label: "Not connected" },
};

const fallback = { tone: "warn", label: "Needs attention" };

export const statusLabel = (status: string): string => (STATUS[status] ?? fallback).label;

/** A destination's state in words; colour only adds to the text. */
export function Status({ status, text }: { status: string; text?: string }) {
  const known = STATUS[status] ?? fallback;
  return <span className={`status ${known.tone}`.trim()}>{text ?? known.label}</span>;
}
