import assert from "node:assert/strict";
import { test } from "vitest";
import type { Runtime } from "./types.js";
import { fetchLatestNpmVersion, installerCommand, isVersionGreater, packageName, resolveUpdateNotice, runUpdateCommand, updateCommand } from "./update-check.js";

test("isVersionGreater compares semver triples", () => {
  assert.equal(isVersionGreater("0.5.3", "0.5.2"), true);
  assert.equal(isVersionGreater("0.6.0", "0.5.9"), true);
  assert.equal(isVersionGreater("1.0.0", "0.99.99"), true);
  assert.equal(isVersionGreater("0.5.2", "0.5.2"), false);
  assert.equal(isVersionGreater("0.5.1", "0.5.2"), false);
  assert.equal(isVersionGreater("latest", "0.5.2"), false);
});

test("resolveUpdateNotice returns the hosted installer command when latest is newer", async () => {
  const notice = await resolveUpdateNotice({
    currentVersion: "0.5.2",
    fetchLatestVersion: async (name) => {
      assert.equal(name, packageName);
      return "0.5.3";
    },
  });

  assert.deepEqual(notice, {
    currentVersion: "0.5.2",
    latestVersion: "0.5.3",
    command: updateCommand,
  });
});

test("runUpdateCommand dry-run prints the hosted installer command", async () => {
  const output: string[] = [];
  const runtime = testRuntime(output, async () => {
    throw new Error("spawn should not run during dry-run");
  });

  const code = await runUpdateCommand(runtime, { dryRun: true });

  assert.equal(code, 0);
  assert.deepEqual(output, [installerCommand]);
});

test("runUpdateCommand runs the hosted installer through bash", async () => {
  const output: string[] = [];
  const spawns: Array<{ command: string; args: string[]; behavior: { verbose: boolean } | undefined }> = [];
  const runtime = testRuntime(output, async (command, args, _cwd, behavior) => {
    spawns.push({ command, args, behavior });
    return { code: 0 };
  });

  const code = await runUpdateCommand(runtime, { dryRun: false });

  assert.equal(code, 0);
  assert.deepEqual(spawns, [
    {
      command: "bash",
      args: ["-c", installerCommand],
      behavior: { verbose: true },
    },
  ]);
  assert.ok(output.includes("Updating AFK from the latest GitHub release..."));
});

test("resolveUpdateNotice stays quiet when latest is current or lookup fails", async () => {
  assert.equal(await resolveUpdateNotice({
    currentVersion: "0.5.2",
    fetchLatestVersion: async () => "0.5.2",
  }), null);

  assert.equal(await resolveUpdateNotice({
    currentVersion: "0.5.2",
    fetchLatestVersion: async () => {
      throw new Error("network is having a moment");
    },
  }), null);
});

test("fetchLatestNpmVersion reads npm dist-tags latest", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    "dist-tags": {
      latest: "0.6.0",
    },
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })) as typeof fetch;

  try {
    const latest = await fetchLatestNpmVersion(packageName, new AbortController().signal);
    assert.equal(latest, "0.6.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function testRuntime(
  output: string[],
  spawn: Runtime["spawn"],
): Runtime {
  return {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn,
  };
}
