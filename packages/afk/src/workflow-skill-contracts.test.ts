import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function readRepositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("AFK workflow skill contracts", () => {
  test("tickets agree on a public TDD seam without prescribing Plannotator", () => {
    const skill = readRepositoryFile("skills/afk-to-tickets/SKILL.md");
    const templates = readRepositoryFile("skills/afk-to-tickets/references/ticket-templates.md");

    expect(templates).toContain("Test Seam");
    expect(`${skill}\n${templates}`.toLowerCase()).not.toContain("plannotator");
  });

  test("local and remote tickets route authoritative source material", () => {
    const skill = readRepositoryFile("skills/afk-to-tickets/SKILL.md");
    const templates = readRepositoryFile("skills/afk-to-tickets/references/ticket-templates.md");
    const localTemplate = templates.split("<local-ticket-template>")[1]?.split("</local-ticket-template>")[0];
    const issueTemplate = templates.split("<issue-template>")[1]?.split("</issue-template>")[0];

    expect(skill).toContain("Every ticket derived from source artifacts must include a compact `Source` reference");
    expect(skill).toContain("named sections, quoted headings, line ranges, or a combination");
    expect(skill).toContain("most stable and precise reference");
    expect(skill).toContain("Inline a small, decision-critical contract when");
    expect(skill).toContain("approved prototypes or design references");
    expect(skill).toContain("frames, states, or flows");
    expect(skill).toContain("read [ticket-templates.md](references/ticket-templates.md) completely");
    expect(skill).not.toContain("<local-ticket-template>");
    expect(skill).not.toContain("<issue-template>");
    expect(templates).toContain("Avoid prescribing implementation file paths");
    expect(localTemplate).toContain("\nsource:");
    expect(localTemplate).not.toContain("**Source:**");
    expect(localTemplate).not.toContain("## Source Material");
    expect(localTemplate).not.toContain("## Authoritative Decisions");
    expect(issueTemplate).toContain("**Source:**");
    expect(issueTemplate).not.toContain("## Source Material");
    expect(issueTemplate).not.toContain("## Authoritative Decisions");
    expect(readRepositoryFile("skills/afk-implement-tickets/SKILL.md")).toContain(
      "source: <artifact-or-issue-reference>",
    );
  });

  test("implementation owns atomic local commits without assuming local tracking commit permission", () => {
    const skill = readRepositoryFile("skills/afk-implement-tickets/SKILL.md");
    const reviewGuide = readRepositoryFile("skills/afk-implement-tickets/references/review-guides.md");

    expect(skill).toContain("review_base");
    expect(skill).toContain("## Green Atomic Commits");
    expect(skill).toContain("Commit each green behavior slice");
    expect(skill).toContain("ticket-owned implementation");
    expect(skill).toContain(
      "outside agent-created commits unless the user or repository convention explicitly opts them in",
    );
    expect(skill).toContain("afk-code-review");
    expect(skill).toContain("awaiting_acceptance");
    expect(skill).toContain("compact receipt");
    expect(skill).toContain("complete review output");
    expect(skill).toContain("Preserve the automatic review under `## Code Review Findings`");
    expect(skill).not.toContain("Round N");
    expect(skill).not.toContain("every review round");
    expect(skill).toContain("revalidate");
    expect(skill).toContain("This authorizes forward local commits.");
    expect(skill).toContain("History rewrites and remote or public actions still require approval.");
    expect(skill).toContain("If local commits are unavailable, ask.");
    expect(skill).toContain("judge each finding against the code and its cited source");
    expect(skill).toContain("fix warranted findings");
    expect(skill).toContain("record evidence for dismissals");
    expect(skill).toContain("run `afk-code-review` once automatically from `review_base`");
    expect(skill).toContain("Do not rerun it automatically");
    expect(skill).toContain("hand the gate to the user");
    expect(skill).toContain("fixes or later changes require another review");
    expect(skill).toContain("only the user's explicit acceptance");
    expect(skill).toContain("Plannotator Review");
    expect(skill).toContain("sets `accepted`");
    expect(skill).toContain("review_gate: pending");
    expect(skill).not.toContain("review_gates:");
    expect(skill).not.toContain("code gate");
    expect(skill).not.toContain("Allowed review gates are `code`, `design`, and `product`");
    expect(reviewGuide).toContain("accepting a checkpoint requires visual, copy, workflow, or product judgment");
    expect(skill).toContain("changes user-facing behavior, copy, or workflow");
    expect(reviewGuide).toContain("### Product Review");
    expect(reviewGuide).toContain("even when the underlying product decisions were approved earlier");
    expect(reviewGuide).toContain("### Design Review");
    expect(reviewGuide).toContain("visual fidelity to an explicit reference or approved visual direction");
    expect(reviewGuide).not.toContain("includes a `design` or `product` review gate");
    expect(skill.match(/review_base/g)).toHaveLength(3);
    expect(skill).not.toContain("A user-approved external code review");
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
    expect(reference).toContain("automatic code-review evidence");
    expect(reference).not.toContain("current code-review round");
  });

  test("code review preserves upstream fixed-point ownership", () => {
    const skill = readRepositoryFile("skills/afk-code-review/SKILL.md");

    expect(skill).toContain("fixed point the user supplies");
    expect(skill).toContain("Whatever the user said is the fixed point");
    expect(skill).not.toContain("invoking workflow");
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

  test("Animated-Driven Frontend keeps the user in the director's chair", () => {
    const skill = readRepositoryFile("skills/afk-animated-driven-frontend/SKILL.md");
    const hostMetadata = readRepositoryFile("skills/afk-animated-driven-frontend/agents/openai.yaml");
    const immersivePipeline = readRepositoryFile(
      "skills/afk-animated-driven-frontend/references/IMMERSIVE-PIPELINE.md",
    );
    const catalog = JSON.parse(
      readRepositoryFile("packages/afk/catalog/skills.json"),
    ) as { items: Array<{ id: string; role: string; composes: string[] }> };

    expect(skill).toContain("This is a specialist workflow, not an automatic site generator.");
    expect(skill).toContain("Only the user's explicit approval advances a gate.");
    expect(skill).toContain("resume at the first unapproved gate");
    expect(skill).toContain("**Greenlight — tracer:**");
    expect(skill).toContain("Expand into the page only after the user explicitly opens production.");
    expect(skill).toContain("Only the user can declare **picture lock**");
    expect(skill).toContain("**Greenlight — final cut:**");
    expect(immersivePipeline).toContain("ZERO: The Engineering Behind a Defiant Interactive Narrative");
    expect(hostMetadata).toContain("Co-direct this cinematic frontend with me.");
    expect(hostMetadata).toContain("stop for my greenlight");
    expect(catalog.items.find(({ id }) => id === "afk-animated-driven-frontend")).toMatchObject({
      role: "workflow",
      composes: [],
    });
  });
});
