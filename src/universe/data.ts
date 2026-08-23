import currentSource from '../data/current-source.generated.json';

/**
 * The authored Eshkere universe.
 *
 * Every position in this file is hand-placed. There is deliberately no
 * force-directed layout: the map is a composition, so the same build always
 * renders the same sky and a node never wanders somewhere unreadable.
 *
 * Cosmic grammar (see docs/universe-map-spec.md §2):
 *   universe = Eshkere · core = the non-optional conditions ·
 *   galaxy = a major game/domain · system = an enduring subdomain ·
 *   planet = a concrete destination · comet = a transient current thing.
 */

/** World-space position, in the universe's own units. */
export type Vec3 = [number, number, number];

/** How a galaxy is drawn. Each region has a morphology, not just a colour. */
export type Morphology = 'core' | 'lattice' | 'vortex' | 'spiral' | 'cloud';

export interface Destination {
  id: string;
  label: string;
  /**
   * Where clicking this planet goes. `null` means the destination exists in
   * the taxonomy but has no page yet — the map says so rather than
   * inventing a link.
   */
  href: string | null;
  /** Offset from the parent system, in world units. */
  offset: Vec3;
  blurb: string;
}

export interface System {
  id: string;
  label: string;
  /** Offset from the galaxy centre, in world units. */
  offset: Vec3;
  blurb: string;
  planets?: Destination[];
}

export interface Region {
  id: string;
  label: string;
  /** Shown under the label once the region is focused. */
  tagline: string;
  morphology: Morphology;
  position: Vec3;
  radius: number;
  /**
   * The colours the region's dust is drawn from, as a ramp. Two or three for
   * a region with one mood; one per system for one that wants each of its
   * parts to be identifiable at a distance.
   */
  palette: string[];
  /**
   * How far a system's label sits from its star, as a fraction of the
   * region's radius. It is world-space, so it holds at every zoom — and it
   * is per-region because it has to clear whatever that region draws around
   * its systems. Culture & Play builds a clump on each of its systems and
   * needs much more room than a galaxy whose dust is evenly spread.
   */
  labelReach?: number;
  /**
   * How far below the region's centre its own name hangs, as a fraction of
   * the radius. A galaxy built as a ring needs its name clear of the ring
   * rather than sitting on whatever is at the bottom of it.
   */
  labelDrop?: number;
  /** Seed for this region's point cloud — stable across builds. */
  seed: number;
  systems: System[];
}

export type RelationKind =
  | 'supports'
  | 'builds'
  | 'informs'
  | 'enables'
  | 'applies to'
  | 'coordinates';

export interface Link {
  from: string;
  to: string;
  kind: RelationKind;
}

/* --------------------------------------------------------------- regions */

/**
 * Health is not galaxy number five. It sits at the origin as a warm core
 * whose three arcs — physical, mental, social — are the substrate the game
 * galaxies are arranged around.
 */
const healthCore: Region = {
  id: 'health',
  label: 'Health Core',
  tagline: 'The non-optional foundation — physical, mental, social.',
  morphology: 'core',
  position: [0, 0, 0],
  radius: 150,
  palette: ['#ffe3ae', '#ff9a6a', '#ff4fc8'],
  seed: 11,
  systems: [
    {
      id: 'health-physical',
      label: 'Physical',
      offset: [-118, -46, 26],
      blurb: 'Sleep, movement, nourishment, a body that works.',
    },
    {
      id: 'health-mental',
      label: 'Mental',
      offset: [96, 84, -18],
      blurb: 'Attention, mood, a mind you can live in.',
    },
    {
      id: 'health-social',
      label: 'Social',
      offset: [34, -122, 8],
      blurb: 'Connection, belonging, people who know you.',
    },
  ],
};

/**
 * The example galaxy for V1 — fully populated, including the real
 * Grantmaking OS destination that already exists on the hero.
 */
