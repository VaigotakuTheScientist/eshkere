import artAurora from '../assets/hero-planet.png';
import artNebula from '../assets/hero-nebula.png';

/**
 * A clickable region baked into the artwork, described in the source
 * image's own pixel coordinates. The hero maps these onto the rendered
 * (object-fit: cover) image at runtime, so they stay on target at every
 * viewport size.
 */
export interface HeroHotspot {
  /** Accessible name — the artwork's own lettering. */
  label: string;
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HeroArtwork {
  id: string;
  /** Shown in the artwork switcher. */
  label: string;
  src: ImageMetadata;
  /**
   * Headline treatment that suits this artwork's backdrop.
   * `silver` — brushed gradient, for artwork with quiet dark space behind
   *            the text. `neon` — chromatic-split glow, for busier or
   *            brighter backdrops that would swallow flat type.
   */
  theme: 'silver' | 'neon';
  /** How the image is anchored while cropping, as CSS object-position. */
  focus: { desktop: string; mobile: string };
  hotspots: HeroHotspot[];
}

/**
 * Hero artworks. Two or more make the switcher appear on the homepage;
 * with one it stays hidden.
 *
 * Hotspot coordinates are measured against each image's own pixels, so a
 * new artwork needs its own set.
 */
export const heroArtworks: HeroArtwork[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    src: artAurora,
    theme: 'silver',
    focus: { desktop: '62% 38%', mobile: '68% 30%' },
    hotspots: [
      {
        label: 'Health first, always — read what health means',
        href: '/our-approach#health-heading',
        x: 560,
        y: 228,
        w: 152,
        h: 110,
      },
      {
        label: 'Level up your life — read what games means',
        href: '/our-approach#games-heading',
        x: 1364,
        y: 532,
        w: 158,
        h: 152,
      },
    ],
  },
  {
    id: 'nebula',
    label: 'Nebula',
    src: artNebula,
    theme: 'neon',
    focus: { desktop: '58% 40%', mobile: '64% 32%' },
    hotspots: [
      {
        label: 'Health first, always — read what health means',
        href: '/our-approach#health-heading',
        x: 533,
        y: 193,
        w: 166,
        h: 105,
      },
      {
        label: 'Level up your life — read what games means',
        href: '/our-approach#games-heading',
        x: 1387,
        y: 583,
        w: 142,
        h: 142,
      },
    ],
  },
];
