import { syncRules } from "./rules.js";
import { syncHooks } from "./hooks.js";
import { customAgentTargetPath, syncCustomAgents, type CustomAgentHarness } from "./custom-agents.js";
import { snapshotDisabledStartupSkills, syncSkillInvocationPolicy, syncSkillStartupStorage } from "./skills.js";
import { loadSetupSkillProfileCatalog, loadSkillProfileState, reconcileSkillProfiles } from "./skills/profiles.js";
import { mergeSetupSourceSkillsIntoCatalog, syncSkillCatalogFromManifest } from "./skills/catalog.js";
import { planSetupSourceCatalogImport, planSkillCatalogRecovery, snapshotSetupSourceLockedSkillIds } from "./catalog-import.js";
import { detectSetupTargets } from "./agent-detection.js";
import { buildMcpCommands, buildSkillCommands, buildPluginCommands, runDelegateCommands } from "./delegates.js";
import { renderArchitectOutro, renderBanner, renderSetupOutro, sectionTitle, muted } from "./brand.js";
import { confirmSkillProfileInstall, selectCustomAgentsInstall, selectDefaultsSource, selectHooksInstall, selectMcpsInstall, selectRecoverableProfileSkills, selectRulesSync, selectSetup, selectSkillProfilesInstall, selectSkillsInstall, selectPluginsInstall } from "./interactive.js";
import { applyOperation, formatOperation, summarizeOperations } from "./fs-utils.js";
import { builtInDefaultsSource, ensureLocalManifests, expandComposedSkillIds, loadSkillManifest, loadSourceManifestContents, localManifestDir, mergedRulesManifestContent, projectManifestDir, readRememberedDefaultsSource } from "./manifest.js";
import { defaultCheckedDetail, renderSkillProfileReview } from "./prompt-ui.js";
import { packageVersion, resolveUpdateNotice } from "./update-check.js";
import type { SetupSelection } from "./interactive.js";
import { basename, join } from "node:path";
import type { AgentId, Area, CliOptions, ManifestCategory, ManifestFilename, PathOperation, Runtime } from "./types.js";

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

  let selection: SetupSelection;
  try {
    selection = await selectSetup(prepared.options);
  } catch (error) {
    if (!prepared.options.presetId && !prepared.options.presetPrompt) {
      throw error;
    }
    runtime.io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const selectedOptions: CliOptions = {
    ...prepared.options,
    ...(selection.presetId ? { presetId: selection.presetId } : {}),
    agents: selection.agents,
    setupScope: selection.setupScope,
    scopeExplicit: true,
    setupManifestsPrepared: true,
    selectedSkillIds: selection.skillIds,
    selectedSkillProfileIds: selection.profileIds ?? [],
    selectedCustomAgentIds: selection.customAgentIds ?? [],
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

  const selectedPresetId = selection.presetId ?? options.presetId;
  const architectPreset = selectedPresetId === "afk-architect";
  runtime.io.stdout(architectPreset ? `\n${sectionTitle("AFK Architect")}` : "\nSetup path");
  if (architectPreset) {
    runtime.io.stdout("- Preset: afk-architect");
    runtime.io.stdout("- Bundle: Architect + Cartographer + Builder + Pathfinder");
  } else if (selectedPresetId) {
    runtime.io.stdout(`- Preset: ${selectedPresetId}`);
  }
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
    runtime.io.stdout(architectPreset
      ? architectOutro(options, selection, true)
      : renderSetupOutro({
          dryRun: options.dryRun,
          failed: true,
          scopeLabel: scopeLabel(selection.setupScope, options.cwd),
          areas: selection.areas.map(areaLabel),
        }));
    return failures[0]?.code ?? 1;
  }

  runtime.io.stdout(architectPreset
    ? architectOutro(options, selection, false)
    : renderSetupOutro({
        dryRun: options.dryRun,
        failed: false,
        scopeLabel: scopeLabel(selection.setupScope, options.cwd),
        areas: selection.areas.map(areaLabel),
      }));
  return 0;
}

