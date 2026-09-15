import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const target = new URL('docs/afk-skills-profiles-state-machine.html', root);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const skills = (await readJson('packages/afk/catalog/skills.json')).items;
const profiles = await readJson('packages/afk/catalog/profiles.json');
let html = await readFile(target, 'utf8');
const pattern = /const CATALOG_SNAPSHOT = (.*?);\nconst SKILLS =/s;
const match = html.match(pattern);
assert.ok(match, 'Missing catalog snapshot');
const snapshot = JSON.parse(match[1]);

if (process.argv.includes('--write')) {
  const next = { ...snapshot, skills, profiles };
  html = html.replace(pattern, () => `const CATALOG_SNAPSHOT = ${JSON.stringify(next, null, 2)};\nconst SKILLS =`);
}

const data = html.slice(html.indexOf('const CATALOG_SNAPSHOT'), html.indexOf('const stage ='));
const model = runInNewContext(`${data}\n({ CATALOG_SNAPSHOT, SKILLS, WORKFLOW_MOMENTS, WORKFLOW_ROUTERS, MACHINE_NODES, MACHINE_EDGES, FLOWS, DETAILS, COMPASS_ROUTES })`);
const plain = JSON.parse(JSON.stringify(model));
assert.deepEqual(plain.CATALOG_SNAPSHOT.skills, skills, 'Skill snapshot drift: run with --write');
assert.deepEqual(plain.CATALOG_SNAPSHOT.profiles, profiles, 'Profile snapshot drift: run with --write');
const skillIds = new Set(skills.map(skill => skill.id));
const placements = [...plain.WORKFLOW_MOMENTS.flatMap(moment => moment.skills), ...plain.WORKFLOW_ROUTERS];
assert.deepEqual([...new Set(placements.map(skill => skill.id))].sort(), [...skillIds].sort(), 'Workflow placements must cover the current catalog exactly');
for (const skill of skills) {
  for (const id of skill.composes ?? []) assert.ok(skillIds.has(id), `Missing dependency: ${id}`);
}
const nodeIds = new Set(plain.MACHINE_NODES.map(node => node.id));
const edgeIds = new Set(plain.MACHINE_EDGES.map(edge => edge[0]));
assert.equal(nodeIds.size, plain.MACHINE_NODES.length, 'Duplicate machine node');
assert.equal(edgeIds.size, plain.MACHINE_EDGES.length, 'Duplicate machine edge');
for (const id of nodeIds) assert.ok(plain.DETAILS[id], `Missing detail: ${id}`);
for (const [, from, to] of plain.MACHINE_EDGES) {
  assert.ok(nodeIds.has(from) && nodeIds.has(to), `Dangling edge: ${from} → ${to}`);
}
for (const flow of Object.values(plain.FLOWS)) {
  for (const id of flow.nodes) assert.ok(nodeIds.has(id), `Unknown flow node: ${id}`);
  for (const id of flow.edges) assert.ok(edgeIds.has(id), `Unknown flow edge: ${id}`);
}
const routeIds = new Set(plain.COMPASS_ROUTES.map(route => route.id));
assert.equal(routeIds.size, plain.COMPASS_ROUTES.length, 'Duplicate Compass route');
for (const route of plain.COMPASS_ROUTES) {
  assert.ok(['workflow', 'frontend', 'motion', 'context'].includes(route.group), `Unknown crossroads group: ${route.group}`);
  for (const id of route.related) assert.ok(routeIds.has(id), `Unknown related route: ${id}`);
  await readFile(new URL(`skills/afk-compass/references/${route.source}`, root), 'utf8');
}
if (process.argv.includes('--write')) await writeFile(target, html);
console.log(`Switchyard verified: ${skills.length} skills, ${profiles.items.length} profiles, complete workflow coverage, ${routeIds.size} Compass branches, valid graph routes.`);
console.log('Catalog data can be refreshed with --write. Review workflow purposes and CLI explanations separately before publishing.');
