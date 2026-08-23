# Eshkere Universe Map — Product & Interaction Spec

Status: **authoritative V1 product spec** for the next Eshkere visual experiment.

This document intentionally contains only product/design decisions that are safe to keep in the public repository. Private Notion content is not a dependency for implementing V1.

The current live hero must remain recoverable from the frozen branch:

`snapshot/pre-universe-map-2026-08-21`

Do not modify that snapshot branch.

---

## 1. Product idea

Eshkere currently opens on the existing full-screen cosmic Earth hero with the phrase:

**MAXIMIZE HEALTH, PLAY GAMES**

The new interaction should reveal that this hero is only the close-up view of a much larger Eshkere universe.

The user can **zoom out** from the current page and discover several galaxies / systems representing major domains or “games.” The experience should feel surprising, cinematic, playful, and genuinely awe-inducing — not like a dashboard decorated with stars.

The interaction must be understandable without requiring the user to know a secret gesture. Trackpad pinch should work where technically reliable, but there must also be obvious alternative controls.

---

## 2. Conceptual taxonomy

### Cosmic grammar

Use these meanings consistently:

- **Universe** = Eshkere as a whole.
- **Core** = non-optional conditions rather than a game.
- **Galaxy** = major game/domain.
- **Star system** = enduring subdomain.
- **Planet** = concrete project/system/destination.
- **Moon** = subproject/output/artifact.
- **Comet** = temporary/current thing that can move over time.
- **Quest route** = a current objective that crosses several domains.
- **Link** = a meaningful relationship/dependency between nodes.

Not every page or note becomes a celestial object. Curate aggressively.

### Universe-level regions for V1

1. **Health Core** — non-optional substrate, visually distinct from the game galaxies.
2. **AI Safety** galaxy — main problem/mission domain.
3. **Power** galaxy — ability to cause outcomes.
4. **Knowledge & Science** galaxy — understanding reality / building knowledge and skill.
5. **Culture & Play** galaxy — fun, beauty, exploration, fiction, games, art, music.

Also support two special objects/layers:

- **Current Source** = comet / transient luminous object.
- **Current Quest** = highlighted route across the universe.

### Health Core

Health is deliberately **not another peer galaxy**. It is the non-optional center/substrate.

First-level systems:

- Physical
- Mental
- Social

### Power galaxy

The four main systems are:

- Capability
- Productivity
- Capital
- Influence

Put **Conversion** at the conceptual/visual center: holding power is different from turning it into outcomes.

Potential destinations/planets later include Power Seeking Human and Eshkere Strategy, but V1 should not overcrowd the map.

### AI Safety galaxy

First-level systems:

- Strategy & Prioritization
- Grantmaking & Resource Allocation
- Fieldbuilding & Coordination
- Governance & Institutions
- Technical Safety & Evaluation
- Communication & Education

Initial concrete destinations that may be represented as planets in V1 or V1.1:

- Grantmaking OS under Grantmaking
- Safe AI Sweden under Fieldbuilding
- Safe AI Denmark under Fieldbuilding
- Fieldbuilding Unconference under Fieldbuilding
- RFPs under Strategy & Prioritization
- Verifiable AI-safety / AI-R&D work under Technical Safety

### Knowledge & Science galaxy

First-level systems:

- Mathematics
- Machine Learning
- Natural & Computational Science
- Philosophy & World Models
- Society & Institutions

Important distinction: learning ML belongs primarily here; applying ML to an AI-safety problem belongs in AI Safety / Technical Safety, with a cross-link.

### Culture & Play galaxy

First-level systems:

- Games
- Fiction
- Music
- Art & Design
- Exploration

This region should feel genuinely playful rather than like another productivity taxonomy.

### Quests

A quest is a route, not a location. It may cross Health, Knowledge, Power, and AI Safety. V1 should support one selected/current quest in principle, but the universe must also work with quests hidden.

---

## 3. Core interaction: close-up hero → universe

