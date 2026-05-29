import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { applyOperation } from "./fs-utils.js";
import { localManifestDir } from "./manifest.js";
import { planSkillInvocationPolicy, upsertFrontmatterBoolean, upsertOpenAiImplicitInvocation } from "./skills.js";

test("upsertFrontmatterBoolean adds Claude manual invocation metadata", () => {
  const markdown = "---\nname: demo\n---\n\n# Demo\n";
  assert.equal(
    upsertFrontmatterBoolean(markdown, "disable-model-invocation", true),
    "---\nname: demo\ndisable-model-invocation: true\n---\n\n# Demo\n",
  );
});

test("upsertFrontmatterBoolean updates existing Claude invocation metadata", () => {
  const markdown = "---\nname: demo\ndisable-model-invocation: false\n---\n\n# Demo\n";
  assert.equal(
    upsertFrontmatterBoolean(markdown, "disable-model-invocation", true),
    "---\nname: demo\ndisable-model-invocation: true\n---\n\n# Demo\n",
  );
});

test("upsertOpenAiImplicitInvocation adds OpenAI manual invocation policy", () => {
  const yaml = "interface:\n  display_name: Demo\n";
  assert.equal(
    upsertOpenAiImplicitInvocation(yaml, false),
    "interface:\n  display_name: Demo\npolicy:\n  allow_implicit_invocation: false\n",
  );
});

test("planSkillInvocationPolicy updates installed manual skills", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-policy-"));
  const homeDir = join(root, "home");
  const skillDir = join(homeDir, ".agents", "skills", "manual-skill");
  mkdirSync(join(skillDir, "agents"), { recursive: true });
  mkdirSync(localManifestDir(homeDir), { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: manual-skill\n---\n\n# Manual\n");
  writeFileSync(join(skillDir, "agents", "openai.yaml"), "display_name: Manual\n");
  writeFileSync(join(localManifestDir(homeDir), "skills.json"), JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "manual-skill",
        label: "Manual Skill",
        source: "https://github.com/example/skills",
        args: ["--skill", "manual-skill"],
        default: true,
        autoInvocation: false,
      },
    ],
  }));

  const operations = planSkillInvocationPolicy({
    homeDir,
    cwd: join(root, "project"),
    setupScope: "global",
    selectedSkillIds: ["manual-skill"],
  });
  for (const operation of operations) {
    applyOperation(operation);
  }

  assert.match(readFileSync(join(skillDir, "SKILL.md"), "utf8"), /disable-model-invocation: true/);
  assert.match(readFileSync(join(skillDir, "agents", "openai.yaml"), "utf8"), /allow_implicit_invocation: false/);
});
