import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, vi } from "vitest";
import { inferId, inferLabel, runManifestConfigure } from "./manifest-configure.js";
import type { CliOptions, Runtime } from "./types.js";

const promptState = vi.hoisted(() => ({
  checkboxAnswers: [] as string[][],
  confirmAnswers: [] as boolean[],
  inputAnswers: [] as string[],
}));

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(async () => promptState.checkboxAnswers.shift() ?? []),
  confirm: vi.fn(async () => promptState.confirmAnswers.shift() ?? true),
  input: vi.fn(async ({ default: defaultValue }: { default?: string }) => promptState.inputAnswers.shift() ?? defaultValue ?? ""),
}));

test("inferId prefers URL filename stems", () => {
  assert.equal(
    inferId("https://raw.githubusercontent.com/me/dev-kit/main/skills/review-pr.md"),
    "review-pr",
  );
});

test("inferId normalizes free-form names", () => {
  assert.equal(inferId("My Fancy Skill!!"), "my-fancy-skill");
  assert.equal(inferId("git@github.com:acme/foo-bar.git"), "foo-bar");
});

test("inferLabel creates editable title defaults", () => {
  assert.equal(inferLabel("afk-pr-story-flow-mermaid"), "AFK / PR Story Flow Mermaid");
  assert.equal(inferLabel("stitch-mcp"), "Stitch MCP");
});

test("runManifestConfigure loads default hooks from the configured defaults source", async () => {
  promptState.checkboxAnswers = [["hooks"]];
  promptState.confirmAnswers = [true];
  promptState.inputAnswers = [];

  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(
      JSON.stringify({
        version: 1,
        items: [
          {
            id: "remote-hook",
            label: "Remote Hook",
            description: "Loaded from defaults source.",
            source: "https://example.com/hooks/remote-hook.js",
            command: "node",
            args: ["${HOOK_FILE}"],
            events: ["stop"],
            agents: ["codex"],
            default: true,
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    const output: string[] = [];
    const homeDir = mkdtempSync(join(tmpdir(), "afk-manifest-configure-"));
    const code = await runManifestConfigure(fakeRuntime(output), {
      ...defaultOptions(homeDir),
      dryRun: true,
      rulesSource: "github",
      defaultsSource: "acme/dev-kit",
      defaultsSourceExplicit: true,
    });

    const text = output.join("\n");
    assert.equal(code, 0);
    assert.ok(requestedUrls.includes("https://raw.githubusercontent.com/acme/dev-kit/main/afk/manifests/hooks.json"));
    assert.ok(text.includes("remote-hook"));
    assert.ok(!text.includes("afk-execution-tracking-stop-check"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function fakeRuntime(output: string[]): Runtime {
  return {
    io: {
      stdout: (message: string) => output.push(message),
      stderr: (message: string) => output.push(message),
    },
    spawn: async () => ({ code: 0 }),
  };
}

function defaultOptions(homeDir: string): CliOptions {
  return {
    agents: [],
    setupScope: "global",
    scopeExplicit: false,
    dryRun: false,
    verbose: false,
    yes: false,
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    selectedMcpIds: [],
    selectedUtilIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "manifest",
    initOnly: false,
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    defaultsSourceExplicit: false,
    defaultSourceUpdate: "",
    manifestLocal: false,
    manifestConfigureLocal: false,
    manifestConfigureFromCurrent: false,
    selectedManifestCategories: [],
    homeDir,
    repoDir: resolve(new URL("../../..", import.meta.url).pathname),
    cwd: mkdtempSync(join(tmpdir(), "afk-manifest-configure-cwd-")),
  };
}
