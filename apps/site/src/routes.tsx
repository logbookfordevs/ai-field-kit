import { useLayoutEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation, type RouteObject } from 'react-router';
import App from '@/App.tsx';
import { scrollRestorationKey } from '@/navigation.ts';

function SiteLayout() {
  const location = useLocation();
  const previousKey = useRef(location.key);
  useLayoutEffect(() => {
    if (previousKey.current !== location.key) {
      let target: HTMLElement | null = null;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { /* Malformed fragments have no focus target. */ }
      target ??= document.querySelector('main');
      if (target) {
        if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
    previousKey.current = location.key;
  }, [location]);
  return <><Outlet /><ScrollRestoration getKey={scrollRestorationKey} /></>;
}

export const routes: RouteObject[] = [{
  Component: SiteLayout,
  // Mount scroll restoration only after the initial lazy route can render its headings.
  HydrateFallback: () => <main className="docs-loading" role="status">Loading documentation…</main>,
  children: [
    { path: '/', Component: App },
    {
      path: '/docs',
      lazy: async () => ({ Component: (await import('@/docs/Docs.tsx')).default }),
    },
  ],
}];
