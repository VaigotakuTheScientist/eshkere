# AI Safety Power Map — v0.1 product / implementation brief

Status: **ready for first visualization prototype**.

The richer strategic/research source of truth is the Notion page `Study Key Decision Makers` under Grantmaking OS, including the databases `AI Safety Power Map — Decision Centers` and `AI Safety Power Map — Relationships`.

GitHub should contain only public-safe implementation context. Do not expose private Notion content or build a generic Notion sync.

---

## 1. Product question

Can Universe make the power structure around frontier AI **easier to understand and reason about** than a list/database?

The map should help answer:

1. **Critical path:** what actors could materially enable, constrain, condition, or delay a frontier lab’s next major training/deployment decision?
2. **Shared chokepoints:** which nodes sit on important dependency paths for multiple frontier actors, and how substitutable are they?
3. **Authority:** when we say `OpenAI`, `Anthropic`, `the US`, etc., which important decisions are institutional versus personally/governance controlled?

If the visualization does not make questions like these easier, it is decorative graph software rather than a thinking tool.

---

## 2. One semantic graph, many lenses

**Do not create separate maintained datasets for Tier 1, people, organizations, supply chain, etc.**

Use one semantic model:

```text
decision centers + typed relationships + evidence
                       ↓
                  saved lenses
```

A lens selects visible nodes/edges, abstraction depth, overlays, and representation.

Recommended lens family:

- **Core** — likely default. Smallest useful system view: Tier 1 plus structurally critical lower-tier actors on important dependency paths.
- **Tier 1 only** — diagnostic filter, not necessarily the best overview.
- **Full** — all curated decision centers and high-confidence decision-relevant edges.
- **People** — individuals with meaningful personal authority/technical/coordination/agenda power.
- **Institutions & Infrastructure** — collapsed organizations, states, governance bodies, supply-chain and physical infrastructure.
- **Compute + Energy** — lithography → foundry/memory/accelerators → cloud/data centers → grid/interconnection → generation/storage → usable compute.
- **Government + Governance** — states/agencies/regulators/evaluators plus internal corporate governance bodies.
- **Scenario/question lens** — temporary subgraph for a concrete question.
- **Stance overlays** — risk concern, precaution↔acceleration, governance stance, actions-vs-words, jurisdiction. Keep stance separate from structural power.

Relationships should be filterable/inspectable across lenses, not a separate data universe.

### Core != Tier 1

A Tier-1-only map can hide lower-tier but structurally indispensable nodes such as ASML, TSMC, HBM suppliers, cloud providers or site-specific grid actors.

The default Core lens should preserve important dependency paths even when some nodes are not globally Tier 1.

---

## 3. Semantic zoom / collapse-expand

“Sam Altman roughly equals OpenAI” is useful at one zoom level and false at another.

Model this as **collapse/expand**, not duplicate identities:

```text
OpenAI
  ↓ expand
OpenAI
├── Sam Altman                 # executive authority
├── OpenAI Foundation Board    # governance / appointment authority
└── other internal nodes only when decision-relevant
```

Likewise:

```text
United States federal government
  ↓ expand
BIS / DOE-OE / DoD / White House-NSC / Congress / ...
```

“Sam Altman roughly equals OpenAI” is therefore a **view-level simplification**, not a data-model identity.

Implementation principle:

> **Semantic zoom is not merely camera zoom. It may change the ontology granularity and visual grammar shown to the user.**

Do not duplicate the same fact into independent map objects to achieve this effect.

---

## 4. Model actors through power, not fame

Start from the levers that determine the trajectory, then map who can move them:

1. model development
2. deployment
3. compute allocation
4. physical infrastructure / energy / grid
5. capital / ownership
6. talent
7. regulation / coercion
8. procurement
9. evaluation / standards
10. coordination
11. agenda / information
12. veto / delay

People, organizations, governance bodies, states, government bodies and infrastructure are different node types. Preserve those distinctions.

### Energy is first-class

Do not hide electricity inside `compute`.

```text
chips
  ↓
servers
  ↓
data center
  ↓
grid connection / substations / transmission
  ↓
generation + storage
  ↓
permits / regulators
  ↓
usable megawatts
```

