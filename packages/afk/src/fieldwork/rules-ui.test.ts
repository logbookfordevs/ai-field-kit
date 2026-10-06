import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it, vi } from "vitest";

const script = readFileSync(new URL("../../web/rules.js", import.meta.url), "utf8");

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<unknown>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function element(textContent = "") {
  return { isConnected: true, textContent, disabled: false, hidden: true, focus: vi.fn() };
}

function reviewFixture(operation: "adopt" | "overwrite") {
  const response = deferred();
  const original = {
    sheetTitle: element(),
    body: element(),
    ruleActionError: element(),
    replaceRuleRegion: element(),
    adoptRuleRegion: element(),
    conflictReviewAgain: element(),
  };
  let nodes = new Map(Object.entries(original));
  const dialog = {
    open: true,
    querySelector: () => nodes.get("body"),
    addEventListener: vi.fn(),
  };
  const navigate = vi.fn(), render = vi.fn(), toast = vi.fn();
  const request = vi.fn((path: string) => {
    if (path === `rules/${operation}`) return response.promise;
    if (path === "rules/state") return Promise.resolve({
      folder: "/workspace",
      canonicalExists: true,
      files: [{ path: "AGENTS.md", content: "Saved rules" }],
      filesHash: "latest-state",
      destinations: [{ id: "codex", status: "current", reason: "Latest destination state" }],
      errors: [],
    });
    throw new Error(`Unexpected API request: ${path}`);
  });
  const context = createContext({
    $: (id: string) => id === "sheet" ? dialog : nodes.get(id),
    navigator: { platform: "MacIntel" },
    document: { addEventListener: vi.fn() },
    window: { addEventListener: vi.fn(), reviewedRuleRegion: "reviewed-region", reviewedRulePreview: { targets: [] } },
    section: "Settings",
    request, navigate, render, toast,
    closeModal: () => { dialog.open = false; },
    console: { error: vi.fn() },
  });
  runInContext(script, context);
  runInContext(`
    afkFolder = '/workspace';
    rulesLoaded = true;
    rules.files = [{path: 'AGENTS.md', saved: 'Saved rules', draft: 'Unsaved draft'}];
    savedRuleSnapshot = JSON.stringify([{path: 'AGENTS.md', content: 'Saved rules'}]);
  `, context);

  return {
    response, request, navigate, render, toast, dialog,
    start: () => runInContext(`${operation === "adopt" ? "adoptExternal" : "overwriteRegion"}('codex')`, context) as Promise<void>,
    leaveReview: (opensNewForm: boolean) => {
      dialog.open = false;
      if (!opensNewForm) return undefined;
      for (const node of Object.values(original)) node.isConnected = false;
      const newForm = { sheetTitle: element("New form"), body: element("Entered values"), ruleActionError: element("Existing feedback") };
      nodes = new Map(Object.entries(newForm));
      dialog.open = true;
      return newForm;
    },
    state: () => runInContext("({draft: rules.files[0].draft, stash: rules.stash, current: rules.current, dests, busy: rulesBusy})", context) as {
      draft: string;
      stash: unknown;
      current: string;
      dests: { id: string; status: string }[];
      busy: boolean;
    },
  };
}

it.each([
  ["adopt", "success", true],
  ["adopt", "failure", true],
  ["overwrite", "success", true],
  ["overwrite", "failure", true],
  ["adopt", "success", false],
  ["adopt", "failure", false],
  ["overwrite", "success", false],
  ["overwrite", "failure", false],
] as const)("keeps a dismissed review isolated after delayed %s %s (new form: %s)", async (operation, outcome, opensNewForm) => {
  const fixture = reviewFixture(operation);
  const pending = fixture.start();
  const newForm = fixture.leaveReview(opensNewForm);
  if (outcome === "failure") fixture.response.reject(new Error("Request failed"));
  else fixture.response.resolve(operation === "adopt" ? { content: "Destination rules" } : { preview: { targets: [{ id: "codex", status: "current" }] } });

  await expect(pending).resolves.toBeUndefined();
  expect(fixture.dialog.open).toBe(opensNewForm);
  if (newForm) {
    expect(newForm.sheetTitle.textContent).toBe("New form");
    expect(newForm.body.textContent).toBe("Entered values");
    expect(newForm.ruleActionError.textContent).toBe("Existing feedback");
  }
  expect(fixture.navigate).not.toHaveBeenCalled();
  expect(fixture.render).not.toHaveBeenCalled();
  expect(fixture.state()).toMatchObject({ draft: "Unsaved draft", stash: null, current: "AGENTS.md", busy: false });
  expect(fixture.toast).toHaveBeenCalled();
  if (operation === "overwrite" && outcome === "success") {
    expect(fixture.request).toHaveBeenCalledWith("rules/state");
    expect(fixture.state().dests).toEqual([expect.objectContaining({ id: "codex", status: "current" })]);
  }
});
