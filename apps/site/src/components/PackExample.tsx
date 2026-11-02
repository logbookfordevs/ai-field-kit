import { useState } from 'react';
import { CommandPanel } from '@/components/CommandPanel.tsx';
import { SiteLink } from '@/SiteLink.tsx';

type ExampleTarget = 'Global' | 'Demo Studio';

export function PackExample() {
  const [target, setTarget] = useState<ExampleTarget>('Demo Studio');
  const [activation, setActivation] = useState<Record<ExampleTarget, boolean>>({ Global: false, 'Demo Studio': false });
  const [showsReading, setShowsReading] = useState(false);
  const isOn = activation[target];
  const isGlobal = target === 'Global';
  const toggleLabel = `Turn ${isOn ? 'off' : 'on'} ${isGlobal ? 'globally' : 'in project'}`;
  const availability = isOn ? `On ${isGlobal ? 'globally' : `in ${target}`}` : 'Off · skills stored and ready';

  return <div className="pack-example">
    <div className="paper-stack">
      <div className="paper-tab" aria-hidden="true">Keep it ready.</div>
      <div className="pack-sheet">
        <div className="pack-sheet-top"><strong>Kit · Packs</strong><span>Interactive example</span></div>
        <div className="pack-sheet-title"><h2>Video tools</h2><span>3 skills</span></div>
        <ul className="example-members" aria-label="Illustrative pack skills"><li>Composition</li><li>Rendering</li><li>Review</li></ul>
        <div className="example-activation"><label htmlFor="example-target">Turn on for</label><select id="example-target" value={target} onChange={(event) => setTarget(event.target.value as ExampleTarget)}><option>Demo Studio</option><option>Global</option></select><button type="button" className="button button--small" onClick={() => setActivation((current) => ({ ...current, [target]: !current[target] }))}>{toggleLabel}</button></div>
        <p className="example-state" data-enabled={isOn} role="status" key={availability}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="m6.5 10 2.3 2.3 4.7-4.6" /></svg>{availability}</p>
        <div className="example-reading"><div><strong>Read once</strong><p>The pack stays off.</p></div><button className="button button--outline button--small" type="button" aria-expanded={showsReading} aria-controls="example-reading" onClick={() => setShowsReading(!showsReading)}>Use with your agent</button></div>
        {showsReading && <div id="example-reading" className="example-instructions"><p>In AFK, copy the pack’s command and ask your agent to run:</p><CommandPanel value="afk packs use 'Video tools'" label="Example syntax" /><SiteLink href="/docs?chapter=agent">See the complete agent flow</SiteLink></div>}
      </div>
    </div>
    <p className="example-caption">Try it here. This example changes no files or settings.</p>
  </div>;
}