const aiSafety: Region = {
  id: 'ai-safety',
  label: 'AI Safety',
  tagline: 'Keeping the foundation standing as powerful systems arrive.',
  morphology: 'lattice',
  position: [-850, 231, -110],
  radius: 240,
  palette: ['#4de3ff', '#9d6bff', '#eaf6ff'],
  seed: 2027,
  systems: [
    {
      id: 'ais-strategy',
      label: 'Strategy & Prioritization',
      offset: [-4, 158, 26],
      blurb: 'Which problems matter most, and what follows from that.',
      planets: [
        {
          id: 'ais-rfps',
          label: 'RFPs',
          href: null,
          offset: [58, 40, 12],
          blurb: 'Requests for proposals that turn priorities into asks.',
        },
      ],
    },
    {
      id: 'ais-grantmaking',
      label: 'Grantmaking & Resource Allocation',
      offset: [152, 62, -22],
      blurb: 'Moving money and attention to the work that needs it.',
      planets: [
        {
          id: 'ais-grantmaking-os',
          label: 'Grantmaking OS',
          href: 'https://app.notion.com/p/vadymsulzhenko/Grantmaking-OS-3c275628fc8381239c0ec4e75f6d686f',
          offset: [62, -34, 20],
          blurb: 'The working system behind how grants get considered.',
        },
      ],
    },
    {
      id: 'ais-fieldbuilding',
      label: 'Fieldbuilding & Coordination',
      offset: [118, -122, 34],
      blurb: 'Growing the number of people who can do the work.',
      planets: [
        {
          id: 'ais-safe-ai-sweden',
          label: 'Safe AI Sweden',
          href: null,
          offset: [70, -30, 8],
          blurb: 'National fieldbuilding, Sweden.',
        },
        {
          id: 'ais-safe-ai-denmark',
          label: 'Safe AI Denmark',
          href: null,
          offset: [30, -74, -14],
          blurb: 'National fieldbuilding, Denmark.',
        },
        {
          id: 'ais-unconference',
          label: 'Fieldbuilding Unconference',
          href: null,
          offset: [-44, -66, 22],
          blurb: 'A gathering format for the people already doing it.',
        },
      ],
    },
    {
      id: 'ais-governance',
      label: 'Governance & Institutions',
      offset: [-138, -112, -30],
      blurb: 'Rules, bodies and incentives around the technology.',
    },
    {
      id: 'ais-technical',
      label: 'Technical Safety & Evaluation',
      offset: [-166, 44, 18],
      blurb: 'Measuring and constraining what systems actually do.',
      planets: [
        {
          id: 'ais-verifiable',
          label: 'Verifiable AI-safety & AI-R&D work',
          href: null,
          offset: [-64, 40, 16],
          blurb: 'Work whose safety claims can be checked, not asserted.',
        },
      ],
    },
    {
      id: 'ais-communication',
      label: 'Communication & Education',
      offset: [22, -16, 92],
      blurb: 'Making the problem legible to people who can act on it.',
    },
  ],
};

const power: Region = {
  id: 'power',
  label: 'Power',
  tagline: 'The ability to cause outcomes — and to convert it into them.',
  morphology: 'vortex',
  position: [668, -358, -250],
  radius: 225,
  palette: ['#ff4fc8', '#ffb992', '#9d6bff'],
  seed: 733,
  systems: [
    {
      id: 'power-conversion',
      label: 'Conversion',
      offset: [0, 0, 0],
      blurb: 'Holding power is not the same as turning it into outcomes.',
    },
    {
      id: 'power-capability',
      label: 'Capability',
      offset: [-146, 92, 24],
      blurb: 'What you can personally do.',
    },
    {
      id: 'power-productivity',
      label: 'Productivity',
      offset: [140, 104, -16],
      blurb: 'How much of it you actually get done.',
    },
    {
      id: 'power-capital',
      label: 'Capital',
      offset: [156, -96, 28],
      blurb: 'Resources you can deploy.',
    },
    {
      id: 'power-influence',
      label: 'Influence',
      offset: [-128, -114, -20],
      blurb: 'Outcomes you can move through other people.',
    },
  ],
};

const knowledge: Region = {
  id: 'knowledge',
  label: 'Knowledge & Science',
  tagline: 'Understanding reality, and getting good at it.',
  morphology: 'spiral',
  position: [-479, -374, 60],
  radius: 210,
  palette: ['#eaf6ff', '#4de3ff', '#c8f542'],
  seed: 314,
  systems: [
    {
      id: 'know-mathematics',
      label: 'Mathematics',
      offset: [-128, 78, 14],
      blurb: 'The language everything else gets written in.',
    },
    {
      id: 'know-ml',
      label: 'Machine Learning',
      offset: [86, 118, -22],
      blurb: 'Learning how these systems work. Applying it to safety lives next door.',
    },
    {
      id: 'know-science',
      label: 'Natural & Computational Science',
      offset: [148, -30, 26],
      blurb: 'How the physical and computational world behaves.',
    },
    {
      id: 'know-philosophy',
      label: 'Philosophy & World Models',
      offset: [-46, -132, 30],
      blurb: 'What is worth wanting, and how we would know.',
    },
    {
      id: 'know-society',
      label: 'Society & Institutions',
      offset: [-150, -60, -18],
      blurb: 'How groups of people actually decide things.',
    },
  ],
};

