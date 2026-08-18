/**
 * Site-wide configuration.
 *
 * Contact destinations are deliberately `null` until real ones exist.
 * A `null` value renders an honest "details forthcoming" state — never a
 * fabricated address. Fill these in when Eshkere has real channels.
 */
export const siteConfig = {
  name: 'Eshkere',
  tagline: 'Maximize Health, Play Games.',
  description:
    'Eshkere is an early-stage exploratory organization built around one idea: health is the non-optional foundation of human flourishing, and everything layered on top of it is a game worth playing well.',

  /** Email or URL for partnership enquiries. `null` = not yet established. */
  partnershipContact: null as string | null,

  /** Email or URL for press enquiries. `null` = not yet established. */
  pressContact: null as string | null,

  /** Confirmed social profiles only. Empty = none are published yet. */
  socialLinks: [] as { label: string; url: string }[],
};
