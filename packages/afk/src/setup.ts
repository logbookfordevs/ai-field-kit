import { syncRules } from "./rules.js";
import { syncHooks } from "./hooks.js";
import { snapshotDisabledStartupSkills, syncSkillInvocationPolicy, syncSkillStartupStorage } from "./skills.js";
import { syncSkillCatalogFromManifest } from "./skills/catalog.js";
import { detectSetupTargets } from "./agent-detection.js";
import { buildMcpCommands, buildSkillCommands, buildPluginCommands, runDelegateCommands } from "./delegates.js";
import { renderBanner, renderSetupOutro, sectionTitle, muted } from "./brand.js";
import { selectDefaultsSource, selectHooksInstall, selectMcpsInstall, selectRulesSync, selectSetup, selectSkillsInstall, selectPluginsInstall } from "./interactive.js";
import { applyOperation, formatOperation, summarizeOperations } from "./fs-utils.js";
import { builtInDefaultsSource, ensureLocalManifests, loadSourceManifestContents, readRememberedDefaultsSource } from "./manifest.js";
import { defaultCheckedDetail } from "./prompt-ui.js";
import { packageVersion, resolveUpdateNotice } from "./update-check.js";
import type { SetupSelection } from "./interactive.js";
import { basename } from "node:path";
import type { Area, CliOptions, ManifestFilename, PathOperation, Runtime } from "./types.js";

export async function runSetup(runtime: Runtime, options: CliOptions): Promise<number> {
  const updateNotice = options.yes
    ? null
    : await resolveUpdateNotice({ currentVersion: packageVersion() });

  runtime.io.stdout(renderBanner({
    showRefreshHint: !options.refreshDefaults,
    updateNotice,
  }));

  runtime.io.stdout("Choose the parts of your AI field setup you want AFK to prepare.");
  runtime.io.stdout(muted(defaultCheckedDetail));

  const prepared = await prepareSetupManifests(runtime, options);
  if (prepared.code !== 0 || prepared.options.initOnly) {
    return prepared.code;
  }

  const selection = await selectSetup(prepared.options);
  const selectedOptions: CliOptions = {
    ...prepared.options,
    agents: selection.agents,
    setupScope: selection.setupScope,
    scopeExplicit: true,
    setupManifestsPrepared: true,
    selectedSkillIds: selection.skillIds,
    selectedSkillAgentIds: selection.skillAgents,
    selectedMcpIds: selection.mcpIds,
    selectedPluginIds: selection.pluginIds,
    selectedHookIds: selection.hookIds,
  };

  if (selection.areas.length === 0) {
    runtime.io.stdout("\nNothing selected. No changes planned.");
    runtime.io.stdout(renderSetupOutro({
      dryRun: options.dryRun,
      failed: false,
      scopeLabel: scopeLabel(selection.setupScope, options.cwd),
      areas: ["none"],
    }));
    return 0;
  }

  runtime.io.stdout("\nSetup path");
  runtime.io.stdout(`- Scope: ${scopeLabel(selection.setupScope, options.cwd)}`);
  runtime.io.stdout(`- Areas: ${selection.areas.join(", ")}`);
  if (selection.agents.length > 0) {
    runtime.io.stdout(`- ${targetSummaryLabel(selection.agentSource, agentSummaryLabel(selection.areas))}: ${selection.agents.join(", ")}`);
  }
  if (selection.skillAgents.length > 0) {
    runtime.io.stdout(`- ${targetSummaryLabel(selection.skillAgentSource, "Additional skill agents")}: ${selection.skillAgents.join(", ")}`);
  }
  if (selection.hookAgents.length > 0 && !sameTargets(selection.agents, selection.hookAgents)) {
    runtime.io.stdout(`- ${targetSummaryLabel(selection.hookAgentSource, "Hook targets")}: ${selection.hookAgents.join(", ")}`);
  }

  const failures: Array<{ area: Area; code: number }> = [];

  for (const area of selection.areas) {
    runtime.io.stdout(`\n${sectionTitle(areaLabel(area))}`);
    const areaOptions = areaOptionsForSetupArea(area, options, selectedOptions, selection);
    const code = await runArea(area, runtime, areaOptions);
    if (code !== 0) {
      failures.push({ area, code });
      runtime.io.stderr(`${areaLabel(area)} failed with exit code ${code}. Continuing with remaining setup areas.`);
    }
  }

  if (failures.length > 0) {
    runtime.io.stdout("\nSetup completed with failures:");
    for (const failure of failures) {
      runtime.io.stdout(`- ${areaLabel(failure.area)} exited with code ${failure.code}`);
    }
    runtime.io.stdout(renderSetupOutro({
      dryRun: options.dryRun,
      failed: true,
      scopeLabel: scopeLabel(selection.setupScope, options.cwd),
      areas: selection.areas.map(areaLabel),
    }));
    return failures[0]?.code ?? 1;
  }

  runtime.io.stdout(renderSetupOutro({
    dryRun: options.dryRun,
    failed: false,
    scopeLabel: scopeLabel(selection.setupScope, options.cwd),
    areas: selection.areas.map(areaLabel),
  }));
  return 0;
}

