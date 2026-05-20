import assert from "node:assert/strict";
import test from "node:test";
import { addMcpAgentNames, normalizeAgentId } from "./agents.js";

test("normalizeAgentId maps legacy Gemini names to Antigravity", () => {
  assert.equal(normalizeAgentId("antigravity"), "antigravity");
  assert.equal(normalizeAgentId("agy"), "antigravity");
  assert.equal(normalizeAgentId("gemini"), "antigravity");
});

test("addMcpAgentNames uses the Antigravity add-mcp target", () => {
  assert.equal(addMcpAgentNames.antigravity, "antigravity");
});
