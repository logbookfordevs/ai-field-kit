import { useEffect } from 'react';
import { Menu } from '@base-ui/react/menu';
import { SiteLink } from '@/SiteLink.tsx';
import { AfkMark } from '@/components/ui/svgs/afkMark.tsx';
import { CommandPanel } from '@/components/CommandPanel.tsx';
import { ProfileExample } from '@/components/ProfileExample.tsx';
import { repository, sourceLaunch } from '@/site-config.ts';

const sections = [
  { title: 'Profiles', description: 'Reusable skill groups. Shared definitions, separate activation for each target.', chapter: 'profiles' },
  { title: 'Installed Skills', description: 'Inspect real files. Control availability and supported invocation preferences.', chapter: 'skills' },
  { title: 'Sources & Stacks', description: 'Save repository selections, share stacks, copy commands or install with review.', chapter: 'sources' },
  { title: 'Tools', description: 'Your global command shelf. Run Install or Update explicitly and see the result.', chapter: 'tools' },
  { title: 'Agent rules', description: 'Edit shared rules and references. Preview managed changes before syncing to your agents.', chapter: 'rules' },
  { title: 'Settings', description: 'Choose one configuration file. Add project folders and import or export your setup.', chapter: 'settings' },
];

function Arrow({ down = false }: { down?: boolean }) {
  return <svg className={down ? 'arrow arrow--down' : 'arrow'} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

export default function App() {
  useEffect(() => { document.title = 'AFK 2.0 — Bring the right skills to work'; }, []);

  return <div className="home-app">
    <SiteLink className="skip" href="#main">Skip to content</SiteLink>
    <header className="site-header"><div className="nav-shell">
      <SiteLink className="brand" href="/" aria-label="AI Field Kit home"><AfkMark /><strong>afk.</strong><span className="version-tag">2.0</span></SiteLink>
      <nav className="desktop-nav" aria-label="Main navigation"><SiteLink href="#how-it-works">How it works</SiteLink><SiteLink href="/docs">Documentation</SiteLink><SiteLink href={repository}>GitHub</SiteLink></nav>
      <SiteLink className="button button--small header-cta" href="/docs">Get AFK 2.0</SiteLink>
      <Menu.Root>
        <Menu.Trigger className="mobile-menu-trigger" aria-label="Open navigation"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></Menu.Trigger>
        <Menu.Portal><Menu.Positioner className="site-menu-positioner" sideOffset={12} align="end"><Menu.Popup className="site-menu" aria-label="Main navigation"><Menu.LinkItem href="/#how-it-works">How it works</Menu.LinkItem><Menu.LinkItem href="/docs">Documentation</Menu.LinkItem><Menu.LinkItem href={repository}>GitHub</Menu.LinkItem><Menu.LinkItem href="/docs">Get AFK 2.0</Menu.LinkItem></Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.Root>
    </div></header>
    <main id="main" tabIndex={-1}>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-grid container">
        <div className="hero-copy"><h1 id="hero-title">Bring the right<br className="hero-break" /> skills to work.</h1><p className="lead">A local field kit for your coding agents. Enable prepared skill groups for a project, or read them on demand.</p><div className="hero-actions"><SiteLink className="button" href="/docs">Get AFK 2.0 <Arrow /></SiteLink><SiteLink className="text-link" href="/docs?chapter=profiles">See how profiles work</SiteLink></div><p className="hero-note">Local web app · Shared profiles · Your own tools</p></div>
        <ProfileExample />
      </div></section>
      <section className="section" id="how-it-works" aria-labelledby="workflow-title"><div className="container">
        <h2 id="workflow-title">Keep it ready.<br />Bring it in when needed.</h2>
        <div className="workflow-grid">
          <article><h3>Enable for the work</h3><p>Choose Global or a project beside a profile. AFK exposes that group’s skills while keeping your everyday setup intact.</p><div className="storage-path"><code>Shared disabled copies</code><Arrow down /><code>Demo Studio / skill links</code><Arrow down /><code>Disable removes owned links</code></div><p className="fine-print">Stored files stay ready for next time.</p><SiteLink className="text-link" href="/docs?chapter=profiles">Understand activation <Arrow /></SiteLink></article>
          <article><h3>Read with your agent</h3><p>Let the agent choose an approach first. Then give it a profile’s instructions when that guidance becomes useful.</p><CommandPanel value="afk profiles use <profile-id>" label="Read the group" /><p className="fine-print">Prints local instructions and resource paths. It doesn’t enable skills or inject another chat.</p><SiteLink className="text-link" href="/docs?chapter=agent">Follow the agent flow <Arrow /></SiteLink></article>
        </div>
      </div></section>
      <section className="section kit-section" aria-labelledby="kit-title"><div className="container"><h2 id="kit-title">A small kit.<br />Clear responsibilities.</h2><div className="feature-ledger">{sections.map((section) => <SiteLink href={`/docs?chapter=${section.chapter}`} key={section.chapter}><h3>{section.title}</h3><p>{section.description}</p><Arrow /></SiteLink>)}</div></div></section>
      <section className="section" aria-labelledby="portable-title"><div className="container portable-grid">
        <div><h2 id="portable-title">Your setup travels.<br />Your files stay local.</h2><p className="section-copy">Put settings.json in a folder your storage provider syncs. Import it on another machine, map the project folders, then prepare the skills you want.</p><p className="fine-print">AFK stores definitions and selected state. Drive or your chosen provider handles sync. Skill files are prepared on each machine.</p><SiteLink className="text-link" href="/docs?chapter=settings">Understand settings and storage <Arrow /></SiteLink></div>
        <div className="settings-sheet"><div className="settings-sheet-title"><AfkMark /><strong>One configuration</strong></div><code>profiles<br />projects<br />tools<br />favorite sources<br />invocation preferences</code><p>settings.json</p></div>
      </div></section>
      <section className="section" aria-labelledby="ownership-title"><div className="container">
        <h2 id="ownership-title">AFK complements<br />the tools you trust.</h2>
        <dl className="ownership-ledger"><div><dt>AFK</dt><dd>Groups, local activation, inspection, invocation preferences, and saved commands.</dd></div><div><dt><SiteLink href="https://github.com/vercel-labs/skills">Skills CLI</SiteLink></dt><dd>Repository preparation and its tracked skill installs and updates.</dd></div><div><dt>Your coding agent</dt><dd>Chooses how to work and reads the instructions you provide. Native controls vary by client.</dd></div></dl>
        <div className="field-note"><strong>A focused 2.0</strong><p>Filesystem activation and Claude/Codex invocation metadata are implemented. Live conversation discovery is still being verified. AFK doesn’t manage rules, hooks, MCP setup, or custom agents.</p></div>
      </div></section>
      <section className="section start-section" aria-labelledby="start-title"><div className="container start-grid">
        <div><h2 id="start-title">Try the new AFK.</h2><p className="section-copy">AFK 2.0 is released. These commands launch a source checkout for testing; use the first-run guide to install the latest published release.</p><CommandPanel value={sourceLaunch} label="From a cloned checkout" /><SiteLink className="button" href="/docs">Open the first-run guide <Arrow /></SiteLink></div>
        <div className="legacy-note"><h3>Coming from AFK 1.x?</h3><p>Want the previous catalogs and setup behavior? Install a pre-2.0 release or fork its tagged source.</p><SiteLink className="text-link" href="/docs?chapter=legacy">Find pre-2.0 releases <Arrow /></SiteLink><SiteLink href="/docs?chapter=legacy#what-changed">Read what changed in 2.0</SiteLink></div>
      </div></section>
    </main>
    <footer className="site-footer"><div className="container footer-grid"><div><strong>afk.</strong><p>A tool from <SiteLink href="https://logbookfordevs.com/">Logbook for Devs</SiteLink>.</p><em>Charting the technical seas, one commit at a time.</em></div><nav aria-label="Footer"><SiteLink href="/docs">Docs</SiteLink><SiteLink href={repository}>GitHub</SiteLink><SiteLink href={`${repository}/releases`}>Releases</SiteLink><SiteLink href="/docs?chapter=legacy">Pre-2.0</SiteLink></nav></div></footer>
  </div>;
}
