import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultsManifestBaseUrl, defaultsManifestBaseUrls, ensureLocalManifests, localManifestDir } from "./manifest.js";

test("ensureLocalManifests migrates the old Stitch header default", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-manifest-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, "mcps.json");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        version: 1,
        items: [
          {
            id: "stitch",
            label: "Stitch MCP",
            source: "https://stitch.googleapis.com/mcp",
            args: ["--header", "X-Goog-Api-Key: KEY_STITCH", "--name", "stitchmcp"],
            default: true,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const operations = await ensureLocalManifests({
    homeDir,
    repoDir: "/tmp/repo",
    rulesRef: "main",
    rulesSource: "local",
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    dryRun: false,
  });

  const write = operations.find((operation) => operation.type === "write" && operation.path === manifestPath);
  assert.ok(write && write.type === "write");
  assert.ok(!write.content.includes("X-Goog-Api-Key"));
  assert.ok(write.content.includes("\"--name\""));

  writeFileSync(write.path, write.content);
  const next = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: number; items: Array<{ args: string[] }> };
  assert.equal(next.version, 2);
  assert.deepEqual(next.items[0]?.args, ["--name", "stitchmcp"]);
});

test("defaultsManifestBaseUrl resolves GitHub shorthand to the AFK manifest convention", () => {
  assert.equal(
    defaultsManifestBaseUrl("acme/dev-kit", "main"),
    "https://raw.githubusercontent.com/acme/dev-kit/main/afk/manifests",
  );
});

test("defaultsManifestBaseUrls falls back to the package manifest convention", () => {
  assert.deepEqual(
    defaultsManifestBaseUrls("acme/dev-kit", "main"),
    [
      "https://raw.githubusercontent.com/acme/dev-kit/main/afk/manifests",
      "https://raw.githubusercontent.com/acme/dev-kit/main/packages/afk/manifests",
    ],
  );
});

test("defaultsManifestBaseUrl preserves GitHub tree paths as manifest directories", () => {
  assert.equal(
    defaultsManifestBaseUrl("https://github.com/acme/dev-kit/tree/v1/custom/manifests", "main"),
    "https://raw.githubusercontent.com/acme/dev-kit/v1/custom/manifests",
  );
});

test("ensureLocalManifests can refresh defaults from a custom source", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    const name = String(input).split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "utils.json": JSON.stringify({ version: 1, items: [] }),
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-custom-defaults-"));
    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith("skills.json")));
    assert.ok(requestedUrls.every((url) => url.startsWith("https://raw.githubusercontent.com/acme/dev-kit/main/afk/manifests/")));
    assert.ok(requestedUrls.some((url) => url.endsWith("/rules.json")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureLocalManifests falls back to package manifests when compact manifests are missing", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes("/afk/manifests/")) {
      return new Response("missing", { status: 404 });
    }

    const name = url.split("/").pop();
    const bodies: Record<string, string> = {
      "skills.json": JSON.stringify({ version: 1, defaultSource: "", items: [] }),
      "mcps.json": JSON.stringify({ version: 1, items: [] }),
      "presets.json": JSON.stringify({ version: 1, presets: [] }),
      "rules.json": JSON.stringify({ version: 1, source: "github", url: "https://raw.githubusercontent.com/acme/dev-kit/main/rules/AGENTS.md" }),
      "utils.json": JSON.stringify({ version: 1, items: [] }),
    };

    return new Response(bodies[name ?? ""] ?? "{}", { status: 200 });
  };

  try {
    const homeDir = mkdtempSync(join(tmpdir(), "afk-fallback-defaults-"));
    const operations = await ensureLocalManifests({
      homeDir,
      repoDir: "/tmp/repo",
      rulesRef: "main",
      rulesSource: "github",
      empty: false,
      refreshDefaults: true,
      defaultsSource: "acme/dev-kit",
      dryRun: true,
    });

    assert.ok(operations.some((operation) => operation.type === "write" && operation.path.endsWith("utils.json")));
    assert.ok(requestedUrls.some((url) => url.includes("/afk/manifests/skills.json")));
    assert.ok(requestedUrls.some((url) => url.includes("/packages/afk/manifests/skills.json")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
