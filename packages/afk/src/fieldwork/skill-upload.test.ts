import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stageUpload, type UploadSource } from "./skill-upload.js";
import { makeZip, type ZipEntry } from "./zip.test-helper.js";

let temp: string;
let staging: string;

const skill = (name: string, body = "Body."): string => `---\nname: ${name}\ndescription: ${name} does things\n---\n${body}\n`;

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "afk-upload-"));
  staging = join(temp, "staging");
  await mkdir(staging);
});

afterEach(async () => { await rm(temp, { recursive: true, force: true }); });

const zip = (entries: ZipEntry[]): UploadSource => ({ archive: makeZip(entries) });

describe("finding skills in an upload", () => {
  it("finds each SKILL.md in a zip with its description, file count and size", async () => {
    const found = await stageUpload(zip([
      { path: "wizard/SKILL.md", data: skill("wizard"), compress: true },
      { path: "wizard/scripts/run.sh", data: "#!/bin/sh\necho hi\n", mode: 0o755 },
      { path: "wizard/assets/logo.bin", data: Buffer.from([0, 255, 1, 2, 3]) },
      { path: "scribe/SKILL.md", data: skill("scribe") },
    ]), staging);

    expect(found.map(item => item.name)).toEqual(["scribe", "wizard"]);
    expect(found.find(item => item.name === "wizard")).toMatchObject({ description: "wizard does things", files: 3, bytes: skill("wizard").length + 18 + 5 });
    expect(await readFile(join(staging, "wizard/SKILL.md"), "utf8")).toBe(skill("wizard"));
    expect([...await readFile(join(staging, "wizard/assets/logo.bin"))]).toEqual([0, 255, 1, 2, 3]);
    expect((await stat(join(staging, "wizard/scripts/run.sh"))).mode & 0o111).not.toBe(0);
  });

  it("reads a skill whose SKILL.md sits at the root of the archive, named by its frontmatter", async () => {
    const found = await stageUpload(zip([{ path: "SKILL.md", data: skill("rooted") }, { path: "notes.md", data: "x" }]), staging);

    expect(found).toMatchObject([{ name: "rooted", files: 2 }]);
    expect(await readFile(join(staging, "rooted/notes.md"), "utf8")).toBe("x");
  });

  it("keeps a SKILL.md nested inside a skill as part of that skill", async () => {
    const found = await stageUpload(zip([{ path: "outer/SKILL.md", data: skill("outer") }, { path: "outer/examples/demo/SKILL.md", data: skill("demo") }]), staging);

    expect(found.map(item => item.name)).toEqual(["outer"]);
    expect(found[0]?.files).toBe(2);
  });

  it("ignores archive clutter such as __MACOSX and .DS_Store", async () => {
    const found = await stageUpload(zip([
      { path: "wizard/SKILL.md", data: skill("wizard") },
      { path: "wizard/.DS_Store", data: "junk" },
      { path: "__MACOSX/wizard/._SKILL.md", data: "junk" },
    ]), staging);

    expect(found).toMatchObject([{ name: "wizard", files: 1 }]);
  });

  it("reads a folder given as files from the browser", async () => {
    const found = await stageUpload({ files: [
      { path: "wizard/SKILL.md", data: Buffer.from(skill("wizard")) },
      { path: "wizard/refs/a.md", data: Buffer.from("a") },
    ] }, staging);

    expect(found).toMatchObject([{ name: "wizard", files: 2 }]);
    expect(await readFile(join(staging, "wizard/refs/a.md"), "utf8")).toBe("a");
  });

  it("reads a folder from a path on this machine, keeping executable files executable", async () => {
    const folder = join(temp, "source");
    await mkdir(join(folder, "wizard/scripts"), { recursive: true });
    await writeFile(join(folder, "wizard/SKILL.md"), skill("wizard"));
    await writeFile(join(folder, "wizard/scripts/run.sh"), "#!/bin/sh\n", { mode: 0o755 });

    const found = await stageUpload({ folder }, staging);

    expect(found).toMatchObject([{ name: "wizard", files: 2 }]);
    expect((await stat(join(staging, "wizard/scripts/run.sh"))).mode & 0o111).not.toBe(0);
  });

  it("reads a single skill folder chosen directly", async () => {
    const folder = join(temp, "wizard-folder");
    await mkdir(folder);
    await writeFile(join(folder, "SKILL.md"), skill("wizard"));

    expect(await stageUpload({ folder }, staging)).toMatchObject([{ name: "wizard", files: 1 }]);
  });
});

