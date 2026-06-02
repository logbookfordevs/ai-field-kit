import { syncRules } from "./rules.js";
import { syncHooks } from "./hooks.js";
import { syncSkillInvocationPolicy } from "./skills.js";
import { detectSetupTargets } from "./agent-detection.js";
import { buildMcpCommands, buildSkillCommands, buildUtilityCommands, runDelegateCommands } from "./delegates.js";
import { renderBanner, renderSetupOutro, sectionTitle, muted } from "./brand.js";
import { selectDefaultsSource, selectHooksInstall, selectMcpsInstall, selectRulesSync, selectSetup, selectSkillsInstall, selectUtilsInstall } from "./interactive.js";
import { applyOperation, formatOperation, summarizeOperations } from "./fs-utils.js";
import { ensureLocalManifests, planRememberedDefaultsSourceUpdate, readRememberedDefaultsSource } from "./manifest.js";
import { defaultCheckedDetail } from "./prompt-ui.js";
import { packageVersion, resolveUpdateNotice } from "./update-check.js";
import type { SetupSelection } from "./interactive.js";
import type { Area, CliOptions, Runtime } from "./types.js";

export async function runSetup(runtime: Runtime, options: CliOptions): Promise<number> {
  const updateNotice = options.yes || options.refreshDefaults
    ? null
    : await resolveUpdateNotice({ currentVersion: packageVersion() });

  runtime.io.stdout(renderBanner({
    showRefreshHint: !options.refreshDefaults,
    updateNotice,
  }));

  const defaultSourceUpdateCode = applyDefaultSourceUpdate(runtime, options);
  if (defaultSourceUpdateCode !== null) {
    return defaultSourceUpdateCode;
  }

  const sourceValidationCode = validateNonInteractiveSource(runtime, options);
  if (sourceValidationCode !== null) {
    return sourceValidationCode;
  }

  if (options.refreshDefaults) {
    runtime.io.stdout(
      options.manifestLocal
        ? "Refreshing project AFK manifests from your configured defaults source."
        : "Refreshing global AFK manifests from your configured defaults source.",
    );
    return ensureManifestFiles(runtime, options);
  }

  runtime.io.stdout("Choose the parts of your AI field setup you want AFK to prepare.");
  runtime.io.stdout(muted(defaultCheckedDetail));

  const sourceOptions = await resolveSetupSource(options);
  const manifestCode = await ensureManifestFiles(runtime, sourceOptions);
  if (manifestCode !== 0 || sourceOptions.initOnly) {
    return manifestCode;
  }

  const selection = await selectSetup(sourceOptions);
  const selectedOptions: CliOptions = {
    ...sourceOptions,
    agents: selection.agents,
    setupScope: selection.setupScope,
    scopeExplicit: true,
    setupManifestsPrepared: true,
    selectedSkillIds: selection.skillIds,
    selectedSkillAgentIds: selection.skillAgents,
    selectedMcpIds: selection.mcpIds,
    selectedUtilIds: selection.utilIds,
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

  if (area === "utils") {
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
  const defaultSourceUpdateCode = applyDefaultSourceUpdate(runtime, options);
  if (defaultSourceUpdateCode !== null) {
    return defaultSourceUpdateCode;
  }

  const sourceValidationCode = validateNonInteractiveSource(runtime, options);
  if (sourceValidationCode !== null) {
    return sourceValidationCode;
  }

  const sourceOptions = options.setupManifestsPrepared ? options : await resolveSetupSource(options);
  const manifestCode = options.setupManifestsPrepared ? 0 : await ensureManifestFiles(runtime, sourceOptions);
  if (manifestCode !== 0 || sourceOptions.initOnly) {
    return manifestCode;
  }

  switch (area) {
    case "rules": {
      const selectedOptions = await resolveRulesOptions(sourceOptions);
      return syncRules(runtime, selectedOptions);
    }
    case "skills": {
      const selectedOptions = await resolveSkillOptions(sourceOptions);
      if (!selectedOptions.yes && selectedOptions.selectedSkillIds.length === 0) {
        runtime.io.stdout("\nNo skills selected. No changes planned.");
        return 0;
      }

      const code = await runDelegateCommands(runtime, buildSkillCommands(selectedOptions), selectedOptions);
      if (code === 0) {
        syncSkillInvocationPolicy(runtime, selectedOptions);
      }

      return code;
    }
    case "mcps": {
      const selectedOptions = await resolveMcpOptions(sourceOptions);
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
    case "utils": {
      const selectedOptions = await resolveUtilityOptions(sourceOptions);
      if (!selectedOptions.yes && selectedOptions.selectedUtilIds.length === 0) {
        runtime.io.stdout("\nNo utilities selected. No changes planned.");
        return 0;
      }

      return runDelegateCommands(runtime, buildUtilityCommands(selectedOptions), {
        ...options,
        continueOnError: true,
      });
    }
    case "hooks": {
      const selectedOptions = await resolveHookOptions(sourceOptions);
      if (!selectedOptions.yes && (selectedOptions.selectedHookIds.length === 0 || selectedOptions.agents.length === 0)) {
        runtime.io.stdout("\nNo hooks selected. No changes planned.");
        return 0;
      }

      return syncHooks(runtime, selectedOptions);
    }
  }
}

function validateNonInteractiveSource(runtime: Runtime, options: CliOptions): number | null {
  if (!options.yes || options.defaultsSourceExplicit || readRememberedDefaultsSource(options)) {
    return null;
  }

  runtime.io.stderr("No default setup source is configured.");
  runtime.io.stderr("Run afk setup to choose a source interactively, or run afk setup --default-source <source>.");
  return 1;
}

async function resolveSetupSource(options: CliOptions): Promise<CliOptions> {
  if (options.defaultsSourceExplicit) {
    return { ...options, rememberDefaultsSource: false };
  }

  const rememberedSource = readRememberedDefaultsSource(options);
  if (options.yes) {
    return {
      ...options,
      defaultsSource: rememberedSource,
      defaultsSourceExplicit: true,
      rememberDefaultsSource: false,
    };
  }

  const selectedSource = await selectDefaultsSource(rememberedSource);
  return {
    ...options,
    defaultsSource: selectedSource.trim(),
    defaultsSourceExplicit: true,
    rememberDefaultsSource: false,
  };
}

function applyDefaultSourceUpdate(runtime: Runtime, options: CliOptions): number | null {
  if (!options.defaultSourceUpdate) {
    return null;
  }

  const operations = planRememberedDefaultsSourceUpdate(options, options.defaultSourceUpdate);
  if (options.dryRun) {
    runtime.io.stdout(`\n${sectionTitle("Default Setup Source")}`);
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`Default setup source updated to ${options.defaultSourceUpdate.trim()}.`);
  runtime.io.stdout("Run afk setup again to continue with that source preselected.");
  return 0;
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

async function resolveUtilityOptions(options: CliOptions): Promise<CliOptions> {
  if (options.yes || options.selectedUtilIds.length > 0) {
    return options;
  }

  const selection = await selectUtilsInstall(options);
  return {
    ...options,
    agents: selection.agents,
    selectedUtilIds: selection.utilIds,
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
    runtime.io.stdout(`\n${sectionTitle("Local Manifests")}`);
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nLocal manifests prepared: ${summarizeOperations(operations)}.`);
  return 0;
}

function areaLabel(area: Area): string {
  switch (area) {
    case "rules":
      return "Rules";
    case "skills":
      return "Skills";
    case "mcps":
      return "MCPs";
    case "utils":
      return "Utils";
    case "hooks":
      return "Hooks";
  }
}

function scopeLabel(scope: CliOptions["setupScope"], cwd: string): string {
  return scope === "global" ? "Global field kit" : `This project only (${cwd})`;
}
