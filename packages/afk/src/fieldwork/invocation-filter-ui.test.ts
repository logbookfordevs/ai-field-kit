import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../../web/index.html", import.meta.url), "utf8");
const listScript = html.slice(html.indexOf("function renderSkillList()"), html.indexOf("function skillRow("));
const summaryScript = html.slice(html.indexOf("function invocationSummary("), html.indexOf("function preferenceSelect("));

function filter(mode: string, query = "") {
  const fields = { skillCount: { textContent: "" }, skillList: { innerHTML: "" } };
  const inventory = [
    { name: "Manual", invocation: { claude: "Manual only", codex: "Manual only" } },
    { name: "Auto", invocation: { claude: "Automatic allowed", codex: "Automatic allowed" } },
    { name: "Mixed", invocation: { claude: "Manual only", codex: "Automatic allowed" } },
    { name: "Unreadable", invocation: { claude: "Unknown", codex: "Unknown" } },
  ];
  const context = createContext({
    invocationFilter: mode, sourceFilter: "", availabilityFilter: "", query, scope: "Global", inventory: () => inventory,
    $: (id: keyof typeof fields) => fields[id], isAvailable: () => true,
    esc: String, skillRow: (skill: { name: string }) => `[${skill.name}]`,
    button: (label: string) => label,
  });
  runInContext(readFileSync(new URL("../../web/skill-insights.js", import.meta.url), "utf8") + summaryScript + listScript + "renderSkillList()", context);
  return fields;
}

describe("installed invocation filter", () => {
  it.each([
    ["manual only", "Manual"], ["automatic allowed", "Auto"],
    ["varies by agent", "Mixed"], ["unknown", "Unreadable"],
  ])("filters effective %s metadata", (mode, name) => {
    const fields = filter(mode);
    expect(fields.skillList.innerHTML).toContain(`[${name}]`);
    expect(fields.skillCount.textContent).toBe("1 of 4 shown");
  });

  it("combines mode and case-insensitive search", () => {
    expect(filter("manual only", "MAN").skillList.innerHTML).toContain("[Manual]");
    const empty = filter("manual only", "Auto");
    expect(empty.skillCount.textContent).toBe("0 of 4 shown");
    expect(empty.skillList.innerHTML).toContain("Clear filters");
  });

  it("includes all modes when the filter is cleared", () => {
    expect(filter("").skillCount.textContent).toBe("4 entries · 4 available");
  });
});
