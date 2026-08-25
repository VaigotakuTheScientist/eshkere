/**
 * Where the layered dependency network puts things.
 *
 * This is the representation layer, and the only file that knows the map is
 * drawn as rows and columns. A matrix or a timeline over the same actors
 * would replace this file and leave `model.ts` alone.
 *
 * Deliberately authored, not force-directed. Arenas are fixed rows in the
 * order the stack actually depends on itself, and within a row an actor's
 * position comes from an authored ordering rather than from a simulation —
 * so the same lens always renders the identical picture, and the picture can
 * be reasoned about rather than merely looked at.
 */

import type { Actor, Arena } from './model';

export interface ArenaRow {
  id: Arena;
  label: string;
  /** Which way dependency flows through this row, for the axis annotation. */
  note: string;
}

/**
 * Top to bottom: authority pushes down onto the developers, and everything
 * below them is a supply chain pushing up.
 */
export const ARENAS: ArenaRow[] = [
  { id: 'state', label: 'State / regulation / governance', note: 'conditions below' },
  { id: 'authority', label: 'People & internal governance', note: 'authority over below' },
  { id: 'developers', label: 'Frontier model developers', note: 'the decisions in question' },
  { id: 'cloud', label: 'Cloud / compute', note: 'supplies above' },
  { id: 'silicon', label: 'Accelerators / memory / manufacturing', note: 'supplies above' },
  { id: 'energy', label: 'Energy / grid / physical site', note: 'supplies above' },
];

/**
 * Authored left-to-right order within each row.
 *
 * Chosen so that dependants sit roughly above their dependencies: NVIDIA
 * under the developers it feeds, TSMC under NVIDIA, ASML under TSMC. Ids not
 * listed fall to the end in model order, which keeps a new actor visible
 * rather than silently unplaced.
 */
const ORDER: string[] = [
  // state
  'china-governance',
  'us-federal',
  'bis',
  'doe-oe',
  'eu-ai-office',
  'uk-aisi',
  // people & internal governance
  'sam-altman',
  'openai-foundation-board',
  'dario-amodei',
  'anthropic-ltbt',
  'demis-hassabis',
  'mark-zuckerberg',
  'elon-musk',
  'jensen-huang',
  // developers
  'openai',
  'anthropic',
  'google-deepmind',
  'meta',
  'spacexai',
  'alibaba',
  'bytedance',
  'deepseek',
  // cloud
  'microsoft-azure',
  'aws',
  // silicon
  'nvidia',
  'tsmc',
  'asml',
  'sk-hynix',
  // energy
  'sb-energy',
  'entergy-louisiana',
  'tva',
  'mlgw',
];

const RANK = new Map(ORDER.map((id, index) => [id, index]));

export interface PlacedActor {
  actor: Actor;
  /** Row index in `ARENAS`, after empty rows are dropped. */
  row: number;
  /** 0…1 across the row. */
  t: number;
}

export interface Placement {
  rows: ArenaRow[];
  placed: PlacedActor[];
  byId: Map<string, PlacedActor>;
}

/**
 * Place a lens's actors.
 *
 * Empty arenas are dropped rather than left as blank bands, and the actors in
 * a row are spread evenly across it in authored order. Spreading rather than
 * pinning to absolute columns is what lets Core and Full both look composed:
 * a fixed grid would leave Core full of holes where Full's extra actors were.
 */
export function place(actors: Actor[]): Placement {
  const inArena = new Map<Arena, Actor[]>();
  for (const actor of actors) {
    const list = inArena.get(actor.arena) ?? [];
    list.push(actor);
    inArena.set(actor.arena, list);
  }

  const rows = ARENAS.filter((arena) => (inArena.get(arena.id)?.length ?? 0) > 0);
  const placed: PlacedActor[] = [];

  rows.forEach((arena, row) => {
    const list = (inArena.get(arena.id) ?? []).slice().sort((a, b) => {
      const ra = RANK.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = RANK.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    list.forEach((actor, index) => {
      placed.push({ actor, row, t: (index + 0.5) / list.length });
    });
  });

  return { rows, placed, byId: new Map(placed.map((entry) => [entry.actor.id, entry])) };
}
