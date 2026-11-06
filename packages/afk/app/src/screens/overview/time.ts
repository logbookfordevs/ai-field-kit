export function savedAgo(at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function repositoryLabel(remote: string): string {
  return remote.trim().replace(/^https?:\/\/github\.com\//, "").replace(/^git@github\.com:/, "").replace(/\.git$/, "").replace(/\/+$/, "");
}
