import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";

describe("source skill invocation policy", () => {
  test("keeps AFK Compass user-invoked across catalog and host metadata", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
    const catalog = JSON.parse(
      readFileSync(resolve(repositoryRoot, "packages/afk/catalog/skills.json"), "utf8"),
    ) as {
      items: Array<{ id: string; autoInvocation: boolean }>;
    };
    const skillSource = readFileSync(
      resolve(repositoryRoot, "skills/afk-compass/SKILL.md"),
      "utf8",
    );
    const skillFrontmatter = skillSource.match(/^---\n([\s\S]*?)\n---/)?.[1];
    expect(skillFrontmatter).toBeDefined();
    const skill = parse(skillFrontmatter ?? "") as { "disable-model-invocation"?: boolean };
    const openAi = parse(
      readFileSync(resolve(repositoryRoot, "skills/afk-compass/agents/openai.yaml"), "utf8"),
    ) as { policy?: { allow_implicit_invocation?: boolean } };

    expect(catalog.items.find(({ id }) => id === "afk-compass")?.autoInvocation).toBe(false);
    expect(skill["disable-model-invocation"]).toBe(true);
    expect(openAi.policy?.allow_implicit_invocation).toBe(false);
  });

  test("keeps every other user-invoked catalog skill reachable through Compass", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
    const catalog = JSON.parse(
      readFileSync(resolve(repositoryRoot, "packages/afk/catalog/skills.json"), "utf8"),
    ) as {
      items: Array<{ id: string; autoInvocation: boolean }>;
    };
    const compass = readFileSync(
      resolve(repositoryRoot, "skills/afk-compass/SKILL.md"),
      "utf8",
    );
    const missingRoutes = catalog.items
      .filter(({ id, autoInvocation }) => id !== "afk-compass" && !autoInvocation)
      .filter(({ id }) => !compass.includes(`\`${id}\``))
      .map(({ id }) => id);

    expect(missingRoutes).toEqual([]);
  });

  test("makes Code Review Check produce findings before validating them", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
    const skill = readFileSync(
      resolve(repositoryRoot, "skills/afk-code-review-check/SKILL.md"),
      "utf8",
    );
    const runReview = "Run the `afk-code-review` skill to completion and capture its findings.";
    const validateFindings = "Treat those returned findings as unverified review input.";

    expect(skill).toContain(runReview);
    expect(skill).toContain(validateFindings);
    expect(skill.indexOf(runReview)).toBeLessThan(skill.indexOf(validateFindings));
  });
});
