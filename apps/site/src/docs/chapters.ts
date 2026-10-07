export const chapters = [
  { id: 'start', title: 'Start here', description: 'Open the local app and create one useful skill group.' },
  { id: 'skills', title: 'Skills & invocation', description: 'Inspect local skills, control availability and choose native invocation preferences.' },
  { id: 'profiles', title: 'Profiles', description: 'Prepare shared skill groups and enable them by target.' },
  { id: 'agent', title: 'Use with your agent', description: 'Read a prepared group without changing activation.' },
  { id: 'sources', title: 'Sources & Stacks', description: 'Save repository selections, share stacks and install or copy commands.' },
  { id: 'tools', title: 'Tools', description: 'Save and explicitly run global tool commands.' },
  { id: 'rules', title: 'Agent rules', description: 'Edit shared Markdown, resolve references and preview managed-region sync.' },
  { id: 'settings', title: 'Settings & projects', description: 'Choose configuration storage and manage local project folders.' },
  { id: 'reference', title: 'CLI reference', description: 'Find the focused reading, activation and export commands.' },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'Resolve preparation, scope, path and local-server problems.' },
  { id: 'legacy', title: 'AFK 1.x releases', description: 'Install or fork a release before AFK 2.0.' },
] as const;

export const retiredChapters = [
  { id: 'setup', title: 'Set up AFK' },
  { id: 'concepts', title: 'How AFK works' },
  { id: 'kit', title: 'Explore the AFK catalog' },
  { id: 'workflows', title: 'Compose a workflow' },
  { id: 'customize', title: 'Customize your kit' },
  { id: 'catalog', title: 'Build and share a catalog' },
] as const;

export type Chapter = (typeof chapters)[number];
export type ChapterId = Chapter['id'];
