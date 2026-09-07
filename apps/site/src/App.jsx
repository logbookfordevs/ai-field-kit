import { useEffect, useRef, useState } from 'react';
import { AfkMark } from '@/components/ui/svgs/afkMark.jsx';
import { ClaudeAiIcon } from '@/components/ui/svgs/claudeAiIcon.jsx';
import { CodexDark } from '@/components/ui/svgs/codexDark.jsx';
import { OpencodeDark } from '@/components/ui/svgs/opencodeDark.jsx';

const repo = 'https://github.com/logbookfordevs/ai-field-kit';
const skillsCommand = `npx skills add ${repo}`;
const setupCommand = 'npx @logbookfordevs/afk setup --dry-run';
const paths = [
  { id: 'try', label: 'Try the full kit', title: 'Preview everything. Write nothing.', text: 'Run AFK once with npx. The dry run shows the exact rule, skill, MCP, plugin, and hook actions before setup touches your machine.', command: setupCommand, facts: ['No global install', 'Guided selection', 'Dry run first'] },
  { id: 'skills', label: 'Skills only', title: 'Start with portable expertise.', text: 'Install the authored AFK skills into the agents you choose. This path leaves rules, hooks, MCPs, plugins, and setup policy alone.', command: skillsCommand, facts: ['Smallest path', 'Agent picker', 'No setup policy'] },
  { id: 'global', label: 'Daily CLI', title: 'Keep AFK on the workbench.', text: 'Install the CLI globally when setup, refresh, catalog import, and skill inspection become part of your regular local workflow.', command: 'curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash\nafk setup --dry-run', facts: ['Reusable command', 'Refresh support', 'Full setup router'] },
  { id: 'project', label: 'Project catalog', title: 'Commit the choices with the project.', text: 'Import the default AFK catalog through shadcn, then preview project-local setup. Distribution and setup ownership stay explicit.', command: 'pnpm dlx shadcn@latest add logbookfordevs/ai-field-kit/afk-catalog\nafk setup --local --dry-run', facts: ['Repo-local catalog', 'Reviewable defaults', 'Explicit ownership'] },
];
const pieces = [
  ['rules', 'Shared working standards', 'Versioned instructions for behavior, safety boundaries, commands, and review expectations.'],
  ['skills', 'Reusable expert routines', 'Focused capabilities for design, debugging, research, planning, reviews, and handoff.'],
  ['workflows', 'Structure when the work needs it', 'Multi-step modes for discovery, decisions, artifacts, checkpoints, and verification.'],
  ['hooks', 'Guardrails at the moment of action', 'Deterministic checks that run in the background without spending the context budget.'],
  ['MCPs', 'Tool wiring, delegated honestly', 'A recommendation registry resolved by AFK and installed through the tools that own each ecosystem.'],
  ['plugins', 'Companions for richer surfaces', 'Optional Codex-native capabilities that improve selected skills without becoming mandatory.'],
];
const HarnessIcon = ({ className }) => <span className={`${className} harness-icon`} aria-hidden="true">+</span>;
const agents = [
  { name: 'Codex', type: 'terminal', capability: 'rules + MCP', Icon: CodexDark, dark: true },
  { name: 'Claude', type: 'code', capability: 'rules + MCP', Icon: ClaudeAiIcon },
  { name: 'Other harness', type: 'custom path', capability: 'configured route', Icon: HarnessIcon },
  { name: 'OpenCode', type: 'agent', capability: 'rules + MCP', Icon: OpencodeDark, dark: true },
];

function CopyButton({ value, onResult, compact = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onResult('Command copied');
      window.setTimeout(() => setCopied(false), 1600);
    } catch { onResult('Copy unavailable. Select the command manually.'); }
  };
  return <button className={`copy${compact ? ' copy--compact' : ''}`} type="button" onClick={copy} aria-label="Copy command">{copied ? 'Copied' : 'Copy'}</button>;
}

function Command({ value, label, onResult }) {
  return <div className="command"><span>{label}</span><code>{value}</code><CopyButton value={value} compact onResult={onResult} /></div>;
}

