import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("AFK ticket workflow contracts", () => {
  test("tickets agree on a public TDD seam without prescribing Plannotator", () => {
    const skill = readRepositoryFile("skills/afk-to-tickets/SKILL.md");

    expect(skill).toContain("Test Seam");
    expect(skill.toLowerCase()).not.toContain("plannotator");
  });

  test("implementation owns atomic local commits without assuming local tracking commit permission", () => {
    const skill = readRepositoryFile("skills/afk-implement-tickets/SKILL.md");

    expect(skill).toContain("review_base");
    expect(skill).toContain("green atomic local commit");
    expect(skill).toContain("ticket-owned paths");
    expect(skill).toContain(
      "outside agent-created commits unless the user or repository convention explicitly opts them in",
    );
    expect(skill).toContain("afk-code-review");
    expect(skill).toContain("awaiting_acceptance");
    expect(skill).toContain("compact receipt");
    expect(skill).toContain("complete review output");
    expect(skill).toContain("Rewriting history and any push, PR, publish, tag, or release action");
    expect(skill).toContain("including Plannotator Review when used");
    expect(skill.match(/review_base/g)).toHaveLength(3);
    expect(skill).not.toContain("tracking_commits");
    expect(skill).not.toContain("selected tracking policy");
    expect(skill).not.toContain("repository-owned tracking");
    expect(skill).not.toContain("recommend `/plannotator-review`");
    expect(skill).not.toContain("Next action: Leonardo");
  });

  test("resumption preserves the original review range and durable gate state", () => {
    const reference = readRepositoryFile("skills/afk-implement-tickets/references/resume.md");

    expect(reference).toContain("review_base");
    expect(reference).toContain("last green atomic commit");
    expect(reference).toContain("explicit opt-in");
    expect(reference).not.toContain("tracking_commits");
    expect(reference).toContain("review-gate states");
  });

  test("code review accepts a fixed point from its invoking workflow", () => {
    const skill = readRepositoryFile("skills/afk-code-review/SKILL.md");

    expect(skill).toContain("user or invoking workflow");
    expect(skill).toContain("Ask only if no fixed point was supplied.");
    expect(skill).not.toContain("Send a single message with two sub-agent calls.");
  });

  test("Implement Tickets declares its required skill composition", () => {
    const catalog = JSON.parse(
      readRepositoryFile("packages/afk/catalog/skills.json"),
    ) as { items: Array<{ id: string; composes: string[] }> };

    expect(catalog.items.find(({ id }) => id === "afk-implement-tickets")?.composes).toEqual([
      "tdd",
      "afk-code-review",
    ]);
  });
});
