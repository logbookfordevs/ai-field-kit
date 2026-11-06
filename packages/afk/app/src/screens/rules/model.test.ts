import { expect, it } from "vitest";
import { addReference, applyServerState, diffRows, emptyDrafts, hasEdits, mentions, refPathError, renameReference, textFromDestination } from "@/screens/rules/model";

const state = (files: { path: string; content: string }[]) => ({ folder: "/h/.afk", canonicalExists: true, files, filesHash: "h1", destinations: [], errors: [] });

const loaded = () => applyServerState(emptyDrafts(), state([{ path: "AGENTS.md", content: "# Rules\n\nSee {{testing.md}}" }, { path: "references/testing.md", content: "# Testing" }]));

it("keeps unsaved edits when the saved files are read again, and takes the new files when forced", () => {
  const edited = { ...loaded(), files: loaded().files.map(file => file.path === "AGENTS.md" ? { ...file, draft: "mine" } : file) };
  const fresh = state([{ path: "AGENTS.md", content: "changed on disk" }]);

  const kept = applyServerState(edited, fresh);
  expect(kept.files.find(file => file.path === "AGENTS.md")?.draft).toBe("mine");
  expect(hasEdits(kept)).toBe(true);

  const forced = applyServerState(edited, fresh, true);
  expect(forced.files.find(file => file.path === "AGENTS.md")?.draft).toBe("changed on disk");
  expect(hasEdits(forced)).toBe(false);
});

it("rejects reference paths that are not relative Markdown, or already exist", () => {
  const drafts = loaded();
  expect(refPathError(drafts, "notes.txt")).toMatch(/relative Markdown path/);
  expect(refPathError(drafts, "../escape.md")).toMatch(/relative Markdown path/);
  expect(refPathError(drafts, "testing.md")).toBe("A reference with this path already exists.");
  expect(refPathError(drafts, "testing.md", "references/testing.md")).toBe("");
  expect(refPathError(drafts, "frontend/forms.md")).toBe("");
});

it("adds a reference as an unsaved draft and links it from AGENTS.md when asked", () => {
  const next = addReference(loaded(), { path: "frontend/forms.md", body: "", link: true });

  const added = next.files.find(file => file.path === "references/frontend/forms.md");
  expect(added).toEqual({ path: "references/frontend/forms.md", saved: null, draft: "# Forms\n\n" });
  expect(next.files.find(file => file.path === "AGENTS.md")?.draft).toBe("# Rules\n\nSee {{testing.md}}\n- Forms: {{frontend/forms.md}}");
  expect(next.current).toBe("references/frontend/forms.md");
});

it("renames a reference and updates its mentions in AGENTS.md only when asked", () => {
  const drafts = loaded();
  expect(mentions(drafts, "references/testing.md")).toBe(1);

  const relinked = renameReference(drafts, "references/testing.md", "qa.md", true);
  expect(relinked.files.map(file => file.path)).toEqual(["AGENTS.md", "references/qa.md"]);
  expect(relinked.files[0]?.draft).toBe("# Rules\n\nSee {{qa.md}}");

  const left = renameReference(drafts, "references/testing.md", "qa.md", false);
  expect(left.files[0]?.draft).toBe("# Rules\n\nSee {{testing.md}}");
});

it("folds long unchanged runs and marks what was added and removed", () => {
  const before = ["a", "b", "c", "d", "e", "f", "g", "h", "old", "z"].join("\n");
  const after = ["a", "b", "c", "d", "e", "f", "g", "h", "new", "z"].join("\n");

  expect(diffRows(before, after)).toEqual([
    { kind: "same", text: "a" }, { kind: "same", text: "b" }, { kind: "fold", text: "4 unchanged lines" }, { kind: "same", text: "g" }, { kind: "same", text: "h" },
    { kind: "del", text: "old" }, { kind: "add", text: "new" }, { kind: "same", text: "z" },
  ]);
});

it("drops AFK's markers when copying rules from a destination", () => {
  const text = ["# Mine", "<!-- AFK:RULES:START -->", "<!-- Managed by AFK. Edit in the AFK folder. -->", "body", "<!-- AFK:RULES:END -->"].join("\n");
  expect(textFromDestination(text)).toBe("# Mine\nbody");
});