Energy/grid power may be highly contextual: a municipal utility can have little global agenda power but major veto/delay leverage over one specific frontier-compute site.

---

## 5. Separate power from stance

Keep these dimensions independent:

- power tier / directness;
- actor/node type;
- actor class;
- power vector;
- risk stance;
- development/deployment stance;
- governance/coordination stance;
- observed actions vs public words;
- relationships/dependencies;
- confidence/date/sources.

A safety-concerned actor may have little power. An acceleration-oriented actor may have enormous power.

### Provisional power tiers

- **Tier 1:** direct frontier control or veto over at least one major lever/decision.
- **Tier 2:** major enabling/constraining power that changes cost, speed, feasibility or incentives but usually requires counterparties/coalitions.
- **Tier 3:** strong indirect, epistemic or agenda power.
- **Contextual / latent:** power becomes high in a particular scenario or locality.

Prefer `tier + power vector` over one universal score.

**Core Map != Tier 1 filter.** A lower-tier actor can be structurally indispensable on a critical path.

---

## 6. Relationship model

Relationships are part of the knowledge model, not decorative lines.

Current relationship types include:

- executive authority
- governance / ownership
- cloud / compute
- chip supply
- equipment supply
- memory supply
- manufacturing
- energy / grid
- capital / investment
- regulates / constrains
- evaluates / informs
- procurement / customer
- partnership / coordination

Store/show an edge when it changes how we reason about power, dependency, substitution, coordination or intervention. Do **not** ingest every partnership announcement.

Relationship records should support:

- from actor
- to actor
- typed relationship
- affected levers
- strength
- rationale
- evidence/sources
- confidence
- last updated

Potential later diagnostics:

- critical-path membership
- substitutability
- dependency concentration / single-point-of-failure
- betweenness / brokerage
- scenario-specific veto power

Do not equate network centrality with real-world power automatically. Metrics are prompts for judgment, not ground truth.

---

## 7. Map-of-Maps / Universe implication

This is the first strong non-cosmic child-map candidate.

The highest AI Safety level may remain a galaxy. Entering `Study Key Decision Makers` may switch visual grammar to a network, matrix, faces-and-relations view or another representation chosen for the question.

**MoM means map → map, not galaxy → smaller galaxy.**

This experiment also demonstrates a second MoM primitive: **one graph → many lenses**.

Representation and abstraction level should follow the thinking task.

---

## 8. Current research state — 2026-08-25

Structured source of truth in Notion:

- `AI Safety Power Map — Decision Centers`
- `AI Safety Power Map — Relationships`

Verified current counts:

- **32 decision centers**
- **24 typed relationships**

Current high-priority seed includes:

### Frontier / cloud / model actors
- OpenAI
- Anthropic
- Google DeepMind / Google
- Meta
- SpaceXAI
- Alibaba / Alibaba Cloud / Qwen
- ByteDance / Seed
- DeepSeek
- Microsoft / Azure
- Amazon / AWS

### Semiconductor / compute chokepoints
- NVIDIA
- TSMC
- ASML
- SK hynix

### Energy / grid
- SB Energy
- Entergy Louisiana
- Tennessee Valley Authority (TVA)
- Memphis Light, Gas and Water (MLGW)

### State / regulation / evaluation
- United States federal government
- U.S. Bureau of Industry and Security (BIS)
- U.S. DOE Office of Electricity
- China — central AI governance / industrial apparatus
- European Commission / EU AI Office
- UK AI Security Institute

### Internal governance
- OpenAI Foundation Board
- Anthropic Long-Term Benefit Trust

### Initial individuals
- Sam Altman
- Dario Amodei
- Demis Hassabis
- Mark Zuckerberg
- Elon Musk
- Jensen Huang

Examples of typed dependencies now represented:

```text
OpenAI Foundation Board ──governance──→ OpenAI
Anthropic LTBT ──governance──→ Anthropic
Microsoft / Azure ──cloud/compute──→ OpenAI
Amazon / AWS ──cloud/compute──→ Anthropic
Amazon / AWS ──cloud/compute──→ OpenAI
ASML ──equipment──→ TSMC
TSMC ──manufacturing──→ NVIDIA
SK hynix ──memory──→ NVIDIA
NVIDIA ──accelerators──→ Meta / SpaceXAI
SB Energy ──energy/grid──→ OpenAI
Entergy Louisiana ──energy/grid──→ Meta
TVA / MLGW ──energy/grid──→ SpaceXAI
BIS ──regulates/constrains──→ NVIDIA
EU AI Office ──regulates/constrains──→ OpenAI / Anthropic
```

