import assert from "node:assert/strict";
import { test } from "vitest";
import { runAfkOpen } from "./open.js";
import type { Runtime } from "./types.js";

test("afk open opens the user AFK folder", async () => {
  const output: string[] = [];
  const calls: Array<{ command: string; args: string[]; cwd: string | undefined }> = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async (command, args, cwd) => {
      calls.push({ command, args, cwd });
      return { code: 0 };
    },
  };

  const code = await runAfkOpen(runtime, {
    homeDir: "/tmp/leo",
    cwd: "/tmp/project",
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, [{
    command: "open",
    args: ["/tmp/leo/.agents/afk"],
    cwd: "/tmp/project",
  }]);
  assert.equal(output.join("\n"), "Opening /tmp/leo/.agents/afk");
});

test("afk open reports opener failure", async () => {
  const errors: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: () => undefined,
      stderr: (message) => errors.push(message),
    },
    spawn: async () => ({ code: 1 }),
  };

  const code = await runAfkOpen(runtime, {
    homeDir: "/tmp/leo",
    cwd: "/tmp/project",
  });

  assert.equal(code, 1);
  assert.equal(errors.join("\n"), "Could not open /tmp/leo/.agents/afk.");
});

test("afk open uses the VS Code CLI with --code", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const runtime: Runtime = {
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
    },
    spawn: async (command, args) => {
      calls.push({ command, args });
      return { code: 0 };
    },
  };

  const code = await runAfkOpen(runtime, {
    homeDir: "/tmp/leo",
    cwd: "/tmp/project",
    afkOpenApp: "code",
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, [{ command: "code", args: ["/tmp/leo/.agents/afk"] }]);
});
