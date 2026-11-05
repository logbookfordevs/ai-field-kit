import { parseDocument, type Document } from "yaml";

export interface InvocationBackup { skill: string; metadata: string | null }

const skillField = "disable-model-invocation";
const agentField = ["policy", "allow_implicit_invocation"];

function frontmatter(skill: string): { document: Document; body: string } | undefined {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(skill);
  if (!match) return undefined;
  const document = parseDocument(match[2]!);
  if (document.errors.length) return undefined;
  return { document, body: skill.slice(match[0].length) };
}

const joinSkill = (document: Document, body: string): string => `---\n${document.toString()}---\n${body}`;

function agentDocument(metadata: string | null): Document | undefined {
  const document = parseDocument(metadata ?? "{}");
  return document.errors.length ? undefined : document;
}

const isEmpty = (document: Document): boolean => !(document.contents as { items?: unknown[] } | null)?.items?.length;

function dropEmptyPolicy(document: Document): void {
  if (document.hasIn(["policy"]) && !(document.getIn(["policy"]) as { items?: unknown[] } | undefined)?.items?.length) document.deleteIn(["policy"]);
}

/**
 * The skill's files with AFK's two invocation fields removed, for deciding whether two copies are the same skill.
 * A file that AFK could not have rewritten byte for byte is left as it is, so a formatting difference never hides an edit.
 */
export function withoutInvocationFields(skill: string, metadata: string | null): InvocationBackup {
  let nextSkill = skill, nextMetadata = metadata;
  const parsed = frontmatter(skill);
  if (parsed?.document.has(skillField) && joinSkill(parsed.document, parsed.body) === skill) {
    parsed.document.delete(skillField);
    nextSkill = joinSkill(parsed.document, parsed.body);
  }
  const agent = metadata === null ? undefined : agentDocument(metadata);
  if (agent?.hasIn(agentField) && agent.toString() === metadata) {
    agent.deleteIn(agentField);
    dropEmptyPolicy(agent);
    nextMetadata = isEmpty(agent) ? null : agent.toString();
  }
  return { skill: nextSkill, metadata: nextMetadata };
}

/**
 * The skill's current files with only AFK's two invocation fields put back as the backup had them; every other edit is kept.
 * Returns undefined when the current files cannot be parsed, so the caller leaves them untouched.
 */
export function restoreInvocationFields(current: InvocationBackup, backup: InvocationBackup): InvocationBackup | undefined {
  const parsed = frontmatter(current.skill), agent = agentDocument(current.metadata);
  if (!parsed || !agent) return undefined;
  const original = frontmatter(backup.skill)?.document, originalAgent = agentDocument(backup.metadata);
  if (original?.has(skillField)) parsed.document.set(skillField, original.get(skillField));
  else parsed.document.delete(skillField);
  if (originalAgent?.hasIn(agentField)) agent.setIn(agentField, originalAgent.getIn(agentField));
  else if (agent.hasIn(agentField)) { agent.deleteIn(agentField); dropEmptyPolicy(agent); }
  const dropsFile = isEmpty(agent) && (current.metadata === null || backup.metadata === null);
  const metadata = dropsFile ? null : agent.toString();
  return { skill: joinSkill(parsed.document, parsed.body), metadata };
}
