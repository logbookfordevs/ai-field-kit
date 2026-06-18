import { sectionTitle } from "./brand.js";
import { applyOperation, formatOperation, summarizeOperations } from "./fs-utils.js";
import { ensureLocalManifests, planRememberedDefaultsSourceUpdate } from "./manifest.js";
import type { CliOptions, PathOperation, Runtime } from "./types.js";

export async function runRefresh(runtime: Runtime, options: CliOptions): Promise<number> {
  const sourceOptions: CliOptions = {
    ...options,
    defaultsSource: options.defaultSourceUpdate || options.defaultsSource,
    defaultsSourceExplicit: Boolean(options.defaultSourceUpdate || options.defaultsSourceExplicit),
    refreshDefaults: true,
    rememberDefaultsSource: options.defaultSourceUpdate ? true : !options.defaultsSourceExplicit,
  };

  runtime.io.stdout(
    sourceOptions.manifestLocal
      ? "Refreshing project AFK manifests."
      : "Refreshing global AFK manifests.",
  );

  const operations = await refreshOperations(sourceOptions);
  if (operations.length === 0) {
    return 0;
  }

  if (sourceOptions.dryRun) {
    runtime.io.stdout(`\n${sectionTitle("Local Manifests")}`);
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nLocal manifests refreshed: ${summarizeOperations(operations)}.`);
  return 0;
}

async function refreshOperations(options: CliOptions): Promise<PathOperation[]> {
  const operations = await ensureLocalManifests(options);
  if (!options.defaultSourceUpdate) {
    return operations;
  }

  const defaultSourceOperations = planRememberedDefaultsSourceUpdate(options, options.defaultSourceUpdate);
  const defaultSourcePaths = new Set(defaultSourceOperations.filter((operation) => "path" in operation).map((operation) => operation.path));
  return [
    ...operations.filter((operation) => !("path" in operation) || !defaultSourcePaths.has(operation.path)),
    ...defaultSourceOperations,
  ];
}