The current page is the **near camera state** of the universe. Do not replace it with a separate ordinary page followed by a map page. The experience should feel like the camera physically escapes the current scene.

### Entry controls

Support all of these:

1. **Trackpad pinch inward / zoom-out gesture** when the browser exposes it in a controllable way.
2. **Mouse wheel / trackpad scroll with an explicit “zoom universe” interaction mode** if appropriate.

> **Amended, 2026-08-23.** Both gesture routes were built, shipped and then
> removed as a product decision: scrubbing the reveal with a trackpad made
> entering the map feel like operating a slider, and left visitors parked
> part-way through a transition that only reads as cinematic when it plays.
> Entry and exit are discrete — the hero's view switcher goes in, clicking a
> galaxy flies into it, the breadcrumb comes back out, and `Esc` / **Back to
> the page** leave. The wheel and pinch belong to the browser again.
3. A visible but elegant **“ZOOM OUT” / “EXPLORE THE GAMES”** control for discoverability.
4. Keyboard accessibility: `-` / `+` or equivalent controls, plus an explicit UI control.

Do not make a hidden gesture the only way to enter the universe.

Do not permanently hijack normal browser zoom. If browser pinch behavior cannot be safely intercepted on a platform, fall back to the explicit on-page control rather than creating hostile browser behavior.

---

## 4. Cinematic transition

Target emotion: **“Wait — the whole homepage was inside a larger universe?”**

The transition should take roughly 1.5–2.5 seconds when triggered discretely, but should also map continuously to gesture progress when the input allows it.

### Phase A — Hero detaches (0–20%)

The existing hero remains visually identical at rest.

As zoom-out begins:

- The headline and ordinary UI do not simply vanish. They acquire slight depth separation and begin to drift/fade at different rates.
- CTA text and subtitle fade before the main headline.
- The giant headline holds for slightly longer, then dissolves into luminous particles / dust rather than opacity-fading uniformly.
- Existing clickable hero hotspots stop being interactive only once the transition has clearly begun; avoid accidental clicks during navigation.
- Add extremely subtle parallax between foreground typography, Earth, and far stars.
- Audio is **off by default**. Do not autoplay sound.

### Phase B — Escape velocity (20–45%)

This is the first major “wow” beat.

- Camera accelerates backward.
- Earth visibly shrinks rather than the entire page simply CSS-scaling as one flat rectangle.
- The black frame around the current artwork should disappear into a real/deeper star field.
- A short, tasteful radial star-streak / hyperspace effect appears during peak acceleration.
- Use restrained chromatic bloom / lens distortion around the brightest sources, especially the existing star and Earth rim.
- The current Earth image should transition seamlessly into the representation used by the wider scene. If the exact 2D artwork cannot become a real 3D globe, use a well-designed crossfade/morph that hides the seam during acceleration.
- The current “Current Source” shining star may peel away from the Earth scene and become the luminous **Current Source comet** in the wider map. This is a signature transition if feasible.

### Phase C — Local system reveal (45–70%)

- The hero Earth is now one object in a local cluster.
- Curved orbit traces / energy lines become visible.
- Nearby stars emerge from darkness with depth and scale, not all at once.
- Labels remain mostly hidden. Let the user first perceive the scale.
- Camera speed eases as the map begins to resolve.

### Phase D — Universe resolves (70–100%)

- The five top-level regions become legible.
- Health Core is visually distinct and structurally central/substrate-like.
- The four game galaxies occupy a balanced but non-grid composition.
- Galaxy names fade/track in only after the galaxies themselves are recognizable.
- A minimal universe HUD appears only at the end: current zoom level, recenter/home, search/map controls if needed.

The final view must remain beautiful with all labels hidden. Labels are secondary to the cosmic composition.

---

## 5. Universe visual direction

The current Eshkere palette and hyperpop/cosmic identity remain the DNA.

### Desired qualities

