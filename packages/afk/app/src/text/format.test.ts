import { expect, it } from "vitest";
import { ago, isRepositorySource, plural, shortSource, UPLOADED_SOURCE } from "@/text/format";

const now = new Date(2026, 10, 5, 12, 0).getTime();

it("says how long ago in the same words on every screen", () => {
  expect(ago(now - 20_000, now)).toBe("just now");
  expect(ago(now - 2 * 60_000, now)).toBe("2 min ago");
  expect(ago(now - 60 * 60_000, now)).toBe("1 hour ago");
  expect(ago(now - 3 * 60 * 60_000, now)).toBe("3 hours ago");
});

it("shortens a repository the way people write it, wherever it is shown", () => {
  expect(shortSource("https://github.com/leo/afk-library.git")).toBe("leo/afk-library");
  expect(shortSource("https://www.github.com/leo/skills/")).toBe("leo/skills");
  expect(shortSource("git@github.com:leo/afk-library.git")).toBe("leo/afk-library");
  expect(shortSource("git@gitlab.example.com:team/library.git")).toBe("gitlab.example.com/team/library");
  expect(shortSource("https://gitlab.example.com/team/library")).toBe("gitlab.example.com/team/library");
  expect(shortSource("/Users/ana/backups/library.git")).toBe("/Users/ana/backups/library");
  expect(shortSource("leo/skills")).toBe("leo/skills");
});

it("tells repositories apart from uploads and local paths", () => {
  expect(isRepositorySource("leo/skills")).toBe(true);
  expect(isRepositorySource(UPLOADED_SOURCE)).toBe(false);
  expect(isRepositorySource("~/skills/wizard")).toBe(false);
  expect(isRepositorySource("file:///tmp/skills")).toBe(false);
  expect(isRepositorySource(undefined)).toBe(false);
});

it("counts with the right noun", () => {
  expect(plural(1, "skill")).toBe("1 skill");
  expect(plural(4, "skill")).toBe("4 skills");
  expect(plural(2, "copy", "copies")).toBe("2 copies");
});