function architectOutro(options: CliOptions, selection: SetupSelection, failed: boolean): string {
  const harnesses = selection.agents.filter(isCustomAgentHarness);
  const multipleHarnesses = harnesses.length > 1;
  const crew = (selection.customAgentIds ?? []).flatMap((id) => harnesses.map((harness) => ({
    label: `${crewLabel(id)}${multipleHarnesses ? ` (${harnessLabel(harness)})` : ""}`,
    path: displaySetupPath(customAgentTargetPath(id, harness, {
      homeDir: options.homeDir,
      cwd: options.cwd,
      setupScope: selection.setupScope,
    }), options.homeDir),
  })));
  const skillId = selection.skillIds[0] ?? "afk-architect";
  const skillRoot = selection.setupScope === "global" ? options.homeDir : options.cwd;

  return renderArchitectOutro({
    dryRun: options.dryRun,
    failed,
    scopeLabel: scopeLabel(selection.setupScope, options.cwd),
    harnesses: harnesses.map(harnessLabel),
    skill: {
      label: "AFK Architect",
      path: displaySetupPath(join(skillRoot, ".agents", "skills", skillId), options.homeDir),
    },
    crew,
  });
}

function isCustomAgentHarness(agent: AgentId): agent is CustomAgentHarness {
  return agent === "codex" || agent === "claude" || agent === "pi";
}

function crewLabel(id: string): string {
  if (id === "afk-cartographer") return "Cartographer";
  if (id === "afk-builder") return "Builder";
  if (id === "afk-pathfinder") return "Pathfinder";
  return id;
}

function displaySetupPath(path: string, homeDir: string): string {
  return path === homeDir ? "~" : path.startsWith(`${homeDir}/`) ? `~/${path.slice(homeDir.length + 1)}` : path;
}

function harnessLabel(agent: AgentId): string {
  if (agent === "codex") return "Codex";
  if (agent === "claude") return "Claude Code";
  if (agent === "pi") return "Pi";
  return agent;
}

