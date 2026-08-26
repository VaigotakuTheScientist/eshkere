/**
 * Lenses over the one graph.
 *
 * A lens is a *selection*, never a dataset. Every one of these reads the same
 * `actors` and `relationships` arrays, so Core and Full can disagree about
 * what is worth showing but never about what is true.
 */

import { actorById, actors, relationships, type Actor, type Relationship } from './model';

export type LensId =
  | 'core'
  | 'institutions'
  | 'full'
  | 'people'
  | 'compute-energy'
  | 'government';

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
   * Which internals this lens wants revealed. Every admitted institution
   * holding a matching child is opened when the lens is chosen.
   *
   * A predicate rather than a list of ids on purpose: a lens about people
   * should surface the people that are modelled, not the people someone
   * remembered to enumerate. Model a seventh individual and the People lens
   * shows them without this file changing.
   */
  opens?(child: Actor): boolean;
}

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
    id: 'institutions',
    label: 'Institutions',
    purpose:
      'The structural view: organizations, states, governance bodies and infrastructure, each left closed. Who depends on whom, before asking who inside them decides.',
    // People are what this lens is deliberately not about. Governance bodies
    // are admitted but stay folded, because nothing opens them here.
    admits: (actor) => actor.type !== 'person',
  },
  {
    id: 'full',
    label: 'Full',
    purpose:
      'Everything in the snapshot at once: every decision centre, including the people and governance bodies inside institutions.',
    admits: () => true,
    // Genuinely everything. Without this the lens rendered the same closed
    // institutions as the structural view and quietly hid a third of the
    // actors it claimed to show.
    opens: () => true,
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
    // Every institution that holds a modelled individual or governance body,
    // which is what "opened at once" has to mean for the purpose to be true.
    opens: (child) => child.type === 'person' || child.type === 'governance-body',
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
    opens: (child) => child.type === 'governance-body' || child.type === 'government-body',
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

/**
 * Which institutions a lens opens the moment it is chosen — derived from the
 * model, so it cannot drift out of step with what is actually in it.
 */
export function initialExpansion(lensId: LensId): Set<string> {
  const lens = lensById.get(lensId);
  const open = new Set<string>();
  if (!lens?.opens) return open;
  for (const actor of actors) {
    if (!actor.parent || !lens.opens(actor)) continue;
    const parent = actorById.get(actor.parent);
    if (parent && lens.admits(parent) && lens.admits(actor)) open.add(parent.id);
  }
  return open;
}

/** Every edge touching an actor, for its detail panel. */
export function relationshipsFor(actorId: string): Relationship[] {
  return relationships.filter((edge) => edge.from === actorId || edge.to === actorId);
}

/** The other end of an edge, for naming it in prose. */
export function counterpart(edge: Relationship, actorId: string): Actor | undefined {
  return actorById.get(edge.from === actorId ? edge.to : edge.from);
}
