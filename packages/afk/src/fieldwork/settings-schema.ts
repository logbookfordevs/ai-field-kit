import { stackSchema } from "./stacks.js";

const nonempty = { type: "string", pattern: "^(?![\\s\\S]*[\\u0000-\\u001f\\u007f])(?=[\\s\\S]*\\S)[\\s\\S]+$" };
const skillName = { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]*$" };
const skillNames = { type: "array", items: skillName };
const selectedSkills = { ...skillNames, minItems: 1, uniqueItems: true };

export const settingsSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "AFK settings",
  description: "Editor guidance for AFK settings version 1. AFK's validateSettings remains authoritative for cross-field rules, including unique identifiers and valid activation scopes. A valid document does not verify integration with an agent.",
  $defs: stackSchema.$defs,
  type: "object",
  required: ["version", "profiles", "projects", "tools", "favoriteSources"],
  properties: {
    configurationId: { ...skillName, readOnly: true, description: "Stable configuration identity; machine-local state is associated with it." },
    savedSkills: {
      type: "array", readOnly: true, description: "Manually reviewed installed-skill snapshots; use snapshot operations to replace them.",
      items: {
        type: "object", required: ["scope", "savedAt", "skills"], properties: {
          scope: nonempty, savedAt: { type: "string", format: "date-time" },
          skills: { type: "array", items: { type: "object", required: ["name", "available", "invocation"], properties: { name: skillName, source: nonempty, available: { type: "boolean" }, invocation: { enum: ["", "Manual only", "Automatic allowed"] } } } },
        },
      },
    },
    version: { const: 1, readOnly: true, description: "AFK-managed format version." },
    profiles: {
      type: "array", readOnly: true,
      description: "AFK-managed definitions, preparation and activation state. Use AFK profile operations to preserve physical skills and ownership receipts.",
      items: {
        type: "object", required: ["id", "name", "source", "skills"],
        properties: {
          id: skillName, name: nonempty, source: nonempty, skills: selectedSkills,
          enabled: { type: "array", items: { type: "string" }, description: "Machine-local activation, accepted for legacy input. Portable profile definitions omit this field." },
          ready: { type: "boolean", description: "Machine-local readiness; omitted from portable settings." },
        },
      },
    },
    projects: {
      type: "array",
      description: "User-editable folder mappings for inactive projects. Disable active profiles before renaming or changing a mapped folder; use AFK operations when activation or preferences exist.",
      items: {
        type: "object", required: ["name", "path"],
        properties: {
          name: { ...nonempty, not: { const: "Global" }, allOf: [{ pattern: "^[^|]*$" }], description: "Unique project scope name." },
          path: nonempty,
        },
      },
    },
    tools: {
      type: "array", description: "User-editable saved commands. Saving or validating settings does not execute them; identifiers must be unique.",
      items: {
        type: "object", required: ["id", "name", "install", "update"],
        properties: {
          id: { type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER },
          name: nonempty,
          install: { type: "string", pattern: "^(?![\\s\\S]*\\u0000)(?=[\\s\\S]*\\S)[\\s\\S]+$" },
          update: { type: "string", pattern: "^[^\\u0000]*$", description: "An empty command reuses install." },
        },
      },
    },
    favoriteSources: {
      type: "array", description: "User-editable source bookmarks. Omit skills to select all; saving does not install or discover skills.",
      items: {
        type: "object", required: ["name", "source"],
        properties: {
          name: nonempty, source: { ...nonempty, allOf: [{ pattern: "^[^-]" }] }, skills: selectedSkills,
        },
      },
    },
    stacks: {
      type: "array", description: "User-editable declarative stacks. Saving never installs or activates skills. IDs must be unique.",
      items: {
        type: "object", additionalProperties: false, required: ["manifest"],
        properties: { manifest: stackSchema, origin: { type: "string", format: "uri", pattern: "^https://" } },
      },
    },
    preferences: {
      type: "object", readOnly: true, description: "Machine-local native invocation preferences keyed by scope|skill. Use AFK to apply metadata changes.",
      propertyNames: { pattern: "\\|" }, additionalProperties: { type: "string", enum: ["Manual only", "Automatic allowed"] },
    },
    managedLinks: {
      type: "object", readOnly: true, description: "Machine-local ownership receipts: discovery link path to its recorded target. Do not hand-edit or transfer ownership by changing receipts.",
      propertyNames: nonempty, additionalProperties: nonempty,
    },
    independentSkills: {
      type: "object", readOnly: true, description: "AFK-managed independent activation state, separate from profile ownership.",
      additionalProperties: skillNames,
    },
    welcomeDismissed: { type: "boolean", readOnly: true, description: "AFK-managed local onboarding preference." },
    agentRules: {
      type: "object", readOnly: true, description: "AFK-managed destination configuration and local sync receipts. Use rules operations to preview conflicts and sync explicitly.",
      required: ["destinations"],
      properties: {
        destinations: {
          type: "array", items: {
            type: "object", required: ["id", "name", "kind", "path"],
            properties: { id: skillName, name: nonempty, kind: { enum: ["codex", "claude", "custom"] }, path: nonempty },
          },
        },
        receipts: {
          type: "object", readOnly: true, propertyNames: skillName,
          additionalProperties: {
            type: "object", required: ["region", "references", "lastSync"],
            properties: {
              region: { type: "string" }, lastSync: { type: "string" },
              references: {
                type: "object", propertyNames: { pattern: "^references/", not: { pattern: "(^|/)\\.\\.(/|$)" } },
                additionalProperties: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;
