import assert from "node:assert/strict";
import { test } from "vitest";
import { fetchLatestNpmVersion, isVersionGreater, packageName, resolveUpdateNotice, updateCommand } from "./update-check.js";

test("isVersionGreater compares semver triples", () => {
  assert.equal(isVersionGreater("0.5.3", "0.5.2"), true);
  assert.equal(isVersionGreater("0.6.0", "0.5.9"), true);
  assert.equal(isVersionGreater("1.0.0", "0.99.99"), true);
  assert.equal(isVersionGreater("0.5.2", "0.5.2"), false);
  assert.equal(isVersionGreater("0.5.1", "0.5.2"), false);
  assert.equal(isVersionGreater("latest", "0.5.2"), false);
});

test("resolveUpdateNotice returns an npm upgrade command when latest is newer", async () => {
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