const culture: Region = {
  id: 'culture',
  label: 'Culture & Play',
  tagline: 'The optional layer — and most of what makes a life worth it.',
  morphology: 'cloud',
  position: [656, 286, 110],
  radius: 200,
  // One colour per system, in the order the systems are declared: the
  // archipelago gives each island its own hue, which is what lets the
  // region be read at overview distance.
  palette: ['#c8f542', '#9d6bff', '#ff4fc8', '#ffb992', '#4de3ff'],
  labelReach: 0.2,
  // Its structure is a ring, so its name has to clear the ring rather than
  // land on the island at the bottom of it.
  labelDrop: 1.25,
  seed: 8080,
  // Laid out as a ring with an open middle, and with the bottom of the ring
  // deliberately left empty — that is where the galaxy's own name hangs.
  // The five used to sit at scattered distances with two of them nearly on
  // top of each other, which is most of why the region read as a pile.
  systems: [
    {
      id: 'culture-games',
      label: 'Games',
      offset: [-111, 142, 30],
      blurb: 'Chosen stakes, learnable rules, the freedom to stop.',
    },
    {
      id: 'culture-fiction',
      label: 'Fiction',
      offset: [111, 142, -30],
      blurb: 'Lives you get to run without living them.',
    },
    {
      id: 'culture-music',
      label: 'Music',
      offset: [171, -56, 26],
      blurb: 'The one that needs no justification at all.',
    },
    {
      id: 'culture-art',
      label: 'Art & Design',
      offset: [-62, -169, -20],
      blurb: 'Making things that did not have to exist.',
    },
    {
      id: 'culture-exploration',
      label: 'Exploration',
      offset: [-177, -31, 44],
      blurb: 'Going and finding out. Often how the discoveries happen.',
    },
  ],
};

export const regions: Region[] = [healthCore, aiSafety, power, knowledge, culture];

/** The four game galaxies, in composition order. Health is not one of them. */
export const galaxies = regions.filter((region) => region.id !== 'health');

/* ----------------------------------------------------------------- links */

/**
 * A curated handful, not the full graph. Links stay invisible until
 * something is hovered or selected — the default view is quiet space.
 */
export const links: Link[] = [
  { from: 'health', to: 'ai-safety', kind: 'supports' },
  { from: 'health', to: 'power', kind: 'supports' },
  { from: 'health', to: 'knowledge', kind: 'supports' },
  { from: 'health', to: 'culture', kind: 'supports' },
  { from: 'know-ml', to: 'ais-technical', kind: 'applies to' },
  { from: 'know-philosophy', to: 'ais-strategy', kind: 'informs' },
  { from: 'know-society', to: 'ais-governance', kind: 'informs' },
  { from: 'power-capital', to: 'ais-grantmaking', kind: 'enables' },
  { from: 'power-influence', to: 'ais-communication', kind: 'enables' },
  { from: 'power-capability', to: 'ais-fieldbuilding', kind: 'coordinates' },
  { from: 'culture-exploration', to: 'know-science', kind: 'informs' },
  { from: 'culture-games', to: 'health-mental', kind: 'supports' },
  { from: 'ais-grantmaking', to: 'ais-grantmaking-os', kind: 'builds' },
];

/* -------------------------------------------------------- special objects */

/**
 * Where the hero artwork comes to rest once the camera has escaped it. The
 * homepage does not get replaced by a picture of itself — the picture keeps
 * being the picture, it just becomes one planet among many.
 */
export const homeWorld = {
  id: 'home',
  label: 'You were here',
  blurb: 'The Eshkere homepage — one close-up inside a much larger map.',
  position: [-168, -154, 170] as Vec3,
  radius: 40,
};

/**
 * The green smiley the artist drew on the globe. It is a link on the hero
 * and it stays one out here: the home world keeps its mark, and the mark
 * keeps its destination.
 */
export const homeMark = {
  id: 'home-mark',
  label: 'Grantmaking OS',
  blurb: 'The working system behind how grants get considered.',
  href: 'https://app.notion.com/p/vadymsulzhenko/Grantmaking-OS-3c275628fc8381239c0ec4e75f6d686f',
};

/**
 * The Current Source comet. Title and destination come from the same
 * generated file the hero star already reads, so a change to the Notion
 * `Current` checkbox moves both without touching this repository.
 * `null` when the generated file is empty or malformed — the comet is then
 * simply absent rather than linking nowhere.
 */
export const currentSourceComet: { title: string; href: string } | null =
  currentSource.title && currentSource.url
    ? { title: currentSource.title, href: currentSource.url }
    : null;

/**
 * Quest routes are not implemented in V1, but the shape they will take is
 * fixed here so adding one later is data, not architecture: an ordered walk
 * across nodes that already exist.
 */
export interface QuestRoute {
  id: string;
  label: string;
  steps: string[];
}

export const quests: QuestRoute[] = [];

/* ---------------------------------------------------------------- lookup */

