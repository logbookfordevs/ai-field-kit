import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { expect, it } from "vitest";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
const source = html.slice(html.indexOf("function invocationSummary("), html.indexOf("function preferenceHint("));

it("distinguishes effective manual, automatic, mixed and unreadable modes without replacing the accessible select", () => {
  const entries = [
    { name: "manual", invocation: { claude: "Manual only", codex: "Manual only" }, defaultInvocation: { claude: "Automatic allowed", codex: "Automatic allowed" } },
    { name: "auto", invocation: { claude: "Automatic allowed", codex: "Automatic allowed" } },
    { name: "mixed", invocation: { claude: "Manual only", codex: "Automatic allowed" } },
    { name: "unknown", invocation: { claude: "Unknown", codex: "Unknown" } },
  ];
  const context = createContext({ inventory: () => entries, scope: "Global", preferences: { "Global|manual": "Manual only" }, esc: String });
  runInContext(source, context);
  for (const [name, mode] of [["manual", "manual only"], ["auto", "automatic allowed"], ["mixed", "varies by agent"], ["unknown", "unknown"]]) {
    const result = runInContext(`preferenceSelect('${name}')`, context) as string;
    expect(result).toContain(`data-invocation-mode="${mode}"`);
    expect(result).toContain('aria-hidden="true"');
    expect(result).toContain(`aria-label="Invocation for ${name} in Global"`);
    expect(result).toContain('<select');
  }
});
