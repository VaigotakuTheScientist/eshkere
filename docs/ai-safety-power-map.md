# AI Safety Power Map — product / implementation brief

Status: **active research-to-visualization brief** for a likely Universe v0.1 Map-of-Maps experiment.

The richer strategic/research source of truth lives in Notion on the page `Study Key Decision Makers` under Grantmaking OS. GitHub should keep only the public-safe product model and implementation constraints needed by coding agents.

---

## 1. Goal

Build a map system that helps the user reason about **who can materially influence frontier-AI and AI-safety-relevant outcomes, through which levers, and through which dependencies**.

This is not a directory of people who identify as AI safety. It includes actors with power over safety-relevant outcomes even when safety is not their mission: frontier labs, governance bodies, cloud providers, semiconductor actors, energy/grid actors, states, regulators, evaluators, capital providers and others.

Useful questions include:

- Who can directly change or delay a frontier training/deployment decision?
- Who controls scarce compute or physical infrastructure?
- Which actors sit on critical supply/dependency paths?
- Who can bring enough electricity online for a frontier cluster?
- Where do export controls, regulation, governance boards or evaluation evidence enter the system?
- Where are single points of failure, substitutes and coordination opportunities?

---

## 2. One semantic graph, many map lenses

**Do not build separate maintained datasets for a Tier-1 map, people map, organization map, supply-chain map, etc.**

Maintain one semantic graph:

```text
decision centers + typed relationships + evidence
                       ↓
                  saved lenses
```

A lens chooses:

- which nodes are visible;
- which relationships are visible;
- what level of abstraction is collapsed/expanded;
- which metric/stance overlay is active;
- which visual grammar is appropriate for the question.

An update to a node/edge should propagate to every lens.

### Recommended lens family

1. **Core Power Map — likely default**
   - smallest useful system view;
   - Tier 1 actors **plus structurally critical lower-tier actors on important dependency paths**;
   - should answer “what do I need in view to understand where consequential power actually sits?”

2. **Tier 1 only — diagnostic**
   - useful research filter for most-direct power;
   - do not assume it is the best explanatory overview.

3. **Full Power Map**
   - all curated decision centers + high-confidence decision-relevant edges;
   - deep research mode, not necessarily first screen.

4. **Institutions & Infrastructure**
   - collapse individuals into organizations/states/governance/infrastructure;
   - likely the cleanest structural view.

5. **People**
   - expand individuals with meaningful personal authority, technical leverage, coordination power or agenda power;
   - faces may be useful here.

6. **Compute + Energy Stack**
   - lithography → foundry/packaging/memory → accelerators → cloud/data centers → grid/interconnection → generation/storage → usable compute.

7. **Government + Governance**
   - states, specific agencies, regulators/evaluators and internal corporate governance bodies.

8. **Relationship / Dependency view**
   - emphasize typed edges and critical paths;
   - relationship visibility should also work as an overlay in other views.

9. **Scenario / question lens**
   - temporary focused subgraph for a concrete question such as:
     - “Who could materially delay OpenAI’s next frontier training run?”
     - “Who controls this compute path?”
     - “Who matters if HBM becomes binding?”
     - “Who could constrain a deployment decision?”

10. **Stance overlays**
    - risk concern, precaution ↔ acceleration, governance stance, actions-vs-words, geography/jurisdiction;
    - normally overlays, not separate structural datasets.

Later possibilities: physical/geographic infrastructure map and historical/time snapshots.

---

## 3. Semantic zoom / collapse-expand

The same real-world actor can appear at different ontology granularity depending on the question.

Example:

```text
OpenAI                         # collapsed institution
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

## 10. Product / implementation constraints

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

## 11. Next research-before-render step

**Do not render yet.**

1. finish only the most consequential missing nodes/edges rather than aiming for completeness;
2. derive a provisional **Core Power Map** from power tier + critical dependency structure;
3. stress-test collapse/expand for institutions vs people/governance;
4. choose 2–3 concrete questions the first visualization must make easier to answer;
5. then select the first visual grammar and implementation scope.

The visualization should be a view over a model we actually believe, not a taxonomy invented because it looks nice.
