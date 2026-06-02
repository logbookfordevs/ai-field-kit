import { useEffect, useRef, useState } from 'react';
import { ClaudeAiIcon } from '@/components/ui/svgs/claudeAiIcon.jsx';
import { CodexDark } from '@/components/ui/svgs/codexDark.jsx';
import { CursorDark } from '@/components/ui/svgs/cursorDark.jsx';
import { Gemini } from '@/components/ui/svgs/gemini.jsx';
import { KilocodeDark } from '@/components/ui/svgs/kilocodeDark.jsx';
import { Opencode } from '@/components/ui/svgs/opencode.jsx';

const installCommand = 'npx skills add https://github.com/logbookfordevs/ai-field-kit';

const fullSetupCommand = 'npm install -g @logbookfordevs/afk\nafk setup --dry-run';

const kitLayers = [
  {
    index: '01',
    title: 'Rules',
    text: 'Shared AGENTS.md instructions for how your coding assistants should behave across projects and tools.',
  },
  {
    index: '02',
    title: 'Skills',
    text: 'Reusable expertise modules for debugging, documentation, motion, design critique, and spec shaping.',
  },
  {
    index: '03',
    title: 'Workflows',
    text: 'Slash-command playbooks for repeatable jobs like code review, PR descriptions, TypeScript checks, and landing page builds.',
  },
  {
    index: '04',
    title: 'MCP registry',
    text: 'Recommended MCP entries that AFK previews, resolves locally, and delegates to the upstream installer.',
  },
];

const flowSteps = [
  {
    label: 'Brainstorm',
    title: 'Find options',
    text: 'Generate directions before the work collapses into the obvious first idea.',
  },
  {
    label: 'Interview',
    title: 'Clarify scope',
    text: 'Turn fuzzy requests into execution-ready boundaries and non-goals.',
  },
  {
    label: 'Tradeoffs',
    title: 'Choose deliberately',
    text: 'Name the UX and implementation costs before code starts to harden.',
  },
  {
    label: 'Elicit',
    title: 'Refine the draft',
    text: 'Pressure-test plans, docs, and answers with visible critique.',
  },
];

const agents = [
  ['Gemini CLI / Antigravity', 'Yes', 'Yes', 'Yes'],
  ['Codex', 'Yes', 'Yes', 'Yes'],
  ['OpenCode', 'Yes', 'Yes', 'Yes'],
  ['Claude', 'Yes', 'Partial', 'Yes'],
  ['Cursor', 'Partial', 'Yes', 'Partial'],
  ['KiloCode', 'Yes', 'Yes', 'Planned'],
];

const agentIcons = [
  { label: 'Gemini CLI', icon: Gemini, tone: 'light' },
  { label: 'Codex', icon: CodexDark, tone: 'dark' },
  { label: 'Claude', icon: ClaudeAiIcon, tone: 'light' },
  { label: 'Cursor', icon: CursorDark, tone: 'light' },
  { label: 'OpenCode', icon: Opencode, tone: 'light' },
  { label: 'KiloCode', icon: KilocodeDark, tone: 'dark' },
];

const supportLinks = [
  ['Ko-fi', 'https://ko-fi.com/logbookfordevs'],
  ['Coffee', 'https://ko-fi.com/logbookfordevs?amount=5'],
  ['Lunch', 'https://ko-fi.com/logbookfordevs?amount=15'],
  ['Dinner', 'https://ko-fi.com/logbookfordevs?amount=30'],
  ['Buy Me a Coffee', 'https://buymeacoffee.com/logbookfordevs'],
];

const tabs = [
  {
    id: 'skills',
    label: 'Skills only',
    text: 'No clone required. Install from GitHub with the skills CLI and choose the agents you want during the picker.',
    command: installCommand,
    copyLabel: 'Copy skills install command',
  },
  {
    id: 'full',
    label: 'Full setup',
    text: 'Install the AFK CLI from npm, then preview detected rules, skills, MCP, utility, and hook targets before anything writes to your machine.',
    command: fullSetupCommand,
    copyLabel: 'Copy full setup commands',
  },
];