- Hyperpop cosmic art
- Awe / enormous scale
- Black void with saturated electric highlights
- Deep parallax
- High contrast
- Beautiful bloom and luminous dust
- Slight surrealism / impossible astronomy is welcome
- Cute/playful micro-details among otherwise epic scale
- Not NASA realism
- Not generic “corporate metaverse”
- Not a literal educational astronomy simulator

### Health Core

Health should not look like “galaxy #5.”

Preferred visual concept: a bright, warm, living **core / heart-star / life nucleus** whose energy threads subtly reach toward the other regions. It should feel foundational rather than dominant/imperial.

Three primary satellites/arcs may represent Physical, Mental, Social.

### Game galaxies

Each major galaxy gets a distinct morphology rather than only a different color:

- **AI Safety** — structured, high-energy, partially engineered; hints of networks, lattices, signal beacons, containment rings.
- **Power** — strong gravitational/lensing feel; multiple streams converging toward a conversion core; dynamic and kinetic.
- **Knowledge & Science** — elegant spirals, geometric constellations, mathematical filaments, crystalline/diagrammatic hints.
- **Culture & Play** — most playful and weird: irregular neon clouds, pixel-like stars, stickers/glyphs, surreal small shapes, more visual jokes.

Avoid assigning each galaxy one flat brand color. They should share the same universe while having recognizable visual personalities.

---

## 6. Depth and navigation

The universe is multi-scale.

### Zoom level 0 — Hero / Earth close-up

Current site.

### Zoom level 1 — Universe overview

Show only:

- Health Core
- AI Safety
- Power
- Knowledge & Science
- Culture & Play
- Current Source comet if active
- Current Quest route if enabled

### Zoom level 2 — Galaxy focus

Click/tap a galaxy and smoothly fly into it.

Reveal that galaxy’s star systems. Other galaxies become dim contextual objects rather than disappearing entirely.

### Zoom level 3 — System focus

Reveal planets/projects and selected cross-links.

### Zoom level 4 — Destination

Clicking a concrete project either:

- opens its existing external/internal page, or
- transitions to a dedicated Eshkere project page when one exists.

Do not implement infinite semantic zoom in V1. Three meaningful map depths plus destination navigation is enough.

---

## 7. Galaxy selection effect

Selecting a galaxy should feel like flying, not opening an accordion.

Sequence:

1. Selected galaxy subtly brightens and rotates / breathes.
2. Background galaxies dim and gain depth blur.
3. Camera follows a curved path toward the selection rather than a straight linear scale-up.
4. Star trails compress into stable points as the camera arrives.
5. System labels resolve only near the end.
6. Relevant cross-links pulse once, then become subtle.

A second click / Enter on a selected object may zoom further in.

Esc / Back / explicit breadcrumb zooms out one semantic level.

---

## 8. Links and Obsidian-like graph behavior

Do **not** show the full relationship graph by default.

Default: quiet, beautiful space.

On hover/selection:

- related nodes gain a halo;
- a small number of curved filaments animate into view;
- unrelated objects dim slightly;
- cross-galaxy links may arc across the void.

Curate links. No graph spaghetti.

Initial relation semantics may include:

- supports
- builds
- informs
- enables
- applies to
- coordinates

The relation label does not need to be permanently visible; show it in detail/hover UI when useful.

---

## 9. Current Source comet

The existing Notion-driven Current Source feature should evolve naturally into the universe.

At hero zoom, the current shining-star hotspot continues to work exactly as it does now.

During zoom-out, if feasible, the star transforms/peels away into a moving luminous comet in the universe.

In universe view:

- it is visually distinct from permanent taxonomy nodes;
- hovering reveals `Currently reading: <title>`;
- clicking opens the generated Current Source URL;
- when the Notion-driven generated source changes after deployment, the comet’s target/title changes without manual code edits.

Do not expose any additional private Notion data.

---

## 10. Quest-route visual language

Quest routes are temporary highlighted paths through permanent geography.

When a quest is selected:

