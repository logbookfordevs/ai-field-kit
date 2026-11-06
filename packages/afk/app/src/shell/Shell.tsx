import { Fragment, useEffect, useRef, type MouseEvent } from "react";
import { Menu } from "@/components/Menu";
import { navigation as defaultNavigation } from "@/screens/registry";
import type { Attention, ScreenDefinition } from "@/screens/types";
import { hrefFor, navigate, useRoute } from "@/shell/router";
import { UpdateStatus } from "@/shell/UpdateStatus";
import "@/shell/Shell.css";

function Flag({ attention }: { attention: Attention }) {
  return <span className={`flag ${attention.tone ?? "attention"}`}>{attention.text}</span>;
}

function NavLink({ screen, current }: { screen: ScreenDefinition; current: boolean }) {
  const attention = screen.useAttention();
  return (
    <a href={hrefFor(screen.id)} aria-current={current ? "page" : undefined}>
      <span>{screen.label}</span>
      {attention ? <> <Flag attention={attention} /></> : null}
    </a>
  );
}

function SectionOption({ screen }: { screen: ScreenDefinition }) {
  const attention = screen.useAttention();
  return <option value={screen.id}>{attention ? `${screen.label} · ${attention.text}` : screen.label}</option>;
}

function Brand({ full = false }: { full?: boolean }) {
  return <div className="brand"><b>afk.</b>{full ? <span>AI Field Kit</span> : null}</div>;
}

/** The app frame: desktop rail, phone top bar, and the current section in <main>. */
export function Shell({ navigation = defaultNavigation }: { navigation?: ScreenDefinition[][] }) {
  const route = useRoute();
  const main = useRef<HTMLElement>(null);
  const screens = navigation.flat();
  const current = screens.find(screen => screen.id === route.screen) ?? screens[0]!;
  const opened = useRef(false);

  useEffect(() => {
    if (!opened.current) { opened.current = true; return; }
    const heading = main.current?.querySelector<HTMLElement>("h1");
    (heading ?? main.current)?.focus({ preventScroll: true });
    scrollTo({ top: 0 });
  }, [current.id]);

  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    main.current?.focus();
  };

  return (
    <>
      <a className="skip" href="#main" onClick={skipToContent}>Skip to content</a>
      <div className="shell">
        <aside className="rail" aria-label="AFK">
          <Brand full />
          <nav className="nav" aria-label="Sections">
            {navigation.map((group, index) => (
              <Fragment key={group[0]?.id ?? index}>
                {index > 0 ? <div className="sep" role="presentation" /> : null}
                {group.map(screen => <NavLink key={screen.id} screen={screen} current={screen.id === current.id} />)}
              </Fragment>
            ))}
          </nav>
          <div className="rail-foot"><UpdateStatus /></div>
        </aside>
        <header className="topbar">
          <Brand />
          <label>
            <span className="vh">Section</span>
            <select value={current.id} onChange={event => navigate(event.target.value as ScreenDefinition["id"])}>
              {screens.map(screen => <SectionOption key={screen.id} screen={screen} />)}
            </select>
          </label>
          <Menu label="More">
            <UpdateStatus />
          </Menu>
        </header>
        <main id="main" ref={main} tabIndex={-1}>
          <current.Screen params={route.params} />
        </main>
      </div>
    </>
  );
}
