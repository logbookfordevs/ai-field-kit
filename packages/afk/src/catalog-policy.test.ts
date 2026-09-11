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

  test("keeps Writing for Humans user-invoked across catalog and host metadata", () => {
    const repositoryRoot = resolve(import.meta.dirname, "../../..");
    const catalog = JSON.parse(
      readFileSync(resolve(repositoryRoot, "packages/afk/catalog/skills.json"), "utf8"),
    ) as {
      items: Array<{
        id: string;
        default: boolean;
        invocation: "auto" | "manual" | "source";
        role: string;
        composes: string[];
      }>;
    };
    const writingForHumansSource = readFileSync(
      resolve(repositoryRoot, "skills/writing-for-humans/SKILL.md"),
      "utf8",
    );
    const writingForHumansFrontmatter = writingForHumansSource.match(/^---\n([\s\S]*?)\n---/)?.[1];
    expect(writingForHumansFrontmatter).toBeDefined();
    const writingForHumans = parse(writingForHumansFrontmatter ?? "") as {
      description?: string;
      "disable-model-invocation"?: boolean;
    };
    const openAi = parse(
      readFileSync(resolve(repositoryRoot, "skills/writing-for-humans/agents/openai.yaml"), "utf8"),
    ) as { policy?: { allow_implicit_invocation?: boolean } };
    expect(catalog.items.find(({ id }) => id === "writing-for-humans")).toMatchObject({
      default: true,
      invocation: "manual",
      role: "primitive",
      composes: [],
    });
    expect(catalog.items.find(({ id }) => id === "reader-journey")).toBeUndefined();
    expect(catalog.items.find(({ id }) => id === "afk-docs-for-humans")).toBeUndefined();
    expect(writingForHumans["disable-model-invocation"]).toBe(true);
    expect(openAi.policy?.allow_implicit_invocation).toBe(false);
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
      postInstall: [{ type: "copy", agent: "codex", from: "agents", to: "agents", extension: ".toml" }],
      default: true,
      invocation: "auto",
      role: "router",
    });
    expect(tools.items.some(({ id }) => id === "impeccable")).toBe(false);

    expect(catalog.items.find(({ id }) => id === "html-wireframe")?.invocation).toBe("manual");
    expect(catalog.items.find(({ id }) => id === "html-prototype")?.invocation).toBe("manual");
  });
});
