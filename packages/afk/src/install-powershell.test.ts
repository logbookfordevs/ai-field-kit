import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "vitest";

const script = readFileSync(resolve(import.meta.dirname, "../../../scripts/install.ps1"), "utf8");

test("PowerShell installer supports Windows PowerShell 5.1-safe syntax", () => {
  assert.match(script, /^[\x00-\x7F]*$/);
  assert.ok(!script.includes("??"));
  assert.ok(!script.includes("&&"));
});

test("PowerShell installer validates Node and installs the published package", () => {
  assert.ok(script.includes("Get-Command node.exe"));
  assert.ok(script.includes("$minimumNodeMajor = 20"));
  assert.ok(script.includes("Get-Command npm.cmd"));
  assert.ok(script.includes("install --global --ignore-scripts $packageSpec"));
  assert.ok(script.includes("& $afkPath --version"));
  assert.ok(script.includes("$env:AFK_INSTALL_PACKAGE_SPEC"));
});

test("PowerShell installer validates pinned versions and supports uninstall", () => {
  assert.ok(script.includes("[switch]$Uninstall"));
  assert.ok(script.includes("uninstall --global $packageName"));
  assert.ok(script.includes("$normalizedVersion -notmatch"));
});
