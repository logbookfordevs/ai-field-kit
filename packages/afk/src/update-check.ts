import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const packageName = "@logbookfordevs/afk";
export const updateCommand = `npm install -g ${packageName}@latest`;

export type UpdateNotice = {
  currentVersion: string;
  latestVersion: string;
  command: string;
};

export type LatestVersionFetcher = (name: string, signal: AbortSignal) => Promise<string | null>;

export function packageVersion(): string {
  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  return typeof packageJson.version === "string" ? packageJson.version : "unknown";
}

export async function resolveUpdateNotice(input: {
  currentVersion: string;
  fetchLatestVersion?: LatestVersionFetcher;
  timeoutMs?: number;
}): Promise<UpdateNotice | null> {
  const { currentVersion, fetchLatestVersion = fetchLatestNpmVersion, timeoutMs = 800 } = input;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const latestVersion = await fetchLatestVersion(packageName, controller.signal);
    if (!latestVersion || !isVersionGreater(latestVersion, currentVersion)) {
      return null;
    }

    return {
      currentVersion,
      latestVersion,
      command: updateCommand,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchLatestNpmVersion(name: string, signal: AbortSignal): Promise<string | null> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: {
      accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const metadata: unknown = await response.json();
  if (!isPackageMetadata(metadata)) {
    return null;
  }

  return metadata["dist-tags"].latest;
}

export function isVersionGreater(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) {
    return false;
  }

  for (const index of [0, 1, 2] as const) {
    if (candidateParts[index] > currentParts[index]) {
      return true;
    }
    if (candidateParts[index] < currentParts[index]) {
      return false;
    }
  }

  return false;
}

function parseVersion(value: string): readonly [number, number, number] | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/);
  if (!match) {
    return null;
  }

  const [, majorRaw, minorRaw, patchRaw] = match;
  if (!majorRaw || !minorRaw || !patchRaw) {
    return null;
  }

  return [Number(majorRaw), Number(minorRaw), Number(patchRaw)];
}

function isPackageMetadata(value: unknown): value is { "dist-tags": { latest: string } } {
  if (!value || typeof value !== "object" || !("dist-tags" in value)) {
    return false;
  }

  const distTags = (value as { "dist-tags"?: unknown })["dist-tags"];
  return Boolean(
    distTags
      && typeof distTags === "object"
      && "latest" in distTags
      && typeof (distTags as { latest?: unknown }).latest === "string",
  );
}
