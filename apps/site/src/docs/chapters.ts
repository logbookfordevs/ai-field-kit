export const chapters = [
  { id: 'start', title: 'Start here', description: 'Open the local app, start your kit and bring it to another machine.' },
  { id: 'kit', title: 'Your kit', description: 'Keep Core skills on every machine, install from repositories, sync a machine and save skills to try later.' },
  { id: 'packs', title: 'Packs', description: 'Group skills, turn them on for Global or a project, read them once and share them as manifests.' },
  { id: 'skills', title: 'Skills & invocation', description: 'Inspect local skills, control availability and choose native invocation preferences.' },
  { id: 'agent', title: 'Use with your agent', description: 'Read a pack without turning it on.' },
  { id: 'tools', title: 'Tools', description: 'Save and explicitly run global tool commands, including the skills they bring.' },
  { id: 'rules', title: 'Agent rules', description: 'Edit shared Markdown, resolve references and preview managed-region sync.' },
  { id: 'settings', title: 'Settings & projects', description: 'Choose configuration storage and manage local project folders.' },
  { id: 'reference', title: 'CLI reference', description: 'Find the kit, sync, pack, reading and export commands.' },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'Resolve sync, scope, path and local-server problems.' },
  { id: 'legacy', title: 'Earlier versions', description: 'Move from stacks and profiles, or install a release before AFK 2.0.' },
] as const;

/** Chapter IDs that were renamed. Shared links keep landing on the matching chapter. */
export const chapterAliases = {
  profiles: 'packs',
  sources: 'kit',
} as const satisfies Record<string, Chapter['id']>;

export const retiredChapters = [
  { id: 'setup', title: 'Set up AFK' },
  { id: 'concepts', title: 'How AFK works' },
  { id: 'workflows', title: 'Compose a workflow' },
  { id: 'customize', title: 'Customize your kit' },
  { id: 'catalog', title: 'Build and share a catalog' },
] as const;

export type Chapter = (typeof chapters)[number];
export type ChapterId = Chapter['id'];
