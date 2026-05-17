import { syncRules } from "./rules.js";
import { syncWorkflows } from "./workflows.js";
import { buildMcpCommands, buildSkillCommands, buildUtilityCommands, runDelegateCommands } from "./delegates.js";
import { renderBanner, renderSetupOutro, sectionTitle, muted } from "./brand.js";
import { selectSetup, selectUtilsInstall } from "./interactive.js";
import { applyOperation, formatOperation, summarizeOperations } from "./fs-utils.js";
import { ensureLocalManifests } from "./manifest.js";
import type { Area, CliOptions, Runtime } from "./types.js";

export async function runSetup(runtime: Runtime, options: CliOptions): Promise<number> {
  runtime.io.stdout(renderBanner());
  runtime.io.stdout("Choose the parts of your AI field setup you want AFK to prepare.");
  runtime.io.stdout(muted("Everything starts selected. Unselect anything you want to leave alone."));

  const manifestCode = await ensureManifestFiles(runtime, options);
  if (manifestCode !== 0 || options.initOnly) {
    return manifestCode;
  }

  const selection = await selectSetup(options);
  const selectedOptions: CliOptions = {
    ...options,
    agents: selection.agents,
    setupScope: selection.setupScope,
    scopeExplicit: true,
    selectedSkillIds: selection.skillIds,
    selectedMcpIds: selection.mcpIds,
    selectedUtilIds: selection.utilIds,
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
    runtime.io.stdout(`- Agents: ${selection.agents.join(", ")}`);
  }

  const failures: Array<{ area: Area; code: number }> = [];

  for (const area of selection.areas) {
    runtime.io.stdout(`\n${sectionTitle(areaLabel(area))}`);
    const code = await runArea(area, runtime, selectedOptions);
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

export async function runArea(area: Area, runtime: Runtime, options: CliOptions): Promise<number> {
  const manifestCode = await ensureManifestFiles(runtime, options);
  if (manifestCode !== 0 || options.initOnly) {
    return manifestCode;
  }

  switch (area) {
    case "rules":
      return syncRules(runtime, options);
    case "workflows":
      return syncWorkflows(runtime, options);
    case "skills":
      return runDelegateCommands(runtime, buildSkillCommands(options), options);
    case "mcps":
      return runDelegateCommands(runtime, buildMcpCommands(options), options);
    case "utils": {
      const selectedOptions = await resolveUtilityOptions(options);
      if (!selectedOptions.yes && selectedOptions.selectedUtilIds.length === 0) {
        runtime.io.stdout("\nNo utilities selected. No changes planned.");
        return 0;
      }

      return runDelegateCommands(runtime, buildUtilityCommands(selectedOptions), {
        ...options,
        continueOnError: true,
      });
    }
  }
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
    case "workflows":
      return "Workflows";
    case "skills":
      return "Skills";
    case "mcps":
      return "MCPs";
    case "utils":
      return "Utils";
  }
}

function scopeLabel(scope: CliOptions["setupScope"], cwd: string): string {
  return scope === "global" ? "Global field kit" : `This project only (${cwd})`;
}