function areaOptionsForSetupArea(
  area: Area,
  originalOptions: CliOptions,
  selectedOptions: CliOptions,
  selection: SetupSelection,
): CliOptions {
  if (area === "hooks") {
    return { ...selectedOptions, agents: selection.hookAgents };
  }

  if (area === "plugins") {
    return { ...selectedOptions, agents: originalOptions.agents };
  }

  return selectedOptions;
}

function agentSummaryLabel(areas: Area[]): string {
  const hasRules = areas.includes("rules");
  const hasMcps = areas.includes("mcps");

  if (hasRules && hasMcps) {
    return "Rules/MCP targets";
  }

  if (hasRules) {
    return "Rules targets";
  }

  if (hasMcps) {
    return "MCP targets";
  }

  return "Agents";
}

function targetSummaryLabel(source: SetupSelection["agentSource"], fallback: string): string {
  switch (source) {
    case "detected":
      return `Detected ${fallback.toLowerCase()}`;
    case "manual":
      return `Manual ${fallback.toLowerCase()}`;
    case "explicit":
      return `Explicit ${fallback.toLowerCase()}`;
    case "none":
    case undefined:
      return fallback;
  }
}

function sameTargets(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => right[index] === value);
}

export async function runArea(area: Area, runtime: Runtime, options: CliOptions): Promise<number> {
  const prepared = options.setupManifestsPrepared ? { code: 0, options } : await prepareSetupManifests(runtime, options);
  if (prepared.code !== 0 || prepared.options.initOnly) {
    return prepared.code;
  }

  switch (area) {
    case "rules": {
      const selectedOptions = await resolveRulesOptions(prepared.options);
      return syncRules(runtime, selectedOptions);
    }
    case "skills": {
      const selectedOptions = await resolveSkillOptions(prepared.options);
      if (!selectedOptions.yes && selectedOptions.selectedSkillIds.length === 0) {
        runtime.io.stdout("\nNo skills selected. No changes planned.");
        return 0;
      }

      const disabledBeforeInstall = snapshotDisabledStartupSkills(selectedOptions);
      const code = await runDelegateCommands(runtime, buildSkillCommands(selectedOptions), selectedOptions);
      if (code === 0) {
        syncSkillInvocationPolicy(runtime, selectedOptions);
        syncSkillStartupStorage(runtime, selectedOptions, disabledBeforeInstall);
        syncSetupSkillCatalog(runtime, selectedOptions);
      }

      return code;
    }
    case "mcps": {
      const selectedOptions = await resolveMcpOptions(prepared.options);
      if (!selectedOptions.yes && selectedOptions.selectedMcpIds.length === 0) {
        runtime.io.stdout("\nNo MCPs selected. No changes planned.");
        return 0;
      }

      if (!selectedOptions.yes && selectedOptions.selectedMcpIds.length > 0 && selectedOptions.agents.length === 0) {
        runtime.io.stdout("\nNo MCP targets selected. Skipping MCP install.");
        return 0;
      }

      return runDelegateCommands(runtime, buildMcpCommands(selectedOptions), selectedOptions);
    }
    case "plugins": {
      const selectedOptions = await resolvePluginOptions(prepared.options);
      if (!selectedOptions.yes && selectedOptions.selectedPluginIds.length === 0) {
        runtime.io.stdout("\nNo plugins selected. No changes planned.");
        return 0;
      }

      return runDelegateCommands(runtime, buildPluginCommands(selectedOptions), {
        ...options,
        continueOnError: true,
      });
    }
    case "hooks": {
      const selectedOptions = await resolveHookOptions(prepared.options);
      if (!selectedOptions.yes && (selectedOptions.selectedHookIds.length === 0 || selectedOptions.agents.length === 0)) {
        runtime.io.stdout("\nNo hooks selected. No changes planned.");
        return 0;
      }

      return syncHooks(runtime, selectedOptions);
    }
  }
}

