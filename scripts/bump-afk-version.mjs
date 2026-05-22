#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const packageJsonPath = resolve(rootDir, "packages", "afk", "package.json");
const changelogPath = resolve(rootDir, "CHANGELOG.md");
const installScriptPath = resolve(rootDir, "scripts", "install.sh");

const args = process.argv.slice(2);
const dryRun = takeFlag(args, "--dry-run");
const help = takeFlag(args, "--help") || takeFlag(args, "-h");
const bump = args[0] ?? "patch";

if (help) {
  usage();
  process.exit(0);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
if (!packageJson || typeof packageJson !== "object" || typeof packageJson.version !== "string") {
  fail(`Could not read version from ${packageJsonPath}`);
}

const currentVersion = packageJson.version;
const nextVersion = resolveNextVersion(currentVersion, bump);
const today = new Date().toISOString().slice(0, 10);

packageJson.version = nextVersion;
const nextPackageJson = `${JSON.stringify(packageJson, null, 2)}\n`;
const nextChangelog = promoteChangelog(readFileSync(changelogPath, "utf8"), nextVersion, today);
const nextInstallScript = readFileSync(installScriptPath, "utf8").replace(
  /--version v\d+\.\d+\.\d+/g,
  `--version v${nextVersion}`,
);

if (dryRun) {
  info(`would bump AFK ${currentVersion} -> ${nextVersion}`);
  info(`would promote CHANGELOG.md TBD section to v${nextVersion} - ${today}`);
  info("would update install.sh version example");
  process.exit(0);
}

writeFileSync(packageJsonPath, nextPackageJson);
writeFileSync(changelogPath, nextChangelog);
writeFileSync(installScriptPath, nextInstallScript);

info(`bumped AFK ${currentVersion} -> ${nextVersion}`);
info(`promoted CHANGELOG.md TBD section to v${nextVersion} - ${today}`);
info("updated install.sh version example");

function takeFlag(values, flag) {
  const index = values.indexOf(flag);
  if (index < 0) {
    return false;
  }

  values.splice(index, 1);
  return true;
}

function resolveNextVersion(current, value) {
  if (/^\d+\.\d+\.\d+$/.test(value)) {
    return value;
  }

  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    fail(`Current version must be semver major.minor.patch, got ${current}`);
  }

  const [, majorRaw, minorRaw, patchRaw] = match;
  let major = Number(majorRaw);
  let minor = Number(minorRaw);
  let patch = Number(patchRaw);

  switch (value) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      fail(`Unknown bump "${value}". Use patch, minor, major, or an explicit version like 0.6.0.`);
  }

  return `${major}.${minor}.${patch}`;
}

function promoteChangelog(content, version, date) {
  const heading = "## TBD - TBD";
  const index = content.indexOf(heading);
  if (index < 0) {
    fail("CHANGELOG.md must contain a ## TBD - TBD section before release prep.");
  }

  const nextHeadingIndex = content.indexOf("\n## ", index + heading.length);
  const before = content.slice(0, index);
  const tbdSection = nextHeadingIndex >= 0 ? content.slice(index, nextHeadingIndex) : content.slice(index);
  const after = nextHeadingIndex >= 0 ? content.slice(nextHeadingIndex) : "";

  const hasEntries = tbdSection
    .split(/\r?\n/)
    .some((line) => line.trim().startsWith("- "));
  if (!hasEntries) {
    fail("CHANGELOG.md TBD section has no release entries to promote.");
  }

  return `${before}## TBD - TBD\n\n${tbdSection.replace(heading, `## v${version} - ${date}`)}${after}`;
}

function usage() {
  console.log(`Usage: node scripts/bump-afk-version.mjs [patch|minor|major|x.y.z] [--dry-run]

Bumps packages/afk/package.json, promotes CHANGELOG.md's TBD section, and
updates the install.sh pinned-version example.

Examples:
  node scripts/bump-afk-version.mjs patch
  node scripts/bump-afk-version.mjs minor
  node scripts/bump-afk-version.mjs 0.6.0 --dry-run`);
}

function info(message) {
  console.log(`afk ${message}`);
}

function fail(message) {
  console.error(`afk ${message}`);
  process.exit(1);
}
