# Universe v0 — personal AI Safety world experiment

Status: **current product experiment / implementation brief**.

This document extends, rather than replaces, `docs/universe-map-spec.md`.
The existing map spec remains authoritative for the current cinematic map,
interaction, performance, accessibility and fallback behavior.

If Notion is available, the richer strategic source of truth is the page
`Universe v0 — AI Safety World Experiment` under `ESHKERE Universe — Product Notes & Brainstorm`.

---

## 1. Product question

The current Universe already demonstrates that the ESHKERE homepage can reveal a cinematic, beautiful explorable world.

The next question is broader than “can we add real links?”:

> Can Universe become a personalized cognitive layer that makes real work more motivating to enter and important structures easier to understand?

The first focus is deliberately **one user's real experience**. Generalization to other users comes after we learn which parts are durable and which are personal.

---

## 2. Current role split

For the present user, **Grantmaking OS is the operational/work engine**. It contains the real databases, sources, interventions, people, tasks and decision process.

Universe should not duplicate that system.

Universe currently has two strongest jobs:

1. **Explore / Vibe** — a pleasant, personal interface for entering/focusing on the work.
2. **Map / Think** — representations that make a landscape, system, dependency or mental model easier to hold in mind and reason about.

Treat the rough practical split as a hypothesis, not a metric: most day-to-day work may remain in Grantmaking OS, while Universe earns its place by making entry and thinking unusually good.

---

## 3. Reading is ephemeral unless it becomes a landmark

Issue #1 proved useful technical plumbing: real destinations, semantic `contentType`, long/short labels, navigation depth and fallback parity.

It did **not** prove that a static reading queue belongs in Universe.

Current reading changes over time and is already represented by the dynamic **Current Source** primitive. Do not keep adding article planets merely because an article exists in the Sources database.

A resource should become a permanent map object only if it is a durable landmark in the user's mental model.

Acted on in the v0.1 patch: the three static article planets under Grantmaking
are removed. What remains under that system is Grantmaking OS — the operational
engine — and the AI Safety Power Map, which is a landmark because it is a place
to think rather than a thing to read once.

---

## 4. Universe is a cognitive layer, not a second database

Prefer selective representation over exhaustive mirroring.

Good Universe objects/views are things where spatial or visual structure adds value:

- domains and subdomains
- causal structures
- actor/power networks
- dependencies and bottlenecks
- timelines
- strategic landscapes
- learning maps / skill trees
- active focus / Current Source

Poor candidates are things already better represented as ordinary lists/tables unless there is a real thinking benefit.

---

## 5. Universe is not the cosmic skin

Treat **Universe** as the underlying personalized knowledge/world system.
The current astronomy metaphor is one representation layer.

Possible future representations may include:

- cosmic / space
- library
- nature / ecosystems
- horror / haunted spaces
- city / campus
- network / relationship map
- matrix
- timeline
- detective board
- game map

Working principle:

> **one knowledge model, many representations; representation follows the thinking task**

Do not build a generalized skin engine yet. Establish only the semantic/presentation separation that real experiments need.

### MoM implication

**MoM means map → map, not galaxy → smaller galaxy.**

The highest AI Safety layer may remain cosmic. Entering a specific problem may switch completely to another grammar if that makes the problem easier to understand.

---

## 6. Leading v0.1 candidate: AI Safety power / actor map

The current strongest next thinking-map candidate is the Grantmaking OS intervention `Study Key Decision Makers`.

Goal: map who can materially influence frontier-AI and AI-safety-relevant outcomes, through which levers and dependencies.

This should likely become the first strong non-cosmic child map inside AI Safety.

Before implementation, read:

- `docs/ai-safety-power-map.md`
- the Notion page `Study Key Decision Makers` if available

Research/model first; renderer second.

---

## 7. Technical boundary

Where reasonably cheap, separate:

- **knowledge model** — stable IDs, hierarchy, relations, metadata, semantic types
- **representation** — cosmic/network/matrix/etc positions, morphology, visual type, labels, animation
- **navigation state** — current path/level/selection
- **destination/action** — URL, page, external resource, future internal action

The `contentType` change from Issue #1 is the first minimal step in this direction.

Do not perform a broad refactor solely to satisfy an imagined future skin architecture.

---

## 8. Explicit non-goals

Do not build merely because the long-term product may eventually need it:

- user accounts
- generalized authentication
- a multi-user SaaS backend
- multiplayer/collaboration
- arbitrary LLM-generated production UI
- full Notion/Obsidian synchronization
- exhaustive mirroring of Grantmaking OS
- a universal ontology
- multiple polished skins
- a recommendation engine
- autonomous background agents
- a full learning/gamification system

---

## 9. Preserve existing quality constraints

All existing constraints in `docs/universe-map-spec.md` remain in force unless an explicit later decision changes them.

In particular:

- preserve the current hero at rest;
- preserve cinematic entry/navigation behavior;
- preserve `prefers-reduced-motion` behavior;
- preserve non-WebGL/low-power fallback;
- preserve Current Source behavior/privacy boundary;
- avoid exposing private Notion data;
- keep the map responsive and performant;
- do not rewrite snapshot branches.

For nontrivial experiments, use a side branch + PR because the current default branch auto-deploys.

---

## 10. Evaluation principle

Judge Universe by whether it produces real user value:

- Does the user voluntarily enter through it?
- Does it improve motivation or focus?
- Does a map make an important structure easier to think about?
- Does it reveal relationships/bottlenecks that a list does not?
- Which representation naturally fits the problem?
- What information feels alive/current versus cluttered/static?

The next build should follow observed use and an actual thinking problem, not the longest list of possible features.
