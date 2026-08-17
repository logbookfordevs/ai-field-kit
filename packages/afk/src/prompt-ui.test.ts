import assert from "node:assert/strict";
import { test } from "vitest";
import { renderSkillProfileReview } from "./prompt-ui.js";

test("profile review groups dynamic skill IDs into width-safe static lines", () => {
  const text = renderSkillProfileReview({
    profileNames: ["Stitch"],
    availableIds: ["code-simplification", "design-artifact", "diagnosing-bugs", "grilling", "truss-evaluation", "design-md", "enhance-prompt", "stitch-loop"],
    unavailableIds: ["react-components", "stitch-remotion"],
  }, 56);

  assert.equal(text, [
    "◆ Profile readiness",
    "",
    "Profiles",
    "  Stitch",
    "",
    "Ready to install (8)",
    "  code-simplification, design-artifact,",
    "  diagnosing-bugs, grilling, truss-evaluation,",
    "  design-md, enhance-prompt, stitch-loop",
    "",
    "Not included (2)",
    "  react-components, stitch-remotion",
  ].join("\n"));
  assert.ok(text.split("\n").every((line) => line.length <= 56));

  const wideTerminalText = renderSkillProfileReview({
    profileNames: ["Stitch"],
    availableIds: ["code-simplification", "design-artifact", "diagnosing-bugs", "grilling", "truss-evaluation", "design-md", "enhance-prompt", "stitch-loop"],
    unavailableIds: ["react-components", "stitch-remotion"],
  }, 220);
  assert.ok(wideTerminalText.split("\n").every((line) => line.length <= 78));

  const narrowTerminalText = renderSkillProfileReview({
    profileNames: ["Stitch"],
    availableIds: ["extraordinarily-long-profile-skill-identifier", "design-md"],
    unavailableIds: ["stitch-remotion"],
  }, 30);
  assert.ok(narrowTerminalText.split("\n").every((line) => line.length <= 30));
  assert.ok(narrowTerminalText.includes("  extraordinarily-long-profi"));
  assert.ok(narrowTerminalText.includes("  le-skill-identifier,"));
});
