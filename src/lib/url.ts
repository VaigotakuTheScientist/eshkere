/**
 * Prefix an internal path with the configured base path so links keep
 * working when the site is served from a GitHub Pages subdirectory.
 */
export function url(path: string): string {
  // Absolute and scheme-relative destinations are already complete.
  if (/^(https?:)?\/\//i.test(path) || /^(mailto|tel):/i.test(path)) return path;

  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  if (path === '/') return `${base}/`;
  return base + (path.startsWith('/') ? path : `/${path}`);
}