function syncSetupSkillCatalog(runtime: Runtime, options: CliOptions): void {
  if (options.dryRun) {
    return;
  }

  try {
    syncSkillCatalogFromManifest({
      homeDir: options.homeDir,
      selectedSkillIds: options.selectedSkillIds,
      allSkills: options.allSkills,
      dryRun: false,
    });
  } catch (error) {
    runtime.io.stderr(`Warning: could not update AFK skill catalog. ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function resolveRulesOptions(options: CliOptions): Promise<CliOptions> {
  if (options.agents.length > 0) {
    return options;
  }

  const detected = detectSetupTargets(options);
  if (detected.agents.length > 0 || options.yes) {
    return {
      ...options,
      agents: detected.agents,
    };
  }

  const selection = await selectRulesSync(options);
  return {
    ...options,
    agents: selection.agents,
  };
}

async function resolveSkillOptions(options: CliOptions): Promise<CliOptions> {
  if (options.selectedSkillIds.length > 0 && (!options.yes || options.selectedSkillAgentIds.length > 0)) {
    return options;
  }

  if (options.yes) {
    const detected = detectSetupTargets(options);
    return {
      ...options,
      selectedSkillAgentIds: options.selectedSkillAgentIds.length > 0 ? options.selectedSkillAgentIds : detected.skillAgents,
    };
  }

  const selection = await selectSkillsInstall(options);
  return {
    ...options,
    selectedSkillIds: selection.skillIds,
    selectedSkillAgentIds: selection.skillAgents,
  };
}

async function resolveMcpOptions(options: CliOptions): Promise<CliOptions> {
  if (options.agents.length > 0 && (options.yes || options.selectedMcpIds.length > 0)) {
    return options;
  }

  const detected = detectSetupTargets(options);
  if (detected.agents.length > 0 || options.yes) {
    return {
      ...options,
      agents: detected.agents,
    };
  }

  if (options.selectedMcpIds.length > 0) {
    return options;
  }

  const selection = await selectMcpsInstall(options);
  return {
    ...options,
    agents: selection.agents,
    selectedMcpIds: selection.mcpIds,
  };
}

async function resolvePluginOptions(options: CliOptions): Promise<CliOptions> {
  if (options.yes || options.selectedPluginIds.length > 0) {
    return options;
  }

  const selection = await selectPluginsInstall(options);
  return {
    ...options,
    agents: selection.agents,
    selectedPluginIds: selection.pluginIds,
  };
}

async function resolveHookOptions(options: CliOptions): Promise<CliOptions> {
  if (options.agents.length > 0 && (options.yes || options.selectedHookIds.length > 0)) {
    return options;
  }

  const detected = detectSetupTargets(options);
  if (detected.hookAgents.length > 0 || options.yes) {
    return {
      ...options,
      agents: detected.hookAgents,
    };
  }

  if (options.selectedHookIds.length > 0) {
    return options;
  }

  const selection = await selectHooksInstall(options);
  return {
    ...options,
    agents: selection.agents,
    selectedHookIds: selection.hookIds,
  };
}

async function ensureManifestFiles(runtime: Runtime, options: CliOptions): Promise<number> {
  const operations = await ensureLocalManifests(options);
  if (operations.length === 0) {
    return 0;
  }

  if (options.dryRun) {
    runtime.io.stdout(`\n${sectionTitle("Local Catalog")}`);
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nLocal catalog prepared: ${summarizeOperations(operations)}.`);
  return 0;
}

async function prepareSetupManifests(runtime: Runtime, options: CliOptions): Promise<{ code: number; options: CliOptions }> {
  if (options.defaultsSourceExplicit) {
    const manifestContents = await loadSourceManifestContents({ ...options, rememberDefaultsSource: false });
    return { code: 0, options: { ...options, manifestContents, rememberDefaultsSource: false } };
  }

  if (readRememberedDefaultsSource(options)) {
    return { code: 0, options };
  }

  const selectedSource = options.yes ? builtInDefaultsSource : (await selectDefaultsSource(builtInDefaultsSource)).trim();
  return prepareManifestFiles(runtime, {
    ...options,
    defaultsSource: selectedSource,
    defaultsSourceExplicit: true,
    refreshDefaults: true,
    rememberDefaultsSource: true,
  });
}

async function prepareManifestFiles(runtime: Runtime, options: CliOptions): Promise<{ code: number; options: CliOptions }> {
  const operations = await ensureLocalManifests(options);
  const manifestContents = manifestContentsFromOperations(operations);

  if (operations.length === 0) {
    return { code: 0, options };
  }

  if (options.dryRun) {
    runtime.io.stdout(`\n${sectionTitle("Local Catalog")}`);
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return { code: 0, options: { ...options, manifestContents } };
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nLocal catalog prepared: ${summarizeOperations(operations)}.`);
  return { code: 0, options: { ...options, manifestContents } };
}

function manifestContentsFromOperations(operations: PathOperation[]): Partial<Record<ManifestFilename, string>> {
  const contents: Partial<Record<ManifestFilename, string>> = {};

  for (const operation of operations) {
    if (operation.type !== "write") {
      continue;
    }

    const filename = basename(operation.path);
    if (!isManifestFilename(filename)) {
      continue;
    }

    contents[filename] = operation.content;
  }

  return contents;
}

function isManifestFilename(value: string | undefined): value is ManifestFilename {
  return value === "skills.json" ||
    value === "mcps.json" ||
    value === "presets.json" ||
    value === "rules.json" ||
    value === "plugins.json" ||
    value === "hooks.json";
}

function areaLabel(area: Area): string {
  switch (area) {
    case "rules":
      return "Rules";
    case "skills":
      return "Skills";
    case "mcps":
      return "MCPs";
    case "plugins":
      return "Plugins";
    case "hooks":
      return "Hooks";
  }
}

function scopeLabel(scope: CliOptions["setupScope"], cwd: string): string {
  return scope === "global" ? "Global field kit" : `This project only (${cwd})`;
}
