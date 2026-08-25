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
BIS / DOE-OE / future DoD / White House-NSC / Congress / ...
```

**Semantic zoom is not merely camera zoom.** It may change ontology granularity and visual grammar.

---

## 4. Power model

Start from levers, not fame:

1. model development
2. deployment
3. compute
4. infrastructure / energy / grid
5. capital / ownership
6. talent
7. regulation / coercion
8. procurement
9. evaluation / standards
10. coordination
11. agenda / information
12. veto / delay

Current node types include individuals, organizations, states, government bodies, governance bodies, evaluators/standards actors, and infrastructure.

### Provisional tiers

- **Tier 1:** direct frontier control/veto over at least one major lever or decision.
- **Tier 2:** major enabling/constraining power that changes feasibility, cost, speed or incentives but usually requires counterparties/coalitions.
- **Tier 3:** strong indirect, epistemic or agenda power.
- **Contextual / latent:** high power only in a particular scenario or locality.

Prefer `tier + power vector`; do not reduce power to one score.

### Energy is first-class

Do not hide electricity inside `compute`:

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

Local utilities/permitting actors can have narrow but high veto/delay power over a specific frontier-compute site.

---

## 5. Relationship model

Relationships are part of the knowledge model, not decorative lines.

Current edge types include:

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

Each edge should carry affected levers, strength, rationale, sources, confidence and update date.

Only store/display an edge if it materially changes reasoning about power, dependency, substitution, coordination or intervention. Do not ingest every partnership announcement.

Potential later diagnostics: critical-path membership, substitutability, dependency concentration, betweenness/brokerage and scenario-specific veto power. Network metrics are prompts for judgment, not ground truth.

---

## 6. Current public-safe research snapshot — 2026-08-25

Verified Notion research state:

- **32 decision centers**
- **24 typed relationships**

High-priority nodes currently include:

### Frontier / model / cloud
OpenAI; Anthropic; Google DeepMind / Google; Meta; SpaceXAI; Alibaba / Alibaba Cloud / Qwen; ByteDance / Seed; DeepSeek; Microsoft / Azure; Amazon / AWS.

### Semiconductor / compute chokepoints
NVIDIA; TSMC; ASML; SK hynix.

### Energy / grid
SB Energy; Entergy Louisiana; Tennessee Valley Authority (TVA); Memphis Light, Gas and Water (MLGW).

### State / regulation / evaluation
United States federal government; U.S. Bureau of Industry and Security (BIS); U.S. DOE Office of Electricity; China — central AI governance / industrial apparatus; European Commission / EU AI Office; UK AI Security Institute.

### Internal governance
OpenAI Foundation Board; Anthropic Long-Term Benefit Trust.

### Initial individuals
Sam Altman; Dario Amodei; Demis Hassabis; Mark Zuckerberg; Elon Musk; Jensen Huang.

Example dependencies:

```text
OpenAI Foundation Board ──governance──→ OpenAI
Anthropic LTBT ──governance──→ Anthropic
Microsoft / Azure ──cloud/compute──→ OpenAI
Amazon / AWS ──cloud/compute──→ Anthropic / OpenAI
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

These scores/tiers are research hypotheses. **Do not hard-code the entire Notion research database or treat its provisional ratings as permanent truth.** Export/author a deliberately curated public-safe snapshot for the prototype.

---

## 7. Comparable-work lessons

- **BlueDot Impact:** the old AGI Strategy character-card page is not currently retrievable, so do not claim its contents. BlueDot’s current Frontier AI Governance course explicitly includes a `Power, Windows, and Dependencies` unit and a mapping exercise across labs/governments/international bodies. This validates the problem framing.
- **aisafety.com/map:** strong field-orientation precedent; useful for holding a landscape in mind, but not primarily a power/dependency graph.
- **IAPP AI governance ecosystem:** useful stakeholder-role decomposition.
- **MIT AI Governance Map:** useful actor-network/filter precedent.
- **Igarapé AI-GED / Kumu:** useful precedent for one graph with multiple views/filters and optional network diagnostics.
- **Compute-governance work:** useful precedent for treating compute as a concentrated, governable physical stack.

