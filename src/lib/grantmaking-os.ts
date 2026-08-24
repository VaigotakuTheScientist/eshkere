/**
 * Grantmaking OS has two addresses.
 *
 * The public template is the one the site publishes: the portfolio, the map's
 * catalogue entry, the text index and every crawler get it. The private
 * working copy is the page the template was cut from, and exactly one thing
 * points at it — the green smiley the artist drew on the hero's globe, which
 * has always been a shortcut rather than a citation.
 *
 * Which one the smiley opens is decided in the browser, not at build time, by
 * a flag the owner sets once in their own console:
 *
 *   localStorage.setItem('eshkere.owner', 'true')
 *
 * The private URL sits in public source deliberately. The page behind it is
 * permission-protected, so the address is not the secret — access is.
 */

export const GRANTMAKING_OS_TEMPLATE = 'https://vadymsulzhenko.notion.site/grantmaking-os-template';
export const GRANTMAKING_OS_PRIVATE = 'https://app.notion.com/p/3c275628fc8381239c0ec4e75f6d686f';

/** The one key this site keeps in a visitor's browser. */
export const OWNER_KEY = 'eshkere.owner';

/**
 * Whether this browser has been told it is the owner's.
 *
 * Storage is unreachable during the build, and throws outright in some
 * private-browsing and embedded contexts, so every answer but a clear "yes"
 * is "no".
 */
export function isOwner(): boolean {
  try {
    return globalThis.localStorage?.getItem(OWNER_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Where the green smiley points, for whoever is looking at it. */
export function grantmakingOsHref(): string {
  return isOwner() ? GRANTMAKING_OS_PRIVATE : GRANTMAKING_OS_TEMPLATE;
}
