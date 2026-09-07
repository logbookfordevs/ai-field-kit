import assert from "node:assert/strict";
import { test } from "vitest";
import { addMcpAgentNames, agentIds, hookAgentIds, normalizeAgentId } from "./agents.js";

test("normalizeAgentId maps legacy Gemini names to Antigravity", () => {
  assert.equal(normalizeAgentId("antigravity"), "antigravity");
  assert.equal(normalizeAgentId("agy"), "antigravity");
  assert.equal(normalizeAgentId("gemini"), "antigravity");
});

test("normalizeAgentId maps Cursor aliases to local Cursor hooks", () => {
  assert.equal(normalizeAgentId("cursor"), "cursor-local");
  assert.equal(normalizeAgentId("cursor-ide"), "cursor-local");
  assert.equal(normalizeAgentId("cursor-cli"), "cursor-local");
});

test("Cursor local is only in hook agent choices", () => {
  assert.ok(!agentIds.includes("cursor-local"));
  assert.ok(hookAgentIds.includes("cursor-local"));
});

test("addMcpAgentNames uses the Antigravity add-mcp target", () => {
  assert.equal(addMcpAgentNames.antigravity, "antigravity");
});

test("Pi is available as a rules agent but not a hook target", () => {
  assert.ok(agentIds.includes("pi"));
  assert.ok(!hookAgentIds.includes("pi"));
});