function CopyButton({ value, label, children = 'Copy', variant = 'dark', size = 'default', onCopy }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onCopy(value)}
      className={[
        'inline-flex items-center justify-center rounded-[8px] border font-extrabold transition duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9502f]',
        size === 'compact' ? 'min-h-9 px-3 py-2 text-xs' : 'min-h-11 px-4 py-3 text-sm',
        variant === 'light'
          ? 'border-[#201a16] bg-transparent text-[#201a16] hover:border-[#b9502f] hover:text-[#7f351f]'
          : 'border-[#fffaf06b] bg-[#fffaf014] text-[#fffaf0] hover:bg-[#fffaf026]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function copyWithSelectionFallback(value) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto 0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

function App() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const copyToClipboard = async (value) => {
    window.clearTimeout(toastTimer.current);

    let copied = false;

    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      copied = copyWithSelectionFallback(value);
    }

    setToast(copied ? 'Copied command' : 'Copy unavailable in this browser');
    toastTimer.current = window.setTimeout(() => setToast(''), 1800);
  };

  const selectTab = (tabId) => {
    setActiveTab(tabId);
  };

  const handleTabKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const lastIndex = tabs.length - 1;
    const nextIndex = {
      ArrowLeft: index === 0 ? lastIndex : index - 1,
      ArrowRight: index === lastIndex ? 0 : index + 1,
      Home: 0,
      End: lastIndex,
    }[event.key];
    const nextTab = tabs[nextIndex];
    selectTab(nextTab.id);
    document.getElementById(`${nextTab.id}-tab`)?.focus();
  };

  const activePanel = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const isSingleLineInstall = !activePanel.command.includes('\n');

  return (
    <>
      <header className="sticky top-0 z-10 mx-auto flex w-(--content) items-center justify-between bg-[#f7efe2e0] px-6 py-[18px] backdrop-blur-[14px] max-[720px]:flex-col max-[720px]:items-start max-[720px]:px-4">
        <a href="#top" aria-label="AI Field Kit home" className="flex items-center gap-3 text-base font-extrabold tracking-[0.01em] no-underline">
          <span className="grid size-9 place-items-center rounded-full border border-[#201a16] bg-[#18221f] font-mono text-[0.74rem] text-[#f7efe2]">AFK</span>
          <span>AI Field Kit</span>
        </a>
        <nav className="flex items-center gap-3 max-[720px]:mt-2 max-[720px]:w-full max-[720px]:flex-wrap" aria-label="Primary navigation">
          {[
            ['Kit', '#kit'],
            ['Flow', '#flow'],
            ['Install', '#quick-start'],
            ['Agents', '#agents'],
          ].map(([label, href]) => (
            <a key={label} href={href} className="text-sm font-bold text-[#6f6258] no-underline hover:text-[#b9502f]">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <main id="top">
        <section className="mx-auto grid min-h-[calc(100svh-78px)] w-(--content) grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)] items-center gap-[clamp(36px,6vw,80px)] py-[clamp(44px,7vw,92px)] pb-11 max-[940px]:min-h-0 max-[940px]:grid-cols-1" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">Logbook for Devs</p>
            <h1 id="hero-title" className="mb-6 max-w-[860px] [overflow-wrap:anywhere] font-display text-[clamp(3.5rem,7.2vw,6.35rem)] leading-[0.98] font-bold max-[720px]:text-[clamp(2.75rem,13.4vw,3.55rem)]">
              One field kit for every AI coding agent.
            </h1>
            <p className="mb-7 max-w-[720px] text-[clamp(1.05rem,1.8vw,1.32rem)] text-[#6f6258]">
              Rules, skills, workflows, and MCP configs that stay versioned in one repo, then sync into Gemini, Codex, Claude, Cursor, and the rest of your local agent stack.
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="button-primary" href="https://github.com/logbookfordevs/ai-field-kit" target="_blank" rel="noopener noreferrer">
                Get the kit
              </a>
              <CopyButton value={installCommand} label="Copy install command" variant="light" onCopy={copyToClipboard}>
                Copy install
              </CopyButton>
            </div>
            <dl className="mt-10 grid max-w-[560px] grid-cols-3 gap-px border border-[#d8c7ad] bg-[#d8c7ad] max-[720px]:grid-cols-1">
              {[
                ['4', 'portable layers'],
                ['auto', 'agent targets'],
                ['30s', 'skills install'],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#fffaf0c2] p-[18px]">
                  <dt className="font-display text-[2.4rem] leading-none font-bold text-[#7f351f]">{value}</dt>
                  <dd className="mt-1.5 ml-0 text-[0.82rem] font-bold text-[#6f6258] uppercase">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-[#201a16] bg-[#fffaf0] shadow-[0_18px_45px_rgba(63,45,27,0.14)]" aria-label="Terminal-inspired sync map">
            <div className="flex justify-between gap-3 bg-[#18221f] px-3.5 py-3 font-mono text-[0.78rem] text-[#f7efe2]">
              <span>afk setup</span>
              <span>status: ready</span>
            </div>
            <div className="p-[18px]">
              <div className="mb-4 grid grid-cols-2 gap-2">
                {['ai-field-kit', 'rules', 'skills', 'workflows', 'mcps'].map((item, index) => (
                  <span
                    key={item}
                    className={[
                      'rounded-[8px] border border-[#d8c7ad] px-2.5 py-2.5 font-mono text-[0.78rem]',
                      index === 0 ? 'col-span-2 bg-[#b9502f] font-bold text-[#fffaf0]' : 'bg-[#fff6e6] text-[#18221f]',
                    ].join(' ')}
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="mb-4 grid grid-cols-6 gap-2 max-[1100px]:grid-cols-3 max-[940px]:grid-cols-2" aria-label="Supported agent harnesses">
                {agentIcons.map(({ label, icon: Icon, tone }) => (
                  <span key={label} className="flex min-h-[58px] items-center justify-center rounded-[8px] border border-[#d8c7ad] bg-[#fff6e6] px-2.5 py-2.5" title={label} aria-label={label}>
                    <Icon aria-hidden="true" className={tone === 'dark' ? 'size-7 rounded-[6px] bg-[#18221f] p-1 text-white' : 'size-7'} />
                  </span>
                ))}
              </div>
              <pre className="overflow-x-auto rounded-[8px] bg-[#18221f] p-[18px] font-mono text-[0.82rem] leading-[1.75] whitespace-pre-wrap text-[#f9ecd4]"><code>{`$ npm install -g @logbookfordevs/afk
$ afk setup --dry-run

rules      -> linked
skills     -> installed
workflows  -> rendered
mcps       -> secrets resolved`}</code></pre>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-(--content) grid-cols-[0.9fr_1.2fr] items-end gap-[clamp(24px,5vw,68px)] border-y border-[#d8c7ad] py-[clamp(46px,7vw,78px)] max-[940px]:grid-cols-1" aria-labelledby="problem-title">
          <p className="eyebrow">The daily tax</p>
          <div>
            <h2 id="problem-title" className="heading-xl">Your agents do not share a memory for how you work.</h2>
            <p className="max-w-[720px] text-lg text-[#6f6258]">
              Claude knows your review ritual. Gemini knows your exploration prompts. Codex knows your repo habits. AI Field Kit turns those private tricks into portable project material instead of scattered tool settings.
            </p>
          </div>
        </section>

        <section id="kit" className="section-shell" aria-labelledby="kit-title">
          <SectionHeading eyebrow="What ships in the kit" title="Four layers, one source of truth." id="kit-title" />
          <div className="grid grid-cols-4 gap-3.5 max-[940px]:grid-cols-2 max-[720px]:grid-cols-1">
            {kitLayers.map((layer) => (
              <article key={layer.title} className="flex min-h-[260px] flex-col justify-between rounded-[8px] border border-[#d8c7ad] bg-[#fffaf0c7] p-[22px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <span className="label">{layer.index}</span>
                <div>
                  <h3 className="mb-3 text-[1.18rem] leading-tight font-bold">{layer.title}</h3>
                  <p className="text-[#6f6258]">{layer.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="flow" className="section-shell border-t border-[#d8c7ad]" aria-labelledby="flow-title">
          <SectionHeading
            eyebrow="Spec-driven when it matters"
            title="Skills connect into a practical operating system."
            id="flow-title"
            text="Use the smallest useful slice for the moment: branch wide, clarify intent, lock trade-offs, then strengthen the artifact before implementation."
          />
          <div className="grid grid-cols-4 gap-px border border-[#d8c7ad] bg-[#d8c7ad] max-[940px]:grid-cols-2 max-[720px]:grid-cols-1">
            {flowSteps.map((step) => (
              <article key={step.label} className="min-h-[260px] bg-[#fffaf0] p-[22px]">
                <span className="label">{step.label}</span>
                <strong className="mt-[42px] mb-3 block font-display text-[1.9rem] leading-none">{step.title}</strong>
                <p className="text-[#6f6258]">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="quick-start" className="section-shell border-y border-[#d8c7ad]" aria-labelledby="quick-title">
          <SectionHeading eyebrow="Quick start" title="Install the useful part first." id="quick-title" />
          <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-[18px] max-[940px]:grid-cols-1">
            <div className="grid content-start gap-2" role="tablist" aria-label="Install options">
              {tabs.map((tab, index) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`${tab.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`${tab.id}-panel`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={[
                      'rounded-[8px] border px-4 py-3.5 text-left text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9502f]',
                      isActive ? 'border-[#201a16] bg-[#fffaf0] text-[#201a16]' : 'border-[#d8c7ad] bg-[#fffaf0a6] text-[#6f6258] hover:border-[#201a16] hover:text-[#201a16]',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div id={`${activePanel.id}-panel`} role="tabpanel" aria-labelledby={`${activePanel.id}-tab`} className="rounded-[8px] border border-[#d8c7ad] bg-[#fffaf0] p-[clamp(20px,3vw,32px)] shadow-[0_18px_45px_rgba(63,45,27,0.14)]">
              <p className="text-[#6f6258]">{activePanel.text}</p>
              <div className="relative mt-[18px]">
                <pre className="overflow-x-auto rounded-[8px] bg-[#18221f] py-5 pr-[86px] pl-5 font-mono text-[0.82rem] leading-[1.75] whitespace-pre-wrap text-[#f9ecd4]"><code>{activePanel.command}</code></pre>
                <div className={['absolute right-3', isSingleLineInstall ? 'top-1/2 -translate-y-1/2' : 'top-3'].join(' ')}>
                  <CopyButton value={activePanel.command} label={activePanel.copyLabel} size="compact" onCopy={copyToClipboard}>
                    Copy
                  </CopyButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="agents" className="section-shell" aria-labelledby="agents-title">
          <SectionHeading eyebrow="Compatibility" title="Built for multi-agent developers." id="agents-title" />
          <div className="grid overflow-x-auto border border-[#d8c7ad] bg-[#fffaf0] shadow-[0_18px_45px_rgba(63,45,27,0.14)]" role="table" aria-label="Supported agent capabilities">
            <div className="grid min-w-[620px] grid-cols-[minmax(190px,1.5fr)_repeat(3,minmax(92px,0.5fr))] bg-[#18221f] font-mono text-[0.78rem] text-[#fffaf0] uppercase" role="row">
              {['Agent', 'Rules', 'Workflows', 'MCP'].map((heading) => (
                <span key={heading} role="columnheader" className="border-l border-[#d8c7ad] p-4 first:border-l-0">
                  {heading}
                </span>
              ))}
            </div>
            {agents.map(([agent, rules, workflows, mcp]) => (
              <div key={agent} className="grid min-w-[620px] grid-cols-[minmax(190px,1.5fr)_repeat(3,minmax(92px,0.5fr))] border-t border-[#d8c7ad]" role="row">
                {[agent, rules, workflows, mcp].map((value, index) => (
                  <span key={`${agent}-${value}-${index}`} role="cell" className="border-l border-[#d8c7ad] p-4 first:border-l-0 first:font-extrabold">
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex w-(--content) items-center justify-between gap-8 rounded-[8px] border border-[#201a16] bg-[#eadbc6] p-[clamp(28px,5vw,46px)] shadow-[0_18px_45px_rgba(63,45,27,0.14)] max-[940px]:grid" aria-labelledby="support-title">
          <div>
            <p className="eyebrow">Sustain the work</p>
            <h2 id="support-title" className="heading-xl">Useful local tooling should feel shareable.</h2>
            <p className="mb-0 max-w-[680px] text-[#6f6258]">If AI Field Kit saves you setup time, support Logbook for Devs or open a pull request with the next useful skill.</p>
          </div>
          <div className="flex max-w-[360px] flex-wrap gap-3">
            {supportLinks.map(([label, href]) => (
              <a key={label} className={label === 'Ko-fi' ? 'button-primary' : 'button-secondary'} href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
            <a className="button-secondary" href="https://github.com/logbookfordevs/ai-field-kit" target="_blank" rel="noopener noreferrer">Open GitHub</a>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-(--content) justify-between gap-6 py-10 text-sm text-[#6f6258] max-[720px]:flex-col">
        <div className="max-w-[440px]">
          <p className="m-0">
            A tool from the <a href="https://logbookfordevs.com/" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">Logbook for Devs</a>.
          </p>
          <p className="mt-1 mb-0 font-display text-lg leading-tight text-[#201a16]">Charting the technical seas, one commit at a time.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a href="https://github.com/logbookfordevs/ai-field-kit" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">Repository</a>
          <a href="https://github.com/logbookfordevs/ai-field-kit/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">Changelog</a>
          <a href="#quick-start" className="underline-offset-4 hover:underline">Install</a>
        </div>
      </footer>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={[
          'pointer-events-none fixed right-[18px] bottom-[18px] z-20 max-w-[min(320px,calc(100vw-36px))] rounded-[8px] border border-[#201a16] bg-[#18221f] px-3.5 py-3 font-extrabold text-[#fffaf0] shadow-[0_18px_45px_rgba(63,45,27,0.14)] transition duration-200',
          toast ? 'translate-y-0 opacity-100' : 'translate-y-2.5 opacity-0',
        ].join(' ')}
      >
        {toast}
      </div>
    </>
  );
}

function SectionHeading({ eyebrow, title, id, text }) {
  return (
    <div className="mb-9 grid grid-cols-[0.85fr_1fr] items-end gap-[clamp(20px,4vw,56px)] max-[940px]:grid-cols-1">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="heading-xl">{title}</h2>
      </div>
      {text ? <p className="max-w-[720px] text-lg text-[#6f6258]">{text}</p> : null}
    </div>
  );
}

export default App;