function App() {
  const [active, setActive] = useState(paths[0].id);
  const [status, setStatus] = useState('');
  const timer = useRef(null);
  const selected = paths.find((path) => path.id === active) ?? paths[0];

  useEffect(() => {
    const items = document.querySelectorAll('[data-reveal]');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((item) => item.setAttribute('data-visible', 'true'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.setAttribute('data-visible', 'true'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const announce = (message) => {
    window.clearTimeout(timer.current);
    setStatus(message);
    timer.current = window.setTimeout(() => setStatus(''), 2400);
  };
  const select = (id) => { setActive(id); announce(`${paths.find((item) => item.id === id)?.label} selected`); };
  const handleKeys = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const last = paths.length - 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowLeft' ? (index || last) - 1 : index === last ? 0 : index + 1;
    select(paths[next].id);
    document.getElementById(`path-${paths[next].id}`)?.focus();
  };

  return <div className="app" data-lfd-recipe="ocean">
    <a className="skip" href="#main">Skip to content</a>
    <header><div className="nav-shell">
      <a className="brand" href="#top" aria-label="AI Field Kit home"><span>AFK</span>AI Field Kit</a>
      <nav aria-label="Primary navigation"><a href="#why">Why</a><a href="#kit">Kit</a><a href="#install">Install</a><a href="#agents">Agents</a><a href="/docs">Docs</a></nav>
      <a className="button button--small" href="#install">Try AFK</a>
    </div></header>
    <main id="main">
      <section className="hero" id="top"><div className="hero__grid">
        <div className="hero__copy" data-reveal>
          <p className="brand-note">A field kit by Logbook for Devs</p>
          <h1>One field kit.<br /><em>Every coding agent.</em></h1>
          <p className="lead">Version your working standards once. AFK routes the right rules, skills, hooks, MCPs, and plugins into the local agents you already use.</p>
          <div className="hero__actions"><a className="button" href="#install">Preview the setup</a><a className="text-link" href={repo} target="_blank" rel="noreferrer">Explore the repository<span className="sr-only"> (opens in a new tab)</span></a></div>
          <Command value={setupCommand} label="dry run" onResult={announce} />
        </div>
        <div className="route-map" data-reveal aria-label="AI Field Kit connects one shared source to Codex, Claude, OpenCode, and other configured harness paths">
          <div className="route-meta"><span>afk / route map</span><span>04 targets detected</span></div>
          <svg viewBox="0 0 720 660" aria-hidden="true"><path d="M360 330 C228 156 156 104 78 88"/><path d="M360 330 C490 152 560 102 646 86"/><path d="M360 330 C202 446 146 514 92 572"/><path d="M360 330 C500 452 568 516 642 574"/></svg>
          {agents.map(({ name, type, Icon, dark }, index) => <div className={`agent-node agent-node--${index + 1}`} key={name}><Icon className={dark ? 'agent-icon agent-icon--dark' : 'agent-icon'} aria-hidden="true"/><span><strong>{name}</strong><small>{type}</small></span></div>)}
          <div className="route-core"><div><AfkMark className="route-core__mark" /><span>shared field kit</span></div></div>
          <div className="route-legend"><span>rules · skills · hooks · MCPs</span><span className="ready">ready</span></div>
        </div>
      </div></section>

      <section className="section" id="why"><div className="container">
        <div className="intro" data-reveal><h2>Your agents change.<br />Your standards should not.</h2><p>Each tool has its own memory, config shape, and installation story. AFK gives them a shared operating layer without pretending to be another agent or mandatory methodology.</p></div>
        <div className="ledger" data-reveal>
          <article><span>Problem</span><h3>Good habits fragment by tool.</h3><p>A review ritual in Codex, a debugging routine in Claude, and project rules elsewhere quickly become four things to maintain.</p></article>
          <article><span>Principle</span><h3>Context stays close to the work.</h3><p>Portable defaults travel across machines. Repository-specific choices stay versioned beside the code that depends on them.</p></article>
          <article><span>Position</span><h3>AFK prepares the field.</h3><p>You keep choosing the agent. AFK makes the standards, capabilities, and setup boundaries legible before that agent starts.</p></article>
        </div>
      </div></section>

      <section className="section" id="kit"><div className="container kit">
        <div className="stack" data-reveal><div><span>Always present</span><strong>Rules</strong><p>Shared repository doctrine.</p></div><div><span>Invoked on demand</span><strong>Skills</strong><p>Focused expert routines.</p></div><div><span>Deterministic + delegated</span><strong>Runtime</strong><p>Hooks, MCPs, plugins, setup.</p></div></div>
        <div className="manual" data-reveal><h2>A field manual,<br />not a card wall.</h2><p className="section-copy">Every piece has one job. Install the layers you need without collapsing them into one opaque bundle.</p><div className="manual-list">{pieces.map(([key, title, text]) => <article key={key}><code>{key}</code><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div>
      </div></section>

      <section className="section install-section" id="install"><div className="container">
        <div className="intro" data-reveal><h2>Choose the amount<br />of kit you want.</h2><p>Start with the smallest useful next step. Every route says what it owns, what it leaves alone, and what it will do before it writes.</p></div>
        <div className="install" data-reveal>
          <div className="tabs" role="tablist" aria-label="AFK install paths">{paths.map((path, index) => { const isActive = path.id === active; return <button id={`path-${path.id}`} key={path.id} type="button" role="tab" aria-selected={isActive} aria-controls="install-panel" tabIndex={isActive ? 0 : -1} onClick={() => select(path.id)} onKeyDown={(event) => handleKeys(event, index)}><span>{String(index + 1).padStart(2, '0')}</span>{path.label}</button>; })}</div>
          <div className="install-panel" id="install-panel" role="tabpanel" aria-labelledby={`path-${selected.id}`}><p className="selection">Selected path / {selected.label}</p><h3>{selected.title}</h3><p>{selected.text}</p><pre><code>{selected.command}</code><CopyButton value={selected.command} onResult={announce}/></pre><ul>{selected.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>
        </div>
      </div></section>

      <section className="section layers-section"><div className="container context">
        <div className="context__visual" data-reveal><article><span>01</span><div><h3>Portable defaults</h3><p>Standards and skills that should follow you.</p></div></article><article><span>02</span><div><h3>Personal preferences</h3><p>Your agent habits and local tool choices.</p></div></article><article><span>03</span><div><h3>Project manifests</h3><p>The repository gets final say where it matters.</p></div></article></div>
        <div data-reveal><h2>Defaults travel.<br />Context stays close.</h2><p className="section-copy">AFK keeps the common layer portable while letting each project own its architecture, commands, hooks, and handoff rules.</p></div>
      </div></section>

      <section className="section" id="agents"><div className="container"><div className="intro" data-reveal><h2>One kit across<br />many surfaces.</h2><p>Known harnesses get first-class routes. Configured local paths let supported targets live outside their standard locations, while skills and MCP installation remain delegated to their owning ecosystems.</p></div><div className="agent-band" data-reveal>{agents.map(({ name, type, capability, Icon, dark }) => <article key={name}><Icon className={dark ? 'band-icon band-icon--dark' : 'band-icon'} aria-hidden="true"/><div><strong>{name}</strong><span>{type}</span></div><small>{capability}</small></article>)}</div></div></section>

      <section className="closing"><div className="container closing__grid" data-reveal><h2>See the route.<br />Then run it.</h2><div className="closing__action"><span className="hand-note" aria-hidden="true">ready when you are</span><Command value={setupCommand} label="start safely" onResult={announce}/><a className="button button--light" href={repo} target="_blank" rel="noreferrer">Open GitHub</a></div></div></section>
    </main>
    <footer><div className="container footer-grid"><span>A tool from the <a href="https://logbookfordevs.com/" target="_blank" rel="noreferrer">Logbook for Devs</a><em>Charting the technical seas, one commit at a time.</em></span><div><a href={repo} target="_blank" rel="noreferrer">Repository</a><a href={`${repo}/blob/main/CHANGELOG.md`} target="_blank" rel="noreferrer">Changelog</a><a href="#top">Back to top</a></div></div></footer>
    <div className={`toast${status ? ' toast--visible' : ''}`} role="status" aria-live="polite">{status}</div>
  </div>;
}

export default App;
