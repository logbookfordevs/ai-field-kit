import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillRecord } from "./catalog.js";
import type { SkillProfileItem } from "./profiles.js";

export function renderSkillContext(record: SkillRecord): string {
  const content = readFileSync(record.skillFilePath, "utf8").trimEnd();
  const root = join(record.rootPath, record.folder);

  return [
    `<afk-skill id="${escapeXmlAttribute(record.folder)}" root="${escapeXmlAttribute(root)}" storage="${record.storage}">`,
    content,
    "</afk-skill>",
  ].join("\n");
}

export function renderSkillProfileContext(input: {
  profile: SkillProfileItem;
  records: SkillRecord[];
  includeContent: boolean;
}): string {
  const skills = input.includeContent
    ? input.records.map(renderSkillContext)
    : input.records.map(renderSkillReference);

  return [
    `<afk-profile id="${escapeXmlAttribute(input.profile.id)}" scope="current-request">`,
    "The user wants you to take into account the skills listed below.",
    "<skills>",
    ...skills,
    "</skills>",
    "</afk-profile>",
  ].join("\n");
}

function renderSkillReference(record: SkillRecord): string {
  return [
    "  <skill",
    `    id="${escapeXmlAttribute(record.folder)}"`,
    `    description="${escapeXmlAttribute(record.description)}"`,
    `    storage="${record.storage}"`,
    `    get="${escapeXmlAttribute(`afk skills get ${record.folder}`)}"`,
    "  />",
  ].join("\n");
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
