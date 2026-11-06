export function ago(at: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function repositoryName(remote: string | undefined): string {
  return (remote ?? "").replace(/^https?:\/\//, "").replace(/^git@[^:]+:/, "").replace(/\.git$/, "").replace(/\/+$/, "");
}

export function count(total: number, word: string): string {
  return `${total} ${word}${total === 1 ? "" : "s"}`;
}

export function changesWaiting(total: number): string {
  return total === 1 ? "1 change waiting" : `${total} changes waiting`;
}

export function megabytes(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
