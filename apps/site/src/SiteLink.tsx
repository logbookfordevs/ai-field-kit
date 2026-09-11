import type { ComponentProps } from 'react';
import { Link, useLocation } from 'react-router';
import { siteDestination } from '@/navigation.ts';

export function SiteLink({ href, ...props }: ComponentProps<'a'>) {
  const location = useLocation();
  const to = siteDestination(href, location);
  if (to === null || props.download) return <a href={href} {...props} />;
  return <Link to={to} {...props} />;
}
