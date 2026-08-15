import { sectionTitle } from "./brand.js";
import { applyOperation, formatOperation, summarizeOperations } from "./fs-utils.js";
import { ensureLocalManifests, planRememberedDefaultsSourceUpdate } from "./manifest.js";
import { confirm } from "./prompt.js";
import type { CliOptions, PathOperation, Runtime } from "./types.js";

type ConfirmRefreshOverride = (message: string) => Promise<boolean>;

export async function runRefresh(
  runtime: Runtime,
  options: CliOptions,
  confirmRefreshOverride: ConfirmRefreshOverride = confirm,
): Promise<number> {
  const sourceOptions: CliOptions = {
    ...options,
    defaultsSource: options.defaultSourceUpdate || options.defaultsSource,
    defaultsSourceExplicit: Boolean(options.defaultSourceUpdate || options.defaultsSourceExplicit),
    refreshDefaults: true,
    rememberDefaultsSource: options.defaultSourceUpdate ? true : !options.defaultsSourceExplicit,
  };

  runtime.io.stdout(
    sourceOptions.manifestLocal
      ? "Refreshing project AFK catalog."
      : "Refreshing global AFK catalog.",
  );

  if (sourceOptions.overrideRefresh && !sourceOptions.dryRun) {
    const firstConfirmation = await confirmRefreshOverride(
      "Override the targeted local AFK catalog files? Local-only entries will be removed.",
    );
    const secondConfirmation = firstConfirmation && await confirmRefreshOverride(
      "Confirm again: replace the targeted catalog files with the selected source?",
    );
    if (!firstConfirmation || !secondConfirmation) {
      runtime.io.stdout("AFK catalog override cancelled. Nothing was changed.");
      return 0;
    }
  }

  const operations = await refreshOperations(sourceOptions);
  if (operations.length === 0) {
    return 0;
  }

  if (sourceOptions.dryRun) {
    runtime.io.stdout(`\n${sectionTitle("Local Catalog")}`);
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nLocal catalog refreshed: ${summarizeOperations(operations)}.`);
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
