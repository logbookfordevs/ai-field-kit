import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { spawnCommand } from "./process.js";

test.skipIf(process.platform !== "win32")("spawnCommand executes Windows cmd shims without enabling a shell", async () => {
  const directory = mkdtempSync(join(tmpdir(), "afk-process-"));
  const successCommand = join(directory, "success.cmd");
  const failureCommand = join(directory, "failure.cmd");
  writeFileSync(successCommand, "@echo off\r\nexit /b 0\r\n");
  writeFileSync(failureCommand, "@echo off\r\nexit /b 7\r\n");

  assert.deepEqual(await spawnCommand(successCommand, []), { code: 0 });
  assert.deepEqual(await spawnCommand(failureCommand, []), { code: 7 });
});
