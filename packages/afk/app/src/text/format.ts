/** The source recorded for skills that came from a zip, .skill file or folder. */
export const UPLOADED_SOURCE = "Uploaded skill";

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function ago(at: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** A repository as people write it: owner/name on GitHub, host/path elsewhere, the path for a local one. */
export function shortSource(source: string): string {
  return source.trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/^[a-z+]+:\/\//i, "")
    .replace(/^git@([^:]+):/, "$1/")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

/** Uploads and local paths have no repository to follow, update or publish. */
export function isRepositorySource(source: string | undefined): source is string {
  return Boolean(source) && source !== UPLOADED_SOURCE && !/^(\/|~|\.|file:)/.test(source ?? "");
}