async function rejects(source: UploadSource, message: RegExp): Promise<void> {
  await expect(stageUpload(source, staging)).rejects.toThrow(message);
  expect(await readdir(staging)).toEqual([]);
}

describe("rejecting unsafe uploads before anything is written", () => {
  it("rejects an archive with no SKILL.md", async () => {
    await rejects(zip([{ path: "readme.md", data: "hello" }]), /No SKILL\.md/);
  });

  it("rejects path traversal", async () => {
    await rejects(zip([{ path: "wizard/SKILL.md", data: skill("wizard") }, { path: "wizard/../../evil.txt", data: "x" }]), /unsafe/i);
    await rejects({ files: [{ path: "../evil/SKILL.md", data: Buffer.from(skill("evil")) }] }, /unsafe/i);
  });

  it("rejects absolute and drive paths", async () => {
    await rejects(zip([{ path: "/etc/SKILL.md", data: skill("etc") }]), /unsafe/i);
    await rejects(zip([{ path: "C:/skills/SKILL.md", data: skill("c") }]), /unsafe/i);
    await rejects(zip([{ path: "wizard\\..\\SKILL.md", data: skill("w") }]), /unsafe/i);
  });

  it("rejects a symlink inside an archive", async () => {
    await rejects(zip([{ path: "wizard/SKILL.md", data: skill("wizard") }, { path: "wizard/link", data: "/etc/passwd", type: "symlink" }]), /symlink|link/i);
  });

  it("rejects a symlink inside a folder", async () => {
    const folder = join(temp, "source");
    await mkdir(join(folder, "wizard"), { recursive: true });
    await writeFile(join(folder, "wizard/SKILL.md"), skill("wizard"));
    await symlink("/etc/passwd", join(folder, "wizard/link"));

    await rejects({ folder }, /symlink|link/i);
  });

  it("rejects duplicate entries, including ones that differ only by case", async () => {
    await rejects(zip([{ path: "wizard/SKILL.md", data: skill("wizard") }, { path: "wizard/SKILL.md", data: "again" }]), /duplicate/i);
    await rejects(zip([{ path: "wizard/SKILL.md", data: skill("wizard") }, { path: "wizard/skill.MD", data: "again" }]), /duplicate/i);
  });

  it("rejects two skills with the same name", async () => {
    await rejects(zip([{ path: "a/SKILL.md", data: skill("same") }, { path: "b/SKILL.md", data: skill("same") }]), /same name|twice/i);
  });

  it("rejects two skills whose names differ only by letter case, writing nothing", async () => {
    await rejects(zip([{ path: "one/SKILL.md", data: skill("Foo") }, { path: "two/SKILL.md", data: skill("foo") }]), /same name/i);
    expect(await readdir(staging)).toEqual([]);
  });

  it("rejects a skill whose name cannot be a folder name", async () => {
    await rejects(zip([{ path: "x/SKILL.md", data: "---\nname: ../../bad\ndescription: d\n---\n" }, { path: "y/z.md", data: "" }]), /name/i);
  });

  it("rejects an archive that is too large or expands too far", async () => {
    await rejects(zip([{ path: "wizard/SKILL.md", data: skill("wizard") }, { path: "wizard/big.bin", data: Buffer.alloc(26 * 1024 * 1024), compress: true }]), /too large/i);
  });

  it("rejects too many files", async () => {
    const files = Array.from({ length: 2001 }, (_, index) => ({ path: `wizard/f${index}.txt`, data: Buffer.from("x") }));
    await rejects({ files: [{ path: "wizard/SKILL.md", data: Buffer.from(skill("wizard")) }, ...files] }, /too many/i);
  });

  it("rejects bytes that are not a zip", async () => {
    await rejects({ archive: Buffer.from("this is not a zip file at all, not even close") }, /zip/i);
  });

  it.each([40, 50])("rejects a corrupted entry (byte %i)", async index => {
    const archive = makeZip([{ path: "wizard/SKILL.md", data: skill("wizard") }]);
    archive[index] = (archive[index] ?? 0) ^ 0xff;
    await rejects({ archive }, /checksum|damaged/i);
  });
});
