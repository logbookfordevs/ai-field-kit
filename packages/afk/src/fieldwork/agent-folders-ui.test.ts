import { existsSync, readFileSync } from "node:fs";
import { createContext, runInContext, type Context } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";
import { AGENT_TABLE } from "./agent-table.js";

const script = readFileSync(new URL("../../web/agent-folders.js", import.meta.url), "utf8");

let context: Context;
let requests: { path: string; data: unknown }[];
let body: { innerHTML: string };
let toasts: string[];

function evaluate<T>(code: string): T { return runInContext(code, context) as T; }

const folder = (overrides: Record<string, unknown>) => ({ path: "~/.cursor/skills", names: ["Cursor"], project: ".agents/skills", icon: "cursor.png", detected: true, enabled: false, shared: false, custom: false, mechanisms: {}, ...overrides });

const fixture = {
  library: true,
  invocationAgents: { claude: ["Claude Code", "Pi"], codex: ["Codex"] },
  folders: [
    folder({ path: "~/.agents/skills", names: ["Codex", "Cline", "Warp", "Zed"], icon: "codex.svg", enabled: true, shared: true, detected: false }),
    folder({ path: "~/.claude/skills", names: ["Claude Code"], icon: "claude_code.svg", project: ".claude/skills", enabled: true }),
    folder({}),
    folder({ path: "~/.gemini/skills", names: ["Gemini CLI"], icon: "gemini_cli.svg", detected: false }),
    folder({ path: "~/.team/skills", names: ["Team agent"], icon: undefined, enabled: true, custom: true, detected: false, project: ".team/skills" }),
  ],
};

beforeEach(() => {
  requests = []; toasts = []; body = { innerHTML: "" };
  context = createContext({
    $: (id: string) => id === "agentFoldersBody" ? body : { value: "", textContent: "" },
    esc: (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
    button: (label: string, action: string, _class = "", attrs = "") => `<button data-action="${action.replaceAll('"', "&quot;")}" ${attrs}>${label}</button>`,
    modal: () => {}, closeModal: () => {}, toast: (message: string) => toasts.push(message),
    request: async (path: string, data: unknown) => { requests.push({ path, data }); return fixture; },
  });
  runInContext(script, context);
  context.fixture = fixture;
  evaluate("agentFolderInfo=fixture");
});

describe("the Agent folders settings", () => {
  it("shows the shared folder as always on, with the agents that read it and no switch", () => {
    evaluate("renderAgentFolders()");

    expect(body.innerHTML).toContain("~/.agents/skills");
    expect(body.innerHTML).toContain("Read by Codex, Cline, Warp, Zed");
    expect(body.innerHTML).toContain("Always on");
    expect(body.innerHTML.match(/role="switch"/g)).toHaveLength(3);
  });

  it("shows each agent's icon, and a lettered placeholder for a custom folder", () => {
    evaluate("renderAgentFolders()");

    expect(body.innerHTML).toContain('src="/assets/agent-icons/claude_code.svg"');
    expect(body.innerHTML).toContain('src="/assets/agent-icons/cursor.png"');
    expect(body.innerHTML).toMatch(/agent-icon-letter[^>]*>T</);
  });

  it("lists detected agents with switches and keeps the others behind a control", () => {
    evaluate("renderAgentFolders()");
    expect(body.innerHTML).toContain("Detected on this machine");
    expect(body.innerHTML).not.toContain("Gemini CLI");

    evaluate("showAllAgentFolders=true;renderAgentFolders()");
    expect(body.innerHTML).toContain("Gemini CLI");
  });

  it("turns a folder on and off through the operations", async () => {
    await evaluate("setAgentFolder('~/.cursor/skills', true)");
    await evaluate("setAgentFolder('~/.claude/skills', false)");

    expect(requests).toEqual([
      { path: "agent-folders/enable", data: { path: "~/.cursor/skills" } },
      { path: "agent-folders/disable", data: { path: "~/.claude/skills" } },
    ]);
  });

  it("removes only custom folders from the list", () => {
    evaluate("renderAgentFolders()");
    const removals = body.innerHTML.match(/removeAgentFolder/g) ?? [];

    expect(removals).toHaveLength(1);
    expect(body.innerHTML).toContain("~/.team/skills");
  });

  it("asks for a library when none exists yet", () => {
    evaluate("agentFolderInfo={library:false,folders:[],invocationAgents:{claude:[],codex:[]}};renderAgentFolders()");
    expect(body.innerHTML).toContain("afk library init");
  });
});

describe("the invocation tooltip", () => {
  it("lists the agents that follow each mechanism, where the table knows", () => {
    const hint = evaluate<string>("invocationMechanismHint()");

    expect(hint).toContain("Claude Code, Pi");
    expect(hint).toContain("Codex");
  });

  it("says nothing when no agent is known to follow a mechanism", () => {
    evaluate("agentFolderInfo={library:true,folders:[],invocationAgents:{claude:[],codex:[]}}");
    expect(evaluate<string>("invocationMechanismHint()")).toBe("");
  });
});

describe("agent icons", () => {
  it("ships every icon the table names, with the MIT notice", () => {
    const icons = AGENT_TABLE.flatMap(entry => entry.icon ? [entry.icon] : []);

    expect(icons.length).toBeGreaterThan(40);
    for (const icon of icons) expect(existsSync(new URL(`../../web/assets/agent-icons/${icon}`, import.meta.url)), icon).toBe(true);
    const notice = readFileSync(new URL("../../web/assets/agent-icons/LICENSE-skills-manager.txt", import.meta.url), "utf8");
    expect(notice).toContain("MIT License");
    expect(notice).toContain("skills-manager");
  });
});
