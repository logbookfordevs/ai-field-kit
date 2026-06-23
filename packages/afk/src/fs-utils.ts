import { constants, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync, copyFileSync, accessSync } from "node:fs";
import { dirname } from "node:path";
import type { PathOperation } from "./types.js";

export const managedMarker = ".ai-field-kit-managed";

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export function isFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

export function isDirectory(path: string): boolean {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function canExecute(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function ensureParent(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

export function backupTarget(path: string, timestamp: string): PathOperation | null {
  if (isFile(path) && !isSymlink(path)) {
    return {
      type: "backup",
      source: path,
      target: `${path}.bak.${timestamp}`,
    };
  }

  return null;
}

export function applyOperation(operation: PathOperation): void {
  switch (operation.type) {
    case "mkdir":
      mkdirSync(operation.path, { recursive: true });
      return;
    case "remove":
      rmSync(operation.path, { recursive: true, force: true });
      return;
    case "symlink":
      ensureParent(operation.target);
      symlinkSync(operation.source, operation.target);
      return;
    case "copy":
      ensureParent(operation.target);
      copyFileSync(operation.source, operation.target);
      return;
    case "write":
      ensureParent(operation.path);
      writeFileSync(operation.path, operation.content);
      return;
    case "backup":
      ensureParent(operation.target);
      renameSync(operation.source, operation.target);
      return;
    case "move":
      ensureParent(operation.target);
      renameSync(operation.source, operation.target);
      return;
    case "skip":
      return;
  }
}

export function formatOperation(operation: PathOperation): string {
  switch (operation.type) {
    case "mkdir":
      return `mkdir ${operation.path}`;
    case "remove":
      return `remove ${operation.path}`;
    case "symlink":
      return `link ${operation.target} -> ${operation.source}`;
    case "copy":
      return `copy ${operation.source} -> ${operation.target}`;
    case "write":
      return `write ${operation.path}`;
    case "backup":
      return `backup ${operation.source} -> ${operation.target}`;
    case "move":
      return `move ${operation.source} -> ${operation.target}`;
    case "skip":
      return `skip ${operation.path} (${operation.reason})`;
  }
}

export function summarizeOperations(operations: PathOperation[]): string {
  const counts = new Map<PathOperation["type"], number>();
  for (const operation of operations) {
    counts.set(operation.type, (counts.get(operation.type) ?? 0) + 1);
  }

  const parts = [
    formatCount("created directories", counts.get("mkdir") ?? 0),
    formatCount("wrote files", counts.get("write") ?? 0),
    formatCount("linked files", counts.get("symlink") ?? 0),
    formatCount("copied files", counts.get("copy") ?? 0),
    formatCount("backed up files", counts.get("backup") ?? 0),
    formatCount("moved folders", counts.get("move") ?? 0),
    formatCount("removed files", counts.get("remove") ?? 0),
    formatCount("skipped unchanged or unmanaged files", counts.get("skip") ?? 0),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "no file changes";
}

function formatCount(label: string, count: number): string {
  return count > 0 ? `${count} ${label}` : "";
}