function areaOptionsForSetupArea(
  area: Area,
  originalOptions: CliOptions,
  selectedOptions: CliOptions,
  selection: SetupSelection,
): CliOptions {
  const options = { ...selectedOptions, setupSourceExplicit: originalOptions.defaultsSourceExplicit };
  if (area === "hooks") {
    return { ...options, agents: selection.hookAgents };
  }

  if (area === "plugins") {
    return { ...options, agents: originalOptions.agents };
  }

  return options;
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
  const explicitSetupSource = options.setupSourceExplicit ?? options.defaultsSourceExplicit;
  const profileManifestCategory: ManifestCategory[] = ["profiles", "skills"];
  const areaOptions = area === "profiles" && options.selectedManifestCategories.length === 0
    ? { ...options, selectedManifestCategories: profileManifestCategory }
    : options;
  const prepared = areaOptions.setupManifestsPrepared ? { code: 0, options: areaOptions } : await prepareSetupManifests(runtime, areaOptions);
  if (prepared.code !== 0 || prepared.options.initOnly) {
    return prepared.code;
  }

  switch (area) {
    case "rules": {
      const merge = planExplicitSetupRulesMerge(runtime, prepared.options, explicitSetupSource);
      const selectedOptions = await resolveRulesOptions(merge.options);
      const code = await syncRules(runtime, selectedOptions);
      if (code === 0 && merge.operation && !selectedOptions.dryRun) {
        applyOperation(merge.operation);
      }
      return code;
    }
    case "skills": {
      const selectedOptions = await resolveSkillOptions(prepared.options);
      if (!selectedOptions.yes && selectedOptions.selectedSkillIds.length === 0) {
        runtime.io.stdout("\nNo skills selected. No changes planned.");
        return 0;
      }

      const disabledBeforeInstall = snapshotDisabledStartupSkills(selectedOptions);
      const preexistingWholeSourceSkillIds = explicitSetupSource && selectedOptions.manifestContents
        ? snapshotSetupSourceLockedSkillIds({
            homeDir: selectedOptions.homeDir,
            cwd: selectedOptions.cwd,
            manifestLocal: selectedOptions.manifestLocal,
            manifestContents: selectedOptions.manifestContents,
            selectedSkillIds: selectedOptions.selectedSkillIds,
            allSkills: selectedOptions.allSkills,
            dryRun: selectedOptions.dryRun,
          })
        : [];
      const code = await runDelegateCommands(runtime, buildSkillCommands(selectedOptions), selectedOptions);
      if (code === 0) {
        syncSkillInvocationPolicy(runtime, selectedOptions);
        syncSkillStartupStorage(runtime, selectedOptions, disabledBeforeInstall);
        syncSetupSkillCatalog(runtime, selectedOptions, explicitSetupSource, preexistingWholeSourceSkillIds);
        reconcileEnabledSetupSkillProfiles(runtime, selectedOptions);
      }

      return code;
    }
    case "profiles": {
      if (prepared.options.yes || prepared.options.verbose) {
        runtime.io.stdout("\nProfile catalog prepared.");
        runtime.io.stdout(`- ${profileCatalogPath(prepared.options)}`);
      }
      const selection = await selectSkillProfilesInstall(prepared.options);
      if ((selection.profileIds?.length ?? 0) === 0) {
        runtime.io.stdout("\nNo skill profiles selected. No changes planned.");
        return 0;
      }

      const catalog = loadSetupSkillProfileCatalog(prepared.options);
      const selectedProfiles = catalog.items.filter((profile) => selection.profileIds?.includes(profile.id));
      const directSkillIds = [...new Set([...catalog.alwaysOn, ...selectedProfiles.flatMap((profile) => profile.skills)])];
      let skillManifest = loadSkillManifest(prepared.options);
      const selectedSkillIds = expandComposedSkillIds(skillManifest.items, directSkillIds);
      const initialAvailableIds = new Set(skillManifest.items.map((item) => item.id));
      const missingIds = selectedSkillIds.filter((id) => !initialAvailableIds.has(id));
      let recoveryOperation: PathOperation | undefined;
      let recoveryIdsToVerify: string[] = [];
      if (missingIds.length > 0) {
        const recoveryCandidates = planSkillCatalogRecovery(prepared.options, missingIds, catalog.skillAliases).recovered;
        if (recoveryCandidates.length > 0) {
          const selectedRecoveryIds = prepared.options.yes
            ? recoveryCandidates.map((item) => item.id)
            : await selectRecoverableProfileSkills(recoveryCandidates.map(({ id, label, source }) => ({ id, label, source })));
          const recoveryPlan = planSkillCatalogRecovery(prepared.options, selectedRecoveryIds, catalog.skillAliases);
          recoveryOperation = recoveryPlan.operation;
          recoveryIdsToVerify = recoveryPlan.recovered.map((item) => item.id);
          if (recoveryPlan.recovered.length > 0) {
            skillManifest = recoveryPlan.manifest;
          }
        }
      }
      const availableIds = new Set(skillManifest.items.map((item) => item.id));
      const unavailableIds = selectedSkillIds.filter((id) => !availableIds.has(id));
      const availableSkillIds = selectedSkillIds.filter((id) => availableIds.has(id));
      if (missingIds.length > 0) {
        if (availableSkillIds.length === 0) {
          runtime.io.stderr("No available profile skills remain. No changes planned.");
          return 1;
        }
        runtime.io.stdout(`\n${renderSkillProfileReview({
          profileNames: selectedProfiles.map((profile) => profile.name),
          availableIds: availableSkillIds,
          unavailableIds,
        })}`);
        const accepted = prepared.options.yes || await confirmSkillProfileInstall();
        if (!accepted) {
          runtime.io.stdout("Profile skill installation cancelled. No changes planned.");
          return 0;
        }
      }

      const dependencyIds = availableSkillIds.filter((id) => !directSkillIds.includes(id));
      runtime.io.stdout(`\nSelected skill profiles: ${selectedProfiles.map((profile) => profile.name).join(", ")}`);
      if (dependencyIds.length > 0) {
        runtime.io.stdout("Selected profiles include composable skills.");
        runtime.io.stdout(`Dependencies added automatically: ${dependencyIds.map((id) => {
          const item = skillManifest.items.find((candidate) => candidate.id === id);
          return `${item?.label ?? id} (${id})`;
        }).join(", ")}.`);
      }

      const selectedOptions = {
        ...prepared.options,
        manifestContents: {
          ...prepared.options.manifestContents,
          "skills.json": JSON.stringify(skillManifest),
        },
        selectedSkillIds: availableSkillIds,
        selectedSkillAgentIds: selection.skillAgents,
      };
      const disabledBeforeInstall = snapshotDisabledStartupSkills(selectedOptions);
      const preexistingWholeSourceSkillIds = explicitSetupSource && selectedOptions.manifestContents
        ? snapshotSetupSourceLockedSkillIds({
            homeDir: selectedOptions.homeDir,
            cwd: selectedOptions.cwd,
            manifestLocal: selectedOptions.manifestLocal,
            manifestContents: selectedOptions.manifestContents,
            selectedSkillIds: selectedOptions.selectedSkillIds,
            allSkills: selectedOptions.allSkills,
            dryRun: selectedOptions.dryRun,
          })
        : [];
      const code = await runDelegateCommands(runtime, buildSkillCommands(selectedOptions), selectedOptions);
      if (code === 0) {
        if (recoveryOperation && !selectedOptions.dryRun) {
          const verifiedRecovery = planSkillCatalogRecovery(prepared.options, recoveryIdsToVerify, catalog.skillAliases);
          const verifiedIds = new Set(verifiedRecovery.recovered.map((item) => item.id));
          const recoveryVerified = recoveryIdsToVerify.every((id) => verifiedIds.has(id));
          if (!recoveryVerified || !verifiedRecovery.operation) {
            runtime.io.stderr("Recovered profile skills were not added to the cached catalog because their installed folders and lock metadata could not be verified.");
            return 1;
          }
          applyOperation(verifiedRecovery.operation);
        }
        syncSkillInvocationPolicy(runtime, selectedOptions);
        syncSkillStartupStorage(runtime, selectedOptions, disabledBeforeInstall);
        syncSetupSkillCatalog(runtime, selectedOptions, explicitSetupSource, preexistingWholeSourceSkillIds);
        reconcileEnabledSetupSkillProfiles(runtime, selectedOptions);
      }
      return code;
    }
    case "agents": {
      const selectedOptions = await resolveCustomAgentOptions(prepared.options);
      if ((selectedOptions.selectedCustomAgentIds?.length ?? 0) === 0 && !selectedOptions.allCustomAgents) {
        if (selectedOptions.yes) {
          runtime.io.stderr("Select at least one Custom Agent with --custom-agent <id>, or use --all.");
          return 1;
        }
        runtime.io.stdout("\nNo Custom Agents selected. No changes planned.");
        return 0;
      }
      return syncCustomAgents(runtime, selectedOptions);
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

function planExplicitSetupRulesMerge(
  runtime: Runtime,
  options: CliOptions,
  explicitSetupSource: boolean,
): { options: CliOptions; operation?: PathOperation } {
  const sourceContent = options.manifestContents?.["rules.json"];
  if (!explicitSetupSource || !sourceContent) {
    return { options };
  }

  const manifestDir = options.manifestLocal ? projectManifestDir(options.repoDir) : localManifestDir(options.homeDir);
  const path = join(manifestDir, "rules.json");
  const content = mergedRulesManifestContent(sourceContent, path);
  const operation: PathOperation = { type: "write", path, content };

  if (options.dryRun) {
    runtime.io.stdout(`\n${sectionTitle("Local Catalog")}`);
    runtime.io.stdout(`- ${formatOperation(operation)}`);
  }

  return {
    operation,
    options: {
      ...options,
      manifestContents: {
        ...options.manifestContents,
        "rules.json": content,
      },
    },
  };
}

function reconcileEnabledSetupSkillProfiles(runtime: Runtime, options: CliOptions): void {
  if (options.setupScope !== "global") {
    return;
  }

  const context = { homeDir: options.homeDir, cwd: options.cwd, local: false };
  if (loadSkillProfileState(context).activations.length === 0) {
    return;
  }

  const result = reconcileSkillProfiles(context, options.dryRun);
  if (result.movements.length > 0) {
    runtime.io.stdout(`\nFocus profile storage reconciled: ${result.movements.map((movement) => `${movement.action}d ${movement.folder}`).join(", ")}.`);
  }
}

function syncSetupSkillCatalog(
  runtime: Runtime,
  options: CliOptions,
  explicitSetupSource: boolean,
  preexistingWholeSourceSkillIds: string[],
): void {
  try {
    let sourceMerge: ReturnType<typeof mergeSetupSourceSkillsIntoCatalog> | undefined;
    if (options.dryRun && explicitSetupSource && options.manifestContents) {
      sourceMerge = mergeSetupSourceSkillsIntoCatalog({
        homeDir: options.homeDir,
        manifestContents: options.manifestContents,
        selectedSkillIds: options.selectedSkillIds,
        allSkills: options.allSkills,
        dryRun: options.dryRun,
      });
    }
    if (options.dryRun) {
      if (sourceMerge && sourceMerge.merged.length > 0) {
        runtime.io.stdout("\nSkill catalog merge plan");
        for (const id of sourceMerge.merged) {
          runtime.io.stdout(`- ${id} -> ${sourceMerge.path}`);
        }
      }
      return;
    }
    if (explicitSetupSource && options.manifestContents) {
      const importPlan = planSetupSourceCatalogImport({
        homeDir: options.homeDir,
        cwd: options.cwd,
        manifestLocal: options.manifestLocal,
        manifestContents: options.manifestContents,
        selectedSkillIds: options.selectedSkillIds,
        allSkills: options.allSkills,
        preexistingWholeSourceSkillIds,
        dryRun: false,
      });
      if (importPlan.operation) {
        applyOperation(importPlan.operation);
      }
      if (importPlan.missingLock.length > 0) {
        runtime.io.stderr(`Missing lock metadata for installed one-shot source skills: ${importPlan.missingLock.join(", ")}. Re-run setup with --verbose, then retry after the installer writes its skill lock.`);
      }
      return;
    }
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

async function resolveCustomAgentOptions(options: CliOptions): Promise<CliOptions> {
  if ((options.selectedCustomAgentIds?.length ?? 0) > 0 && options.agents.length > 0) {
    return options;
  }
  const selection = await selectCustomAgentsInstall(options);
  return {
    ...options,
    agents: selection.agents,
    selectedCustomAgentIds: selection.customAgentIds ?? [],
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

  const rememberedSource = readRememberedDefaultsSource(options);
  if (rememberedSource && options.selectedManifestCategories.length === 0) {
    return { code: 0, options };
  }

  if (rememberedSource) {
    return prepareManifestFiles(runtime, {
      ...options,
      defaultsSource: rememberedSource,
      defaultsSourceExplicit: true,
      refreshDefaults: true,
      rememberDefaultsSource: false,
    });
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
    value === "profiles.json" ||
    value === "agents.json" ||
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
    case "profiles":
      return "Skills Profiles";
    case "agents":
      return "Custom Agents";
    case "mcps":
      return "MCPs";
    case "plugins":
      return "Plugins";
    case "hooks":
      return "Hooks";
  }
}

function profileCatalogPath(options: CliOptions): string {
  const manifestDir = options.setupScope === "project" || options.manifestLocal
    ? projectManifestDir(options.cwd)
    : localManifestDir(options.homeDir);
  return join(manifestDir, "profiles.json");
}

function scopeLabel(scope: CliOptions["setupScope"], cwd: string): string {
  return scope === "global" ? "Global field kit" : `This project only (${cwd})`;
}
