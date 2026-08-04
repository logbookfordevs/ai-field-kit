import assert from "node:assert/strict";
import { test } from "vitest";
import type { SkillRecord } from "./catalog.js";
import {
  createInvocationPolicyEditorState,
  invocationPolicyChanges,
  reduceInvocationPolicyEditor,
  visibleInvocationPolicyItems,
} from "./invocation-policy-editor.js";

test("invocation policy editor drafts filtered keyboard changes before submit", () => {
  const alpha = skillRecord("alpha", "disabled");
  const beta = skillRecord("beta", "enabled");
  let state = createInvocationPolicyEditorState([alpha, beta]);

  state = reduceInvocationPolicyEditor(state, { type: "move", offset: 1 });
  state = reduceInvocationPolicyEditor(state, { type: "set-policy", policy: "manual" });
  state = reduceInvocationPolicyEditor(state, { type: "filter", query: "alpha" });
  state = reduceInvocationPolicyEditor(state, { type: "set-policy", policy: "auto" });

  assert.deepEqual(visibleInvocationPolicyItems(state).map(({ record }) => record.folder), ["alpha"]);
  assert.deepEqual(invocationPolicyChanges(state).map(({ record, allowInvocation }) => ({
    folder: record.folder,
    allowInvocation,
  })), [
    { folder: "alpha", allowInvocation: true },
    { folder: "beta", allowInvocation: false },
  ]);
});

test("invocation policy editor preserves mixed and default states until changed", () => {
  const mixed = skillRecord("mixed", "mixed");
  const inherited = skillRecord("inherited", "default");
  let state = createInvocationPolicyEditorState([mixed, inherited]);

  assert.deepEqual(invocationPolicyChanges(state), []);

  state = reduceInvocationPolicyEditor(state, { type: "set-policy", policy: "manual" });
  state = reduceInvocationPolicyEditor(state, { type: "move", offset: 1 });
  state = reduceInvocationPolicyEditor(state, { type: "set-policy", policy: "auto" });

  assert.deepEqual(invocationPolicyChanges(state).map(({ record, allowInvocation }) => ({
    folder: record.folder,
    allowInvocation,
  })), [
    { folder: "mixed", allowInvocation: false },
    { folder: "inherited", allowInvocation: true },
  ]);
});

test("invocation policy editor discards every drafted policy on cancel", () => {
  const alpha = skillRecord("alpha", "enabled");
  let state = createInvocationPolicyEditorState([alpha]);

  state = reduceInvocationPolicyEditor(state, { type: "set-policy", policy: "manual" });
  assert.equal(invocationPolicyChanges(state).length, 1);

  state = reduceInvocationPolicyEditor(state, { type: "cancel" });

  assert.equal(state.items[0]?.draftPolicy, "auto");
  assert.deepEqual(invocationPolicyChanges(state), []);
});

function skillRecord(folder: string, autoInvocation: SkillRecord["autoInvocation"]): SkillRecord {
  return {
    folder,
    name: folder,
    originalName: folder,
    description: `${folder} description`,
    rootLabel: "Global Library",
    rootPath: "/tmp/skills",
    skillFilePath: `/tmp/skills/${folder}/SKILL.md`,
    storage: "active",
    rootKind: "global-library",
    readOnly: false,
    agent: undefined,
    category: undefined,
    categoryId: undefined,
    catalogOrigin: "native",
    tags: [],
    autoInvocation,
    autoInvocationSources: [],
    autoInvocationDetails: [],
  };
}
