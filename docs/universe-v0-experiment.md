# Universe v0 — real AI Safety world experiment

Status: **current product experiment / implementation brief**.

This document extends, rather than replaces, `docs/universe-map-spec.md`.
The existing map spec remains authoritative for the current cinematic map,
interaction, performance, accessibility and fallback behavior. This document
changes the **next product question** from visual spectacle to real utility.

If Notion is available, the richer strategic source of truth is the page
`Universe v0 — AI Safety World Experiment` under `ESHKERE Universe — Product Notes & Brainstorm`.

---

## 1. Product question

The existing Universe proved that the ESHKERE homepage can reveal a cinematic,
beautiful explorable map. The next question is:

> Can Universe represent real knowledge/work well enough that the user
> voluntarily returns to it for studying, thinking and navigation — not merely
> because it looks cool?

Do not answer this by adding broad platform infrastructure. Answer it with one
small, real, end-to-end world.

## 2. First test world

Use **AI Safety** as the first useful world.

Start with the narrowest path that already has real underlying work:

```text
Universe
└── AI Safety
    └── Grantmaking & Resource Allocation
        ├── Grantmaking OS
        ├── selected public-safe resources
        └── other curated real objects when useful
```

Support at least 2–3 meaningful semantic levels and preserve orientation when
moving up/down the hierarchy.

This is the smallest real MoM (Map of Maps) test.

## 3. Real data, not decorative placeholders

At least some nodes must correspond to things the user actually uses.

Good candidates include:

- Grantmaking OS
- selected public-safe Sources / currently reading material
- selected People & Organizations
- selected projects/interventions
- Current Source
- selected public-safe AI Safety notes/resources

Do not populate the map exhaustively. Curate for usefulness.

### Privacy boundary

The public ESHKERE site must not expose private Notion content.

Allowed approaches include:

1. curated public-safe data committed to the repository;
2. a strict build-time allowlist that exports only explicitly approved fields/items;
3. a private/local prototype when richer private data is required.

Do not create a broad generic Notion sync.

## 4. Universe is not the cosmic skin

Treat **Universe** as the underlying personalized knowledge/world system.
The current astronomy metaphor is one representation layer.

Possible future skins/representations may include:

- cosmic / space
- library
- nature / ecosystems
- horror / haunted spaces
- city / campus
- detective board
- game map
- other AI-generated/adapted environments

Working principle:

> **one knowledge model, many skins/world representations**

Do **not** build a generalized skin engine in v0. The goal now is architectural
separation, not multiple themes.

Avoid making semantic concepts depend on astronomical names/types where a
neutral model would be equally cheap.

Prefer:

```text
knowledge model
      ↓
navigation/state
      ↓
cosmic representation  ← current renderer
```

rather than storing the knowledge model as "galaxy/star-system/planet" objects
when those terms are only presentation.

A future representation layer could instead map the same node hierarchy to
wings/shelves/books, forests/rivers/trees, rooms/corridors/artifacts, etc.

## 5. Required experience

The test user should be able to:

1. enter AI Safety from Universe;
2. move into at least one meaningful subdomain;
3. see real objects relevant to current work/study;
4. select a real object and take a useful action (open, inspect, navigate);
5. move back out without losing orientation;
6. leave Universe open without distraction or runaway performance cost.

The experience should feel like **using a place**, not browsing a decorative
sitemap.

## 6. Technical boundary to establish now

Where reasonably cheap, separate:

- **knowledge model** — stable IDs, hierarchy, relations, metadata, destinations
- **representation** — cosmic positions, morphology, visual type, labels, animation
- **navigation state** — current path/level/selection
- **destination/action** — URL, page, external resource, future internal action

This is not a refactor-for-refactor's-sake requirement. Do it only to the extent
needed to make the first useful AI Safety path coherent and to avoid obvious
future lock-in.

The map should remain authored/art-directed. Do not replace the current renderer
with a force-directed generic knowledge graph.

## 7. Explicit non-goals

Do not build in v0:

- user accounts
- generalized authentication
- a multi-user SaaS backend
- multiplayer/collaboration
- arbitrary LLM-generated production UI
- full Notion/Obsidian synchronization
- a universal ontology
- mobile apps
- multiple polished skins
- a recommendation engine
- autonomous background agents
- a full learning/gamification system

Preserve reasonable paths to these possibilities, but do not pay their current
complexity cost.

## 8. Preserve existing quality constraints

All existing constraints in `docs/universe-map-spec.md` remain in force unless a
later explicit decision changes them. In particular:

- preserve the current hero at rest;
- preserve cinematic entry/navigation behavior;
- preserve `prefers-reduced-motion` behavior;
- preserve non-WebGL/low-power fallback;
- preserve the Current Source privacy boundary;
- avoid exposing private Notion data;
- keep the map responsive and performant;
- do not rewrite snapshot branches.

Ambient/AFK character work is secondary to this experiment. Add it only if it
is isolated and extremely cheap; do not let it delay real-data utility.

## 9. Definition of done

v0 is ready for evaluation when:

- one real path works end-to-end:
  `Universe → AI Safety → Grantmaking & Resource Allocation → real objects`;
- a small set of real, public-safe objects is represented;
- MoM works across 2–3 semantic levels;
- real destinations/actions are useful;
- existing accessibility/performance/fallback behavior still works;
- the test user can use it in several actual work/study sessions.

## 10. Evaluation

After real sessions, capture answers in Notion rather than hard-coding product
conclusions here:

- Did the user open Universe voluntarily?
- What did they use it to reach/do?
- What was better/worse than direct Notion navigation?
- Did the map improve memory or understanding of relationships?
- Which nodes felt meaningful vs decorative?
- What was distracting/annoying?
- What did the user wish Universe knew about them?
- What personalization request appeared naturally?
- What one feature would most increase repeat use?

The next build should be chosen from observed use, not from the longest list of
future possibilities.
