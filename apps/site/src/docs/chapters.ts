export const chapters = [
  {
    "id": "start",
    "title": "Start here",
    "group": "Get started",
    "description": "Preview setup and install the CLI."
  },
  {
    "id": "setup",
    "title": "Set up AFK",
    "group": "Get started",
    "description": "Choose installation scope, agents, and kit areas."
  },
  {
    "id": "concepts",
    "title": "How AFK works",
    "group": "Understand",
    "description": "Understand the pieces, sources, and cached configuration."
  },
  {
    "id": "customize",
    "title": "Customize your kit",
    "group": "Understand",
    "description": "Try another catalog and save a team default."
  },
  {
    "id": "catalog",
    "title": "Build and share a catalog",
    "group": "Guides",
    "description": "Author, publish, validate, and combine your own catalog sources."
  },
  {
    "id": "skills",
    "title": "Manage your skills",
    "group": "Guides",
    "description": "Install, inspect, update, and manage skill storage and invocation."
  },
  {
    "id": "profiles",
    "title": "Work with skill profiles",
    "group": "Guides",
    "description": "Define, install, activate, and restore skill working sets."
  },
  {
    "id": "reference",
    "title": "Command reference",
    "group": "Reference",
    "description": "Find setup, catalog, and maintenance commands."
  },
  {
    "id": "troubleshooting",
    "title": "Troubleshooting",
    "group": "Reference",
    "description": "Diagnose catalog, preview, installer, and CLI path problems."
  }
] as const;

export type Chapter = (typeof chapters)[number];
export type ChapterId = Chapter["id"];
