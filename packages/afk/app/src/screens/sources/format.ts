export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The repository as people write it: owner/name for GitHub links, the original text otherwise. */
export function shortSource(source: string): string {
  return source.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/, "").replace(/\/+$/, "");
}

export function defaultBookmarkName(source: string): string {
  const withoutRef = source.replace(/#.*$/, "").replace(/\.git$/, "").replace(/\/+$/, "");
  return withoutRef.split(/[/:]/).filter(Boolean).pop() ?? "";
}

const hasControlCharacter = (value: string): boolean => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

/** Same rule the operations enforce: something to read, no control characters, not a command-line flag. */
export function isValidSource(value: string): boolean {
  const source = value.trim();
  return source.length > 0 && !source.startsWith("-") && !hasControlCharacter(source);
}

/** Core sources that came from an upload or a local path cannot be followed or updated from a repository. */
export function isRepositoryReference(source: string): boolean {
  return source !== "Uploaded skill" && !/^(\/|~|\.|file:)/.test(source);
}
