import artOne from '../assets/hero-planet.png';

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
  hotspots: HeroHotspot[];
}

/**
 * Hero artworks. Add a second entry and the switcher appears on the
 * homepage automatically; with one entry it stays hidden.
 *
 * Hotspot coordinates are measured against each image's own pixels, so a
 * new artwork needs its own set.
 */
export const heroArtworks: HeroArtwork[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    src: artOne,
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
];
