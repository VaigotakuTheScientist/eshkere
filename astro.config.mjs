// @ts-check
import { defineConfig } from 'astro/config';

// Deployed as a GitHub Pages project site by default:
//   https://vaigotakuthescientist.github.io/eshkere/
// For a custom domain or user site, override at build time:
//   SITE=https://example.org BASE_PATH=/ npm run build
const site = process.env.SITE ?? 'https://vaigotakuthescientist.github.io';
const base = process.env.BASE_PATH ?? '/eshkere';

/**
 * Rewrite root-relative links inside markdown content ("/our-approach") to
 * include the deploy base path, so editors can write natural site paths.
 * @returns {(tree: any) => void}
 */
function rehypeBaseLinks() {
  const prefix = base.replace(/\/+$/, '');
  /** @param {any} node */
  const walk = (node) => {
    if (node.type === 'element' && node.properties) {
      for (const attr of ['href', 'src']) {
        const value = node.properties[attr];
        if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
          node.properties[attr] = prefix + value;
        }
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  return (tree) => walk(tree);
}

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  markdown: {
    rehypePlugins: [rehypeBaseLinks],
  },
});
