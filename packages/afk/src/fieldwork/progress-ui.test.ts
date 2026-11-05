import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";

const client = readFileSync(new URL("../../web/client.js", import.meta.url), "utf8");
const install = readFileSync(new URL("../../web/install.js", import.meta.url), "utf8");
const updateRender = client.slice(client.indexOf("function updateElapsed("), client.indexOf("async function pollSkillUpdate("));
const installRender = install.slice(install.indexOf("function installElapsed("), install.indexOf("async function applyInstallSkills"));

function element() {
  const children: Record<string, { textContent: string; open: boolean; hidden: boolean; disabled: boolean }> = {};
  const output = {
    dataset: {} as Record<string, string>, initialized: false, summaryHtml: "",
    set innerHTML(_value: string) { this.initialized = true; },
    querySelector(selector: string) {
      if (!this.initialized) return null;
      if (selector === "[data-update-summary]") return { set innerHTML(value: string) { output.summaryHtml = value; } };
      return children[selector] ??= { textContent: "", open: false, hidden: false, disabled: false };
    },
    text: (selector: string) => children[selector]?.textContent,
  };
  return output;
}

it("shows the update's phase, current item, elapsed time and last output line", () => {
  const output = element();
  const context = createContext({ scope: "Global", $: () => output, esc: String, Date: { now: () => 70_000 } });
  runInContext(updateRender, context);
  context.result = { scope: "Global", pending: true, cancellable: true, phase: "Updating through Skills CLI", item: "Global tracked skills", startedAt: 5_000, lastLine: "Checking sample", output: "Checking sample" };
  runInContext("renderSkillUpdate(result)", context);
  expect(output.summaryHtml).toContain("Updating through Skills CLI");
  expect(output.summaryHtml).toContain("Global tracked skills");
  expect(output.summaryHtml).toContain("1:05");
  expect(output.summaryHtml).toContain("Checking sample");
});

it("shows the install's phase, source, elapsed time and last output line, and freezes the clock when finished", () => {
  const output = element();
  const context = createContext({ $: () => output, Date: { now: () => 70_000 } });
  runInContext(installRender, context);
  context.pending = { pending: true, phase: "Installing source 1 of 2", item: "owner/repo", startedAt: 5_000, lastLine: "Cloning repository", output: "Cloning repository" };
  runInContext("renderInstallProgress(pending)", context);
  expect(output.text(".install-phase")).toBe("Installing source 1 of 2");
  expect(output.text(".install-detail")).toBe("owner/repo · 1:05");
  expect(output.text(".install-last-line")).toBe("Cloning repository");
  context.done = { pending: false, code: 0, phase: "Installation complete", startedAt: 5_000, finishedAt: 20_000, output: "Done" };
  runInContext("renderInstallProgress(done)", context);
  expect(output.text(".install-detail")).toBe("0:15");
});

it("reports the download's progress while turning on a pack that has to fetch its skills", async () => {
  const start = client.indexOf("activate=id=>"), activate = client.slice(start, client.indexOf("toggleSkill=", start));
  const toasts: string[] = [], requests: string[] = [];
  let tick: () => void = () => {};
  let finish: () => void = () => {};
  const context = createContext({
    profiles: [{ id: "p", name: "Pack", enabled: [], ready: false }], selectedTargets: {}, toast: (message: string) => toasts.push(message),
    operation: (action: () => Promise<void>) => action(),
    request: async (path: string) => { requests.push(path); if (path === "activation") await new Promise<void>(resolve => { finish = resolve; }); return path === "skills/install-state" ? { pending: true, phase: "Downloading skills for Pack", lastLine: "Cloning owner/repo" } : {}; },
    setInterval: (callback: () => void) => { tick = callback; return 1; }, clearInterval: () => {},
  });
  runInContext(activate, context);
  const running = runInContext("activate('p')", context) as Promise<void>;
  await new Promise(resolve => setTimeout(resolve, 0));
  tick();
  await new Promise(resolve => setTimeout(resolve, 0));
  finish();
  await running;

  expect(toasts.at(-1)).toBe("Downloading skills for Pack · Cloning owner/repo");
  expect(requests).toContain("skills/install-state");
});