The major emerging insight remains that **usable frontier compute is jointly controlled across multiple complementary layers**.

Do not copy provisional Notion scores into production code yet; they are research hypotheses and should remain revisable.

---

## 9. Comparable-work lessons

Do not copy these projects mechanically; use them as design precedents.

- **BlueDot Impact:** the old AGI Strategy character-card page is not currently retrievable, so do not claim its card contents. The current Frontier AI Governance course explicitly frames a unit around **Power, Windows, and Dependencies** and asks learners to map who has power across labs, governments and international bodies. This supports the problem framing.
- **aisafety.com/map:** strong field-orientation precedent; useful for keeping organizations/work mentally available, but it is not primarily a power/dependency graph.
- **IAPP AI governance ecosystem:** useful stakeholder-role decomposition; reinforces mapping actors by mechanism/role rather than fame.
- **MIT AI Governance Map:** useful actor-network/filter precedent; different questions can justify different visible subgraphs.
- **Igarapé AI-GED / Kumu / Kumu generally:** useful precedent for one graph with multiple views, filters/focus, node/edge data and optional network diagnostics.
- **Compute-governance work:** useful conceptual precedent for treating compute as a governable stack with concentrated physical chokepoints.

---

## 10. Imagery / identity assets

Imagery should **not block the v0.1 prototype**.

Use image assets as progressive enhancement rather than as a structural dependency.

Recommended asset policy:

- organization/state/governance nodes should work with a clean typographic/logo-free treatment by default;
- people nodes may optionally use headshots, but must have a strong fallback (initials/monogram or other non-photo identity treatment);
- logo/headshot files, when used, should live in the repository under `src/assets/power-map/` rather than being hotlinked from third-party websites;
- keep people and organization imagery in separate folders such as `src/assets/power-map/people/` and `src/assets/power-map/orgs/`;
- add an optional `image` / `imageSrc` field to the semantic node model only if a real asset is used;
- do not require an image for every node;
- prefer SVG for logos when an official/licensed source is available and a modest-size WebP/AVIF/PNG for portraits;
- avoid embedding third-party copyrighted portraits without a clear reusable license or permission;
- do not spend time collecting dozens of assets before the map proves useful.

For the first pass, a sensible image seed is the six currently modeled individuals plus only the most useful institution marks if they materially improve scanning. The Core structural view should remain understandable with **zero imagery**.

---

## 11. Product / implementation constraints

- Grantmaking OS remains the operational/database system; Universe is the selective cognitive/thinking layer.
- Do not mirror a reading queue into Universe.
- Permanent map objects should earn permanence by being landmarks in the mental model.
- Preserve the public/private Notion boundary.
- Do not build a generalized graph engine, skin engine, accounts system or backend platform merely because they might be useful later.
- Do not hard-code current company/political roles as timeless facts.
- Do not infer private beliefs.
- Public stance claims require attributable evidence and should remain explicitly uncertain where appropriate.
- Use a side branch + PR for nontrivial implementation work; the current default branch auto-deploys.

---

## 12. First visualization direction

The research gate is passed for a first prototype.

Use an **authored layered dependency network**, not a generic force-directed graph.

Conceptual arenas:

```text
STATE / REGULATION / GOVERNANCE
             ↓
FRONTIER MODEL DEVELOPERS
             ↑
CLOUD / COMPUTE
             ↑
ACCELERATORS / MEMORY / MANUFACTURING
             ↑
ENERGY / GRID / PHYSICAL SITE
```

Default to organizations/states collapsed. Reveal people/governance through semantic expansion.

First prototype lenses should be limited to:

- Core
- Full
- People
- Compute + Energy
- Government + Governance

Do not build stance overlays yet.

The first visualization should remain deliberately authored and legible on desktop/mobile; do not use a generic force-directed layout merely because the data is a graph.
