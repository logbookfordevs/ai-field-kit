export function siteDestination(href: string | undefined, location: { pathname: string; search: string }): string | null {
  if (!href) return null;
  if (href.startsWith('#')) return `${location.pathname}${location.search}${href}`;
  if (href === '/' || /^\/docs\/?(?:[?#]|$)/.test(href)) return href;
  return null;
}

export function scrollRestorationKey(location: { key: string; pathname: string; search: string; hash: string }): string {
  return location.key === 'default' ? `${location.pathname}${location.search}${location.hash}` : location.key;
}
