import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isManifestValue, localManifestDir, manifestNames, projectManifestDir } from "./manifest.js";
import type { CliOptions, Runtime } from "./types.js";

export function runCatalogDoctor(runtime: Runtime, options: CliOptions): number {
  const catalogDir = options.manifestLocal ? projectManifestDir(options.cwd) : localManifestDir(options.homeDir);
  let invalidCount = 0;

  runtime.io.stdout(`AFK doctor\nCatalog: ${catalogDir}`);

  for (const name of manifestNames) {
    const path = join(catalogDir, name);
    if (!existsSync(path)) {
      runtime.io.stderr(`Invalid ${name}: file is missing.`);
      invalidCount += 1;
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      runtime.io.stderr(`Invalid ${name}: ${error instanceof Error ? error.message : String(error)}`);
      invalidCount += 1;
      continue;
    }

    if (!isManifestValue(name, value)) {
      runtime.io.stderr(`Invalid ${name}: attributes or structure do not match the AFK catalog contract.`);
      invalidCount += 1;
      continue;
    }

    runtime.io.stdout(`Valid ${name}`);
  }

  if (invalidCount > 0) {
    runtime.io.stderr(`AFK doctor found ${invalidCount} invalid catalog file${invalidCount === 1 ? "" : "s"}.`);
    return 1;
  }

  runtime.io.stdout(`AFK doctor found ${manifestNames.length} valid catalog files.`);
  return 0;
}
