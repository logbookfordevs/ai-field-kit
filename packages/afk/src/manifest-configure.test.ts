import assert from "node:assert/strict";
import test from "node:test";
import { inferId, inferLabel } from "./manifest-configure.js";

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
