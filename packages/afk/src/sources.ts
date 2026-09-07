import { applyOperation } from "./fs-utils.js";
import { planFavoriteSourcesUpdate, readSourcePreferences } from "./manifest.js";
import type { CliOptions, Runtime } from "./types.js";

export function runSourcesCommand(commandPath: string[], runtime: Runtime, options: CliOptions): number {
  const action = commandPath[1] ?? "list";
  const source = commandPath[2]?.trim() ?? "";
  const preferences = readSourcePreferences({ homeDir: options.homeDir, manifestLocal: false });

  if (action === "list") {
    if (commandPath.length > 2) {
      runtime.io.stderr(`Unexpected sources argument: ${commandPath[2]}`);
      return 1;
    }
    runtime.io.stdout("Favorite sources");
    if (preferences.defaultSource) {
      runtime.io.stdout(`- ${preferences.defaultSource} (default)`);
    }
    for (const favorite of preferences.favoriteSources) {
      if (favorite !== preferences.defaultSource) runtime.io.stdout(`- ${favorite}`);
    }
    if (!preferences.defaultSource && preferences.favoriteSources.length === 0) {
      runtime.io.stdout("No default or favorite sources saved.");
    }
    return 0;
  }

  if (action !== "add" && action !== "remove") {
    runtime.io.stderr(`Unknown sources command: ${action}`);
    return 1;
  }
  if (!source || commandPath.length > 3) {
    runtime.io.stderr(`Usage: afk sources ${action} <source>`);
    return 1;
  }
  if (source === "local" || source === "github") {
    runtime.io.stderr(`Cannot save contextual source alias as a favorite: ${source}`);
    return 1;
  }

  const favorites = action === "add"
    ? [...preferences.favoriteSources, source]
    : preferences.favoriteSources.filter((favorite) => favorite !== source);
  for (const operation of planFavoriteSourcesUpdate({ homeDir: options.homeDir, manifestLocal: false }, favorites)) {
    applyOperation(operation);
  }
  runtime.io.stdout(action === "add" ? `Favorite source added: ${source}` : `Favorite source removed: ${source}`);
  return 0;
}