- the route appears as a luminous curved thread linking relevant nodes;
- nodes on the quest gain a subtle pulse/ring;
- each step may have a small ordinal marker or progress state later;
- the route should look like a navigational trajectory, not a dependency graph.

V1 can ship without editable quest data. The architecture should merely avoid making quest routes impossible later.

---

## 11. Motion design rules

The site may be extravagant, but motion needs discipline.

Use:

- slow breathing of galaxies
- sparse shooting stars
- subtle particle drift
- gravitational lensing / shimmer
- motion parallax
- bloom that reacts to transitions
- occasional micro-surprises

Avoid:

- everything constantly moving
- aggressive screen shake
- excessive motion blur
- unreadable neon everywhere
- particles covering navigation targets
- long unskippable animations
- strobing

Respect `prefers-reduced-motion`: provide a beautiful reduced-motion version using crossfades/scales without rapid flight/streak effects.

---

## 12. Performance and technical direction

The emotional goal is high-end, but the implementation should remain robust.

Preferred approach for the universe layer: **WebGL / Three.js or an equivalently capable renderer**, integrated as a focused interactive island in the existing Astro site. A pure DOM graph should not be chosen merely because it is easier if it cannot achieve the desired depth/scale.

However:

- keep the current hero fast and immediately renderable;
- lazy-load the heavy universe renderer after the first view is usable;
- do not block first paint on WebGL;
- provide a graceful non-WebGL / low-power fallback;
- cap device pixel ratio where necessary;
- pause or reduce animation when the tab is hidden;
- target smooth interaction on ordinary modern laptops, not only gaming hardware;
- do not add a large physics simulation for layout; positions should be art-directed / deterministic.

The map should be an authored composition, not a force-directed graph.

---

## 13. Responsive behavior

Desktop / trackpad gets the richest interaction.

Mobile must still be first-class:

- use touch pinch where practical;
- always provide visible zoom controls;
- support drag/pan;
- labels should adapt rather than overlap;
- avoid tiny planets/hit targets;
- if full 3D quality is too expensive, reduce particle count/post-processing before sacrificing clarity.

---

## 14. V1 scope

V1 is primarily an **interaction and visual prototype**, not a complete ontology database.

Ship/test:

- current hero unchanged at rest;
- seamless zoom-out transition;
- Health Core + four game galaxies;
- galaxy labels;
- click/fly into at least one galaxy;
- representative first-level star systems in all galaxies;
- a few actual AI Safety destinations, especially Grantmaking OS;
- Current Source preserved and represented in the wider scene;
- basic selective relationship lines;
- zoom-out / zoom-in / back navigation;
- reduced-motion and non-WebGL fallback.

Do not spend V1 effort populating every planet, moon, note, or relation.

The first success criterion is: **does entering the universe feel awesome enough that people want to explore it?**

---

## 15. Product constraints / non-goals

- Do not redesign or degrade the existing hero at rest.
- Do not expose private Notion content.
- Do not require a secret trackpad gesture.
- Do not create a generic graph visualization.
- Do not use force-directed layout as the main aesthetic.
- Do not turn the site into a conventional card/dashboard UI during zoom-out.
- Do not implement sound autoplay.
- Do not make a galaxy for every topic.
- Do not make career goals/organizations peer domains when they are quests/destinations.
- Do not remove or break the existing Notion Current Source automation.

---

## 16. Implementation workflow

Before implementation, the coding agent should:

1. inspect the current repository and existing hero/hotspot architecture;
2. read this document completely;
3. preserve the rollback snapshot branch;
4. propose the smallest technical architecture capable of achieving the cinematic target;
5. implement the universe as an experimental feature without making irreversible architectural changes;
6. verify the existing site continues to work at rest;
7. test desktop Chrome at minimum, plus mobile/reduced-motion fallback behavior.

When implementation begins, prefer a separate feature branch such as `feature/universe-map` rather than experimenting directly on the frozen snapshot.