Do not copy any of these mechanically. Universe should be more personalized and question-driven.

---

## 8. First visualization grammar

Build an **authored layered dependency network**, not a generic force-directed hairball.

Conceptual layout:

```text
                 STATE / REGULATION / GOVERNANCE
                    ↓        ↓        ↓

                 FRONTIER MODEL DEVELOPERS
               OpenAI  Anthropic  GDM  Meta ...
                    ↑        ↑        ↑

              CLOUD / COMPUTE ALLOCATION
                 Azure / AWS / ...
                    ↑

        ACCELERATORS / MEMORY / MANUFACTURING
          NVIDIA ← SK hynix   TSMC ← ASML
                    ↑

             ENERGY / GRID / PHYSICAL SITE
       generation → transmission → interconnection
```

Exact geometry should be art-directed for legibility, consistent with the existing authored Universe map philosophy.

### Default state

- start on **Core**;
- organizations/states collapsed;
- show only core/major decision-relevant edges;
- keep critical Tier 2 nodes on important paths;
- visually distinguish source/mechanism of power without conflating it with risk stance;
- selecting a node opens an evidence/profile panel with power vector and relationship rationale.

### First lens switcher

Keep the prototype compact:

- Core
- Full
- People
- Compute + Energy
- Government + Governance

Typed relationship filters can be a secondary control.

### Semantic expansion examples

- OpenAI → Sam Altman + OpenAI Foundation Board
- Anthropic → Dario Amodei + Long-Term Benefit Trust
- United States → BIS + DOE/OE + future specific bodies

---

## 9. Universe integration

The existing cosmic map remains the top-level representation.

A likely path is:

```text
Universe
→ AI Safety
→ Grantmaking & Resource Allocation
→ AI Safety Power Map / Study Key Decision Makers
→ non-cosmic layered dependency map
```

The current `src/universe/data.ts` already contains the Grantmaking area and uses a semantic `contentType` separate from cosmic `kind`; preserve that separation.

The three static reading-resource planets added in Universe v0 were useful plumbing tests but should **not become a precedent for a permanent reading queue**. For this v0.1 patch, remove/retire those static article planets from the Grantmaking system unless a clear landmark rationale emerges; retain Grantmaking OS and the dynamic Current Source behavior.

---

## 10. Implementation boundaries

For the first prototype:

- use a **side branch + PR**; do not work directly on the auto-deploying default branch;
- use a static/public-safe curated snapshot in the repository;
- do not expose private Notion data;
- do not create a generalized Notion sync;
- do not build a universal graph framework or generalized skin engine;
- do not build accounts/backend/multiplayer;
- do not implement stance overlays yet;
- faces are optional for the first engineering pass;
- preserve accessibility, keyboard navigation, reduced-motion behavior, non-WebGL fallback philosophy and existing Universe quality constraints;
- do not rewrite the existing cosmic renderer merely to add this child map.

The child map can be DOM/SVG/Canvas/another appropriate 2D implementation; choose the smallest approach that makes the authored network legible and accessible.

---

## 11. Definition of done for v0.1 prototype

The first prototype is ready for evaluation when:

1. a public-safe AI Safety Power Map can be reached from the existing AI Safety/Grantmaking path;
2. one shared node/edge model powers at least **Core** and **Full**, plus one of People / Compute+Energy / Government+Governance;
3. Core is materially clearer than Full;
4. institutions can expose internal people/governance without duplicating data;
5. core/major typed dependencies are visible and inspectable;
6. clicking a node shows concise rationale/evidence and its main power levers;
7. existing Universe behavior remains intact;
8. the static article planets in Grantmaking are cleaned up in favor of durable/project/current objects;
9. tests/checks cover lens switching, semantic expansion, keyboard access and existing fallbacks;
10. the work is delivered as a PR for review rather than auto-deployed.

Then use it for real reasoning before adding more features.