export interface NodeRecord {
  id: string;
  label: string;
  blurb: string;
  /** Absolute world position, with any parent offsets already applied. */
  position: Vec3;
  /**
   * Where the label sits relative to the node. Galaxy names are pushed
   * clear of their own dust so the brightest part of a region is never
   * hidden by its own caption.
   */
  labelOffset?: Vec3;
  /**
   * A compact form shown at rest. The Current Source comet's real name is a
   * whole article title, which would sit across half the map if it were
   * always drawn in full.
   */
  shortLabel?: string;
  /**
   * The point a label should sit *away* from — its galaxy for a system, its
   * system for a planet. Labels are placed on the far side of their node
   * from this, which pushes them out of the crowded, bright middle of a
   * region and into the darker space around it, where they can be read.
   */
  origin?: Vec3;
  /** Extra clearance in screen pixels, for nodes drawn larger than a point. */
  labelPad?: number;
  /** Draw a leader line from the label back to the node. */
  tether?: boolean;
  kind: 'region' | 'system' | 'planet' | 'home' | 'comet' | 'mark';
  /** Region this node belongs to, for dimming and breadcrumbs. */
  regionId: string;
  href?: string | null;
}

/**
 * Every addressable node, flattened once at module load. The renderer, the
 * labels, the keyboard index and the no-WebGL fallback all read this same
 * list, so they can never disagree about what exists.
 */
export const nodeIndex: NodeRecord[] = (() => {
  const list: NodeRecord[] = [];
  for (const region of regions) {
    list.push({
      id: region.id,
      label: region.label,
      blurb: region.tagline,
      position: region.position,
      // The core's name goes above its nucleus; the galaxies' names below
      // their dust. That keeps the crowded middle of the map readable.
      labelOffset:
        region.id === 'health'
          ? [0, region.radius * 1.2, 0]
          : [0, -region.radius * (region.labelDrop ?? 0.86), 0],
      kind: 'region',
      regionId: region.id,
    });
    for (const system of region.systems) {
      const systemPosition: Vec3 = [
        region.position[0] + system.offset[0],
        region.position[1] + system.offset[1],
        region.position[2] + system.offset[2],
      ];
      // Step the label out along the system's own direction from the galaxy
      // centre, by a distance the galaxy chooses. In world units, so it
      // holds as the camera flies in rather than being a fixed number of
      // pixels that is right at one zoom and wrong at every other.
      const reach = region.radius * (region.labelReach ?? 0.1);
      const span = Math.hypot(system.offset[0], system.offset[1]) || 1;
      list.push({
        id: system.id,
        label: system.label,
        blurb: system.blurb,
        position: systemPosition,
        labelOffset: [
          (system.offset[0] / span) * reach,
          (system.offset[1] / span) * reach,
          0,
        ],
        origin: region.position,
        kind: 'system',
        regionId: region.id,
      });
      for (const planet of system.planets ?? []) {
        list.push({
          id: planet.id,
          label: planet.label,
          blurb: planet.blurb,
          position: [
            systemPosition[0] + planet.offset[0],
            systemPosition[1] + planet.offset[1],
            systemPosition[2] + planet.offset[2],
          ],
          // A planet points away from its own system, not from the galaxy:
          // at that zoom the system star is the thing it must not collide
          // with.
          origin: systemPosition,
          kind: 'planet',
          regionId: region.id,
          href: planet.href,
        });
      }
    }
  }
  list.push({
    id: homeWorld.id,
    // Two forms, one meaning. At rest it says where you are; reach for it and
    // it says what it does, because it is the way back to the page.
    label: `${homeWorld.label} — back to the page`,
    shortLabel: homeWorld.label,
    blurb: homeWorld.blurb,
    position: homeWorld.position,
    // A caption, not a satellite. It hangs straight below the planet from a
    // point on the rim — world-space, so it stays on the rim at every
    // composition scale — with a short leader line across the gap. Placed
    // radially like the galaxies' systems, it drifted to wherever "away
    // from the core" happened to point and read as merely nearby.
    labelOffset: [0, -(homeWorld.radius + 6), 0],
    labelPad: 24,
    tether: true,
    kind: 'home',
    regionId: 'health',
  });
  // Position is rewritten every frame from where the planet is actually
  // drawing its mark, since the planet's face follows the camera.
  list.push({
    id: homeMark.id,
    label: homeMark.label,
    blurb: homeMark.blurb,
    position: [...homeWorld.position] as Vec3,
    origin: [...homeWorld.position] as Vec3,
    kind: 'mark',
    regionId: 'health',
    href: homeMark.href,
  });
  return list;
})();

export const nodeById = new Map(nodeIndex.map((node) => [node.id, node]));
