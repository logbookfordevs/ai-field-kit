import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { isPromptExit, selectMenu } from "./menu.js";

const promptState = vi.hoisted(() => ({
  result: "alpha" as string,
  error: undefined as Error | undefined,
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(async () => {
    if (promptState.error) {
      throw promptState.error;
    }

    return promptState.result;
  }),
}));

test("selectMenu maps prompt exit to back when back is available", async () => {
  const error = new Error("User force closed the prompt with SIGINT");
  error.name = "ExitPromptError";
  promptState.error = error;

  const selected = await selectMenu({
    message: "Pick",
    choices: [{ name: "Alpha", value: "alpha" }],
    canGoBack: true,
  });

  assert.equal(selected, null);
});

test("selectMenu preserves prompt exit when back is not available", async () => {
  const error = new Error("User force closed the prompt with SIGINT");
  error.name = "ExitPromptError";
  promptState.error = error;

  await assert.rejects(
    () => selectMenu({
      message: "Pick",
      choices: [{ name: "Alpha", value: "alpha" }],
    }),
    error,
  );
});

test("isPromptExit detects Inquirer prompt exits", () => {
  const error = new Error("User force closed the prompt with SIGINT");
  error.name = "ExitPromptError";

  assert.equal(isPromptExit(error), true);
  assert.equal(isPromptExit(new Error("Different failure")), false);
});
