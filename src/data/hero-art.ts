import artNebula from '../assets/hero-nebula.png';
import currentSource from './current-source.generated.json';

/**
 * A clickable region baked into the artwork, described in the source
 * image's own pixel coordinates. The hero maps these onto the rendered
 * (object-fit: cover) image at runtime, so they stay on target at every
 * viewport size.
 *
 * `shape` and `rotate` exist so the hover lighting traces the mark the
 * artist actually drew — a circle for the round badge, a tilted rounded
 * rectangle for the plaque — rather than a generic upright box.
 */
export interface HeroHotspot {
  /** Accessible name — the artwork's own lettering. */
  label: string;
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: 'circle' | 'plaque';
  /** Degrees of tilt, matching the artwork. Positive turns clockwise. */
  rotate?: number;
}

/**
 * Where the artist drew the globe, as fractions of the source image: centre
 * as a fraction of width/height, radius as a fraction of height. Measured by
 * fitting a circle to the rim highlight.
 *
 * Nothing on the hero itself uses this — it is what lets the universe map
 * turn the artwork's rectangle into the artwork's planet without a seam.
 */
export interface HeroPlanet {
  cx: number;
  cy: number;
  r: number;
}

/** The private page the artwork's green smiley points at, on every artwork. */
export const GRANTMAKING_OS_URL =
  'https://app.notion.com/p/vadymsulzhenko/Grantmaking-OS-3c275628fc8381239c0ec4e75f6d686f';

/**
 * Where the smiley sits on the globe's visible face, in unit-disc
 * coordinates — the frame the universe map's planet shader draws in.
 *
 * Derived from the hotspot the artist's smiley already has, so the mark is
 * defined once and the two renderings cannot drift apart.
 */
export function markFace(art: HeroArtwork): { x: number; y: number; r: number } | null {
  const mark = art.hotspots.find((spot) => spot.href === GRANTMAKING_OS_URL);
  if (!mark) return null;
  const width = art.src.width;
  const height = art.src.height;
  const aspect = width / height;
  // The mask that closes around the globe, matching src/universe/hero.ts.
  const closed = art.planet.r * 1.06;
  const u = (mark.x + mark.w / 2) / width;
  const v = 1 - (mark.y + mark.h / 2) / height;
  return {
    x: ((u - art.planet.cx) * aspect) / closed,
    y: (v - (1 - art.planet.cy)) / closed,
    r: mark.w / 2 / height / closed,
  };
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
  planet: HeroPlanet;
  hotspots: HeroHotspot[];
}

/**
 * The bright four-point star on each planet points at whatever source is
 * checked `Current` in the private Notion Sources database. Title and URL
 * come from current-source.generated.json, which CI overwrites from Notion
 * before every build (see scripts/fetch-current-source.mjs); the committed
 * copy is a placeholder so local builds and typechecks still work.
 *
 * The geometry differs per artwork because each image draws its star in a
 * different place, so it is passed in rather than shared.
 */
function currentSourceStar(
  geometry: Pick<HeroHotspot, 'x' | 'y' | 'w' | 'h'>
): HeroHotspot[] {
  const { title, url } = currentSource;
  // A malformed generated file should drop the hotspot, never emit an empty href.
  if (!title || !url) return [];
  return [{ label: `Currently reading: ${title}`, href: url, shape: 'circle', ...geometry }];
}

/**
 * The hero artwork.
 *
 * Kept as a list because hotspot geometry is measured against a specific
 * image's own pixels — a different artwork needs its own set, and having
 * more than one here is what a comparison switcher would be built from.
 * Only the first is ever shown.
 */
export const heroArtworks: HeroArtwork[] = [
  {
    id: 'nebula',
    label: 'Nebula',
    src: artNebula,
    theme: 'neon',
    focus: { desktop: '58% 40%', mobile: '64% 32%' },
    planet: { cx: 0.7134, cy: 0.5946, r: 0.5643 },
    hotspots: [
      {
        label: 'Health first, always — read what health means',
        href: '/our-approach#health-heading',
        x: 543,
        y: 199,
        w: 152,
        h: 100,
        shape: 'plaque',
        rotate: -16,
      },
      {
        label: 'Level up your life — read what games means',
        href: '/our-approach#games-heading',
        x: 1389,
        y: 577,
        w: 142,
        h: 142,
        shape: 'circle',
      },
      {
        label: 'Grantmaking OS',
        href: GRANTMAKING_OS_URL,
        x: 1047,
        y: 421,
        w: 34,
        h: 34,
        shape: 'circle',
      },
      ...currentSourceStar({ x: 1332, y: 256, w: 60, h: 60 }),
    ],
  },
];
