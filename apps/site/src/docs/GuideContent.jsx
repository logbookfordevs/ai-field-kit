export const chapters = [
  { id: 'start', title: 'Start here', group: 'Get started' },
  { id: 'setup', title: 'Set up AFK', group: 'Get started' },
  { id: 'concepts', title: 'How AFK works', group: 'Understand' },
  { id: 'customize', title: 'Customize your kit', group: 'Understand' },
  { id: 'reference', title: 'Command reference', group: 'Reference' },
  { id: 'troubleshooting', title: 'Troubleshooting', group: 'Reference' },
];

const nextLink = (id, label) => <p><a href={`/docs?chapter=${id}`}>{label}</a></p>;

export default function GuideContent({ chapter, Command }) {
  if (chapter === 'start') {
    return <>
      <h1>Start with a preview</h1>
      <p>AFK is a setup router for AI coding tools. It helps you choose and prepare shared rules, skills, MCPs, plugins, and hooks without turning them into one mandatory framework.</p>
      <h2 id="start-requirements">Before you begin</h2>
      <p>You need Node.js 20 or newer and a terminal. You do not need to install AFK globally for the first look.</p>
      <h2 id="start-preview">Run the safe first command</h2>
      <Command value="npx @logbookfordevs/afk setup --dry-run" label="preview" />
      <p>The guided flow starts with nothing selected. Choose an area and target, then inspect the planned file operations and delegated installer commands. Dry run does not apply catalog or configuration writes and does not run delegated installers.</p>
      <h2 id="start-next">Apply only what you reviewed</h2>
      <p>When the preview matches your intent, rerun the same command without <code>--dry-run</code>. Stay with the guided prompts for your first setup.</p>
      <Command value="npx @logbookfordevs/afk setup" label="apply" />
      <p>For ongoing use, install the CLI globally. This makes the shorter <code>afk …</code> commands used throughout the rest of this guide available in your shell.</p>
      <Command value="npm install -g @logbookfordevs/afk" label="optional global install" />
      {nextLink('setup', 'Continue to the setup walkthrough')}
    </>;
  }

  if (chapter === 'setup') {
    return <>
      <h1>Set up AFK</h1>
      <p>Setup is a guided choice of scope, target agents, and kit areas. AFK detects supported targets, but you approve the selection before it acts.</p>
      <h2 id="setup-scope">Choose a scope</h2>
      <dl>
        <dt>Global</dt><dd>The default. Prepares user-level agent directories and passes global flags to delegated tools where supported.</dd>
        <dt>Project</dt><dd>Use <code>--local</code> or <code>--scope project</code>. AFK writes its owned project files under the current repository and delegates without global flags.</dd>
      </dl>
      <Command value="afk setup --local --dry-run" label="project preview" />
      <h2 id="setup-areas">Choose only the areas you need</h2>
      <ul>
        <li><strong>Rules</strong> sync into managed regions of supported agent rule files.</li>
        <li><strong>Skills</strong> delegate installation to the official <code>skills</code> CLI.</li>
        <li><strong>MCPs</strong> delegate recommendations to <code>add-mcp</code>.</li>
        <li><strong>Plugins</strong> run their own installers and supported post-install setup.</li>
        <li><strong>Hooks</strong> copy scripts and merge lifecycle commands into supported configs.</li>
      </ul>
      <h2 id="setup-review">Review, then apply</h2>
      <p>Preview one area when you want a smaller review surface, for example:</p>
      <Command value="afk setup skills --dry-run" label="skills only" />
      <p>Remove <code>--dry-run</code> only after the scope, targets, and delegated commands look right.</p>
      {nextLink('concepts', 'Learn the source and composition model')}
    </>;
  }

  if (chapter === 'concepts') {
    return <>
      <h1>How AFK works</h1>
      <p>AFK prepares a field for agents; it is not an agent itself. Each piece keeps a distinct job and ownership boundary.</p>
      <h2 id="concepts-pieces">The pieces</h2>
      <dl>
        <dt>Rules</dt><dd>Standards that should be present while the agent works.</dd>
        <dt>Skills</dt><dd>Focused routines invoked when a task calls for them.</dd>
        <dt>Hooks</dt><dd>Deterministic lifecycle automation outside the conversation.</dd>
        <dt>MCPs and plugins</dt><dd>Optional tool surfaces installed through their owning ecosystems.</dd>
      </dl>
      <h2 id="concepts-sources">Source precedence</h2>
      <ol>
        <li>An explicit <code>--source</code> applies to that command only.</li>
        <li>Otherwise AFK uses the saved default source.</li>
        <li>Without either, AFK offers its built-in <code>logbookfordevs/ai-field-kit</code> source.</li>
      </ol>
      <h2 id="concepts-cache">Source, cache, and setup</h2>
      <p>A source is the upstream catalog. The local catalog is a materialized cache. Setup reads the selected source or cache and prepares chosen agent surfaces. These are related states, not synonyms.</p>
      <p><code>afk show</code> inspects the global cache without updating it; <code>afk show --local</code> inspects <code>./afk/catalog</code>. <code>afk show --source …</code> inspects a source for one run. Setup may materialize a cache on first run, while <code>afk refresh</code> is the explicit command for updating cached catalog files.</p>
      {nextLink('customize', 'Customize the catalog source')}
    </>;
  }

  if (chapter === 'customize') {
    return <>
      <h1>Customize your kit</h1>
      <p>Customization starts with a catalog source: a repository or local directory containing AFK catalog manifests. Keep team defaults in that source and choose project scope when a repository should own the installed result.</p>
      <h2 id="customize-inspect">Inspect before adopting</h2>
      <p>The value below is a placeholder example, not a real package:</p>
      <Command value="afk show --source your-org/dev-kit" label="example source" />
      <p>Use categories such as <code>skills</code> or <code>hooks</code> to narrow the output. Inspection does not save the source or refresh your cache.</p>
      <h2 id="customize-once">Use a source once</h2>
      <Command value="afk setup --source your-org/dev-kit --dry-run" label="placeholder example" />
      <p><code>--source</code> overrides the saved source for this run without changing the remembered default.</p>
      <h2 id="customize-default">Save a team default</h2>
      <Command value="afk refresh --default-source your-org/dev-kit --dry-run" label="preview change" />
      <p>Review the planned cache and default-source writes, then remove <code>--dry-run</code> to save the source and refresh.</p>
      <details>
        <summary>Catalog manifests</summary>
        <p>AFK catalogs cover rules, skills, MCPs, plugins, hooks, and presets. Use the <a href="https://github.com/logbookfordevs/ai-field-kit/blob/main/packages/afk/README.md">AFK package README</a> and <a href="https://github.com/logbookfordevs/ai-field-kit/tree/main/packages/afk/catalog">shipped catalog files</a> as the schema reference; do not infer a manifest shape from examples on this page.</p>
      </details>
      {nextLink('reference', 'Open the command reference')}
    </>;
  }

  if (chapter === 'reference') {
    return <>
      <h1>Command reference</h1>
      <p>Use these commands for the common setup loop. Run any command with <code>--help</code> for its complete current options.</p>
      <h2 id="reference-core">Core commands</h2>
      <div className="docs-table"><table><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>
        <tr><td><code>afk setup</code></td><td>Guided setup across selected areas.</td></tr>
        <tr><td><code>afk setup &lt;area&gt;</code></td><td>Run one area: rules, skills, mcps, plugins, or hooks.</td></tr>
        <tr><td><code>afk show [category...]</code></td><td>Inspect cached catalog data without changing it.</td></tr>
        <tr><td><code>afk refresh [category...]</code></td><td>Update cached catalog files.</td></tr>
        <tr><td><code>afk skills list</code></td><td>Inspect local global and project skill libraries.</td></tr>
      </tbody></table></div>
      <h2 id="reference-flags">Setup flags</h2>
      <dl>
        <dt><code>--dry-run</code></dt><dd>Print planned actions without applying them.</dd>
        <dt><code>--local</code></dt><dd>Use project setup scope. On <code>refresh</code>, target <code>./afk/catalog</code>.</dd>
        <dt><code>--agent &lt;agent&gt;</code></dt><dd>Override detected targets; repeat for more than one.</dd>
        <dt><code>--source &lt;source&gt;</code></dt><dd>Use a catalog source for this command only.</dd>
        <dt><code>--yes</code></dt><dd>Accept defaults and skip prompts; best after a source is saved.</dd>
        <dt><code>--verbose</code></dt><dd>Show delegated installer output.</dd>
      </dl>
      <details>
        <summary>Skill library management</summary>
        <p><code>afk skills show</code>, <code>open</code>, <code>disable</code>, <code>enable</code>, <code>delete</code>, <code>upgrade</code>, <code>profiles</code>, and <code>categorize</code> manage skills already represented on disk. They are separate from <code>afk setup skills</code>, which installs selected skills.</p>
      </details>
      {nextLink('troubleshooting', 'Troubleshoot a setup')}
    </>;
  }

  return <>
    <h1>Troubleshooting</h1>
    <p>Start by separating catalog state, setup planning, and delegated installer output. Each points to a different fix.</p>
    <h2 id="troubleshooting-missing">A catalog item is missing</h2>
    <Command value="afk show" label="inspect cache" />
    <p>If the cache is stale, preview and then run <code>afk refresh</code>. Use <code>afk refresh --local</code> only for a repository-owned <code>./afk/catalog</code>.</p>
    <h2 id="troubleshooting-preview">I cannot tell what setup will change</h2>
    <Command value="afk setup --dry-run" label="preview all" />
    <p>Narrow the command to one area or add repeated <code>--agent</code> flags. Remember that <code>show</code> explains catalog inputs; dry run explains planned setup actions.</p>
    <h2 id="troubleshooting-delegate">A delegated installer failed</h2>
    <Command value="afk setup plugins --verbose" label="show upstream output" />
    <p><strong>This is a real setup run and can apply changes.</strong> Retry only the failed area after reviewing its dry run. AFK continues through the remaining selections within that area and returns a non-zero exit with a failure summary; verbose output exposes the owning installer&apos;s output.</p>
    <h2 id="troubleshooting-version">The wrong AFK command runs</h2>
    <Command value={'command -v afk\nafk --version'} label="check path (macOS / Linux)" />
    <p>A development symlink in <code>~/.local/bin</code> can shadow the npm-installed CLI. Inspect the resolved path before changing either installation.</p>
    <details>
      <summary>Still stuck?</summary>
      <p>Run the failing command with <code>--help</code>, preserve its exact output, and compare your Node version, scope, source, and target agent with the command you intended to run.</p>
    </details>
  </>;
}
