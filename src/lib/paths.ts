import { primaryNav, type NavItem } from '../data/nav';

/** Strip the deploy base path and any trailing slash from a pathname. */
export function normalizePath(pathname: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  let path = pathname;
  if (base && path.startsWith(base)) path = path.slice(base.length);
  path = path.replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

function matches(href: string, path: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

/** The primary section a path belongs to, if any. */
export function activeSection(pathname: string): NavItem | undefined {
  const path = normalizePath(pathname);
  return primaryNav.find((item) => matches(item.href, path));
}

/**
 * The active secondary item within a section — the child with the longest
 * matching prefix, so `/research-and-news/blog/foo` activates “Blog”, not
 * “Research & News”.
 */
export function activeChild(section: NavItem, pathname: string): string | undefined {
  const path = normalizePath(pathname);
  let best: { href: string; length: number } | undefined;
  for (const child of section.children ?? []) {
    if (matches(child.href, path) && (!best || child.href.length > best.length)) {
      best = { href: child.href, length: child.href.length };
    }
  }
  return best?.href;
}
