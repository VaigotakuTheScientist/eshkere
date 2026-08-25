/**
 * Lenses over the one graph.
 *
 * A lens is a *selection*, never a dataset. Every one of these reads the same
 * `actors` and `relationships` arrays, so Core and Full can disagree about
 * what is worth showing but never about what is true.
 */

import { actorById, actors, relationships, type Actor, type Relationship } from './model';

export type LensId = 'core' | 'full' | 'people' | 'compute-energy' | 'government';

export interface Lens {
  id: LensId;
  label: string;
  /** One line, shown under the switcher, saying what this view is for. */
  purpose: string;
  /**
   * Which actors the lens admits at all. A child still has to have its parent
   * expanded before it appears; this decides whether it is on the lens's
   * subject list in the first place.
   */
  admits(actor: Actor): boolean;
  /**
   * Institutions this lens opens by default. People and governance bodies are
   * hidden until an institution is expanded, so a lens about people has to
   * ask for them.
   */
  expandedByDefault?: string[];
}

/** The institutions whose internals the prototype can reveal. */
export const EXPANDABLE_IDS = ['openai', 'anthropic', 'us-federal'] as const;

export const lenses: Lens[] = [
  {
    id: 'core',
    label: 'Core',
    purpose:
      'The smallest useful system view: the frontier actors plus the lower-tier nodes that are structurally impossible to route around.',
    // A node selection, not an edge selection. Filtering edges by strength
    // was tried and reverted: it hid OpenAI's second cloud supplier, which is
    // precisely the shared-chokepoint fact this map exists to make visible.
    admits: (actor) => actor.tier === 'tier-1' || !!actor.corePath,
  },
  {
    id: 'full',
    label: 'Full',
    purpose: 'Every curated decision centre and typed dependency in the snapshot.',
    admits: () => true,
  },
  {
    id: 'people',
    label: 'People',
    purpose:
      'Where decision authority sits personally rather than institutionally — every modelled institution opened at once.',
    admits: (actor) =>
      actor.type === 'person' ||
      actor.type === 'governance-body' ||
      actor.arena === 'developers' ||
      actor.id === 'nvidia',
    expandedByDefault: ['openai', 'anthropic'],
  },
  {
    id: 'compute-energy',
    label: 'Compute + Energy',
    purpose:
      'Lithography → manufacturing → accelerators → cloud → grid → usable megawatts, with the developers that draw on it.',
    admits: (actor) =>
      actor.arena === 'silicon' ||
      actor.arena === 'cloud' ||
      actor.arena === 'energy' ||
      actor.arena === 'developers',
  },
  {
    id: 'government',
    label: 'Government + Governance',
    purpose:
      'States, agencies and evaluators alongside the internal governance bodies that hold authority inside the labs.',
    admits: (actor) =>
      actor.arena === 'state' ||
      actor.arena === 'developers' ||
      actor.type === 'governance-body',
    expandedByDefault: ['openai', 'anthropic', 'us-federal'],
  },
];

export const lensById = new Map(lenses.map((lens) => [lens.id, lens]));

export const DEFAULT_LENS: LensId = 'core';

/**
 * An edge as drawn. `edge` is always the real relationship; `from`/`to` are
 * where the line actually lands, which differs when an endpoint is currently
 * folded inside a collapsed institution.
 */
export interface DisplayEdge {
  edge: Relationship;
  from: string;
  to: string;
  /** True when one end was rolled up into a collapsed parent. */
  inherited: boolean;
}

export interface Selection {
  actors: Actor[];
  edges: DisplayEdge[];
}

/**
 * Resolve a lens plus a set of opened institutions into what is on screen.
 *
 * A collapsed institution absorbs its children, and it absorbs their
 * dependencies with them: with OpenAI closed, the board's governance edge
 * lands on OpenAI, and with the United States closed, BIS's export-control
 * edge to NVIDIA is drawn from the United States. That is the view-level
 * simplification the brief describes — "Sam Altman roughly equals OpenAI" is
 * true at one zoom and false at another — and it happens here, at display
 * time. The relationship records are never rewritten, and the detail panel
 * always names the real endpoint, so the map cannot come to believe its own
 * simplification.
 */
export function resolve(lensId: LensId, expanded: ReadonlySet<string>): Selection {
  const lens = lensById.get(lensId) ?? lenses[0]!;
  const admitted = new Set(actors.filter((actor) => lens.admits(actor)).map((a) => a.id));

  const visible = new Set<string>();
  for (const actor of actors) {
    if (!admitted.has(actor.id)) continue;
    if (!actor.parent) {
      visible.add(actor.id);
      continue;
    }
    // A child needs an expanded, visible parent. Ancestry is one level deep
    // in this snapshot; `nearestVisible` below does not assume that.
    if (expanded.has(actor.parent) && admitted.has(actor.parent)) visible.add(actor.id);
  }

  /** Walk up until something is actually on screen. */
  const nearestVisible = (id: string): string | null => {
    let cursor: string | undefined = id;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (visible.has(cursor)) return cursor;
      seen.add(cursor);
      cursor = actorById.get(cursor)?.parent;
    }
    return null;
  };

  const edges: DisplayEdge[] = [];
  for (const edge of relationships) {
    const from = nearestVisible(edge.from);
    const to = nearestVisible(edge.to);
    if (!from || !to) continue;
    // Both ends folded into the same box: the dependency is now internal to
    // that box, and drawing it would be a loop on itself.
    if (from === to) continue;
    edges.push({ edge, from, to, inherited: from !== edge.from || to !== edge.to });
  }

  return { actors: actors.filter((actor) => visible.has(actor.id)), edges };
}

/** Which institutions a lens opens the moment it is chosen. */
export function initialExpansion(lensId: LensId): Set<string> {
  return new Set(lensById.get(lensId)?.expandedByDefault ?? []);
}

/** Every edge touching an actor, for its detail panel. */
export function relationshipsFor(actorId: string): Relationship[] {
  return relationships.filter((edge) => edge.from === actorId || edge.to === actorId);
}

/** The other end of an edge, for naming it in prose. */
export function counterpart(edge: Relationship, actorId: string): Actor | undefined {
  return actorById.get(edge.from === actorId ? edge.to : edge.from);
}
