import { createRef, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { AnimatedBeam } from '@/components/ui/animated-beam.tsx';
import { AfkMark } from '@/components/ui/svgs/afkMark.tsx';
import { CodexDark } from '@/components/ui/svgs/codexDark.tsx';
import { ClaudeAiIcon } from '@/components/ui/svgs/claudeAiIcon.tsx';
import { OpencodeDark } from '@/components/ui/svgs/opencodeDark.tsx';
import './agent-routing.css';

const agents = [
  { name: 'Codex', Icon: CodexDark },
  { name: 'Claude', Icon: ClaudeAiIcon },
  { name: 'OpenCode', Icon: OpencodeDark },
  { name: 'Custom path', Icon: AfkMark },
];
function BeamDiagram({ paused }: { paused: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [agentRefs] = useState(() => agents.map(() => createRef<HTMLDivElement>()));
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const active = visible && !paused && !reducedMotion;
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  const beamProps = { containerRef, active, duration: 4, pathWidth: 2, pathColor: 'var(--beam-track)', pathOpacity: .45, gradientStartColor: 'var(--beam-start)', gradientStopColor: 'var(--beam-stop)' };
  return <section className="beam-diagram" aria-label="One kit. Every agent.">
    <div className="beam-heading"><h2>One kit. Every agent.</h2><p>Shared standards in. Agent-specific setup out.</p></div>
    <div className="beam-stage" ref={containerRef}>
      <div className="beam-input" ref={inputRef}><span className="beam-input-icon"><AfkMark /></span><strong>Your kit</strong><small>Rules + skills<br />Hooks + tools</small></div>
      <div className="beam-core" ref={coreRef}><AfkMark /><strong>AFK</strong></div>
      {agents.map(({ name, Icon }, index) => <div ref={agentRefs[index]} className={`beam-agent beam-agent--${index}`} key={name}><span className="beam-agent-icon"><Icon /></span><strong>{name}</strong></div>)}
      <AnimatedBeam {...beamProps} fromRef={inputRef} toRef={coreRef} />
      {agents.map(({ name }, index) => <AnimatedBeam {...beamProps} key={name} fromRef={coreRef} toRef={agentRefs[index]} delay={index * .35} />)}
    </div>
    <p className="beam-manifest">Rules · Skills · Hooks · MCPs · Plugins</p>
  </section>;
}

export function AgentRouting() {
  const [paused, setPaused] = useState(false);
  return <div className="route-map agent-routing">
    <BeamDiagram paused={paused} />
    <div className="beam-footer"><span>Illustrated setup routes</span><button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Resume motion' : 'Pause motion'}</button></div>
  </div>;
}
