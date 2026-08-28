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
      items: Array<{ id: string; invocation: "auto" | "manual" | "source" }>;
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

    expect(catalog.items.find(({ id }) => id === "afk-compass")?.invocation).toBe("manual");
    expect(skill["disable-model-invocation"]).toBe(true);
    expect(openAi.policy?.allow_implicit_invocation).toBe(false);
  });

  test("keeps every other user-invoked catalog skill reachable through Compass", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
    const catalog = JSON.parse(
      readFileSync(resolve(repositoryRoot, "packages/afk/catalog/skills.json"), "utf8"),
    ) as {
      items: Array<{ id: string; invocation: "auto" | "manual" | "source" }>;
    };
    const compass = readFileSync(
      resolve(repositoryRoot, "skills/afk-compass/SKILL.md"),
      "utf8",
    );
    const missingRoutes = catalog.items
      .filter(({ id, invocation }) => id !== "afk-compass" && invocation === "manual")
      .filter(({ id }) => !compass.includes(`\`${id}\``))
      .map(({ id }) => id);

    expect(missingRoutes).toEqual([]);
  });

  test("keeps prototype instruments outside Design Grill's primary composition", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
    const catalog = JSON.parse(
      readFileSync(resolve(repositoryRoot, "packages/afk/catalog/skills.json"), "utf8"),
    ) as {
      items: Array<{ id: string; default: boolean; invocation: string; role: string; composes: string[] }>;
    };
    const tools = JSON.parse(
      readFileSync(resolve(repositoryRoot, "packages/afk/catalog/tools.json"), "utf8"),
    ) as { items: Array<{ id: string }> };
    const designGrill = catalog.items.find(({ id }) => id === "afk-design-grill");

    expect(designGrill).toMatchObject({
      invocation: "manual",
      role: "wrapper",
      composes: [
        "grilling",
        "truss-evaluation",
        "impeccable",
      ],
    });

    expect(catalog.items.find(({ id }) => id === "impeccable")).toMatchObject({
      default: true,
      invocation: "auto",
      role: "router",
    });
    expect(tools.items.some(({ id }) => id === "impeccable")).toBe(false);

    expect(catalog.items.find(({ id }) => id === "html-wireframe")?.invocation).toBe("manual");
    expect(catalog.items.find(({ id }) => id === "html-prototype")?.invocation).toBe("manual");

    const designGrillSkill = readFileSync(
      resolve(repositoryRoot, "skills/afk-design-grill/SKILL.md"),
      "utf8",
    );
    expect(designGrillSkill).not.toContain("html-wireframe");
    expect(designGrillSkill).not.toContain("html-prototype");
    expect(designGrillSkill).not.toContain("`prototype`");
    expect(designGrillSkill).not.toContain("image-to-code");
    expect(designGrillSkill).not.toContain("afk-animated-driven-frontend");
  });

  test("makes Code Review Verdicts preserve review findings before appending verdicts", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
    const skill = readFileSync(
      resolve(repositoryRoot, "skills/afk-code-review-verdicts/SKILL.md"),
      "utf8",
    );
    const runReview = "Run the `afk-code-review` skill to completion and capture its complete output.";
    const preserveFindings = "Present that complete output verbatim, preserving its axes and finding order.";
    const appendVerdicts = "Then append `## Verified verdicts`.";
    const validateFindings = "Treat those returned findings as unverified review input.";

    expect(skill).toContain(runReview);
    expect(skill).toContain(preserveFindings);
    expect(skill).toContain(appendVerdicts);
    expect(skill).toContain(validateFindings);
    expect(skill.indexOf(runReview)).toBeLessThan(skill.indexOf(preserveFindings));
    expect(skill.indexOf(preserveFindings)).toBeLessThan(skill.indexOf(appendVerdicts));
    expect(skill.indexOf(appendVerdicts)).toBeLessThan(skill.indexOf(validateFindings));
  });
});
