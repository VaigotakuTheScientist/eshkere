# AI Safety Power Map — product / implementation brief

Status: **active research-to-visualization brief** for a likely Universe v0.1 Map-of-Maps experiment.

The richer strategic/research source of truth lives in Notion on the page `Study Key Decision Makers` under Grantmaking OS. This repository should keep only the public-safe product model and implementation constraints needed by coding agents.

---

## 1. Goal

Build a map that helps the user reason about **who can materially influence frontier-AI and AI-safety-relevant outcomes, through which levers, and through which dependencies**.

This is not a directory of people who identify as AI safety. It includes actors with power over safety-relevant outcomes even when safety is not their mission: frontier labs, cloud providers, chip/infrastructure actors, energy/grid actors, states, regulators, capital providers, evaluators, safety organizations, etc.

The map should answer questions such as:

- Who can directly change or delay a frontier training/deployment decision?
- Who controls scarce compute or physical infrastructure?
- Who can bring enough electricity online for frontier clusters, and who controls grid connection/permitting?
- Which actors constrain or enable a frontier lab?
- Where can regulation, export controls, procurement or evaluation evidence enter the system?
- Which relationships create chokepoints, dependencies or coordination opportunities?

---

## 2. Model actors through power, not fame

Do not begin from a list of famous faces and infer importance from prominence.

Start from the **power / leverage types**, then map actors who control them:

1. model-development power
2. deployment power
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

Actor classes likely include:

- frontier model developers + leadership
- hyperscalers / cloud / compute allocators
- semiconductor / supply-chain chokepoints
- energy developers / utilities / grid operators / permitting actors
- data-centre developers and physical infrastructure
- great-power governments and key state institutions
- regulators / government technical bodies
- capital providers / boards / major owners
- unusually important technical talent
- independent evaluators / standards bodies
- AI-safety funders / research organizations / field-builders
- public / media / civil society
- international coordination bodies / alliances

People, organizations, states and infrastructure are different node types. Preserve those distinctions.

### Energy is first-class

Do not treat electricity as an invisible input hidden inside `compute`.

Useful stack:

```text
chips
  ↓
servers
  ↓
data centre
  ↓
grid connection / substations / transmission
  ↓
generation + storage
  ↓
permits / regulators
  ↓
usable megawatts
```

A bottleneck at any layer can delay frontier capacity even when a lab has enough money and accelerator supply.

Energy/grid power is often **local and contextual**: a municipal utility may have little global agenda power but substantial veto/delay power over a particular 500 MW–1 GW site.

---

## 3. Separate power from stance

Do not encode ideology into the power hierarchy.

Keep these dimensions independent:

- **power tier / directness**
- **actor type**
- **power vector** (which levers the actor controls)
- **risk stance**
- **development / deployment stance** (precaution ↔ acceleration)
- **governance / coordination stance**
- **observed actions vs public words**
- **relationships / dependencies**
- **confidence + date + sources**

A highly safety-concerned actor may have little direct power. A skeptical or acceleration-oriented actor may have enormous power. The visualization should make that distinction legible.

### Provisional tier meaning

- **Tier 1:** direct frontier control or veto over at least one major lever/decision.
- **Tier 2:** major enabling/constraining power that materially changes cost, speed, feasibility or incentives but usually requires counterparties/coalitions.
- **Tier 3:** strong indirect, epistemic or agenda power.
- **Contextual / latent:** power becomes high only in a scenario or locality such as a crisis, election, accident, export-control change, grid bottleneck, site-permit decision, war, etc.

Prefer `tier + power vector` over one universal score.

---

## 4. Primary visualization hypothesis

The first useful view should be an **actor ↔ lever ↔ dependency network**, not a generic social graph.

Conceptually:

```text
frontier labs / leaders ──→ model development + deployment ──┐
cloud / hyperscalers ─────→ compute allocation ──────────────┤
chips / manufacturing ────→ compute supply ─────────────────┤
energy / grid / permits ──→ usable megawatts ───────────────┤
capital / boards ──────────→ scale + incentives ─────────────┤
top talent ────────────────→ technical capability ───────────┤
states / governments ──────→ regulation/export/procurement ─┤→ frontier AI trajectory
regulators/evaluators ─────→ evidence + standards ───────────┤
safety orgs/funders ───────→ safety capacity / evidence ─────┤
public/media/advocacy ─────→ political/reputational pressure ┘
```

The actual interface may still use faces/logos, but the layout should make **sources of power and dependency** visible.

Possible interaction:

- node size = direct leverage under the selected view
- cluster/position = source of power / institutional arena
- typed edges = executive authority, owns/governs, funds, supplies compute, manufactures, supplies energy/grid access, regulates, evaluates, employs, partners, procures, depends on
- click an actor = evidence-backed profile + power vector
- click a lever = actors who can move it
- overlays = power, risk stance, acceleration/precaution, governance, geography/jurisdiction
- companion table = fast scanning/comparison

Avoid graph spaghetti; show only decision-relevant edges by default.

---

## 5. Map-of-Maps implication

This is intentionally the first strong non-cosmic child-map candidate.

The highest AI Safety level may remain a galaxy in the current skin. Entering `Study Key Decision Makers` should be allowed to switch visual grammar completely into a network / matrix / faces-and-relations interface if that better fits the thinking task.

**MoM means map → map, not galaxy → smaller galaxy.**

Representation follows the question.

---

## 6. Data rules

Before visual implementation, the underlying actor records should support at least:

- stable ID
- display name
- node type (person / organization / state / government body / infrastructure)
- role / institution
- actor class
- provisional power tier + rationale
- power vector
- major decision levers
- important relationships / dependencies
- stance fields (dated + sourced + confidence-weighted)
- concrete actions
- last updated
- public sources

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

Do not infer private beliefs. Public stance claims must be based on attributable evidence and should remain explicitly uncertain where appropriate.

Do not hard-code current political/company roles as timeless facts; this map will need refreshable data.

---

## 7. Product constraints

- Grantmaking OS remains the operational/database system; Universe is a selective cognitive/thinking layer over it.
- Do not mirror a reading queue into Universe. Current reading is ephemeral and already represented by the dynamic Current Source primitive.
- Permanent map objects should earn permanence by being landmarks in the mental model, not simply because they are resources the user once read.
- Preserve the current Universe privacy boundary; do not expose private Notion data on the public site.
- Do not build a generic graph engine or skin system before the first power-map use case proves the need.
- Use a side branch + PR for nontrivial implementation work; the current default branch auto-deploys.

---

## 8. Current v0.1 research state

The structured source of truth in Notion now has two databases under `Study Key Decision Makers`:

- **`AI Safety Power Map — Decision Centers`**
- **`AI Safety Power Map — Relationships`**

### Decision-center seed

Current seed: **23 nodes**.

Initial institutional/state/energy set includes:

- OpenAI
- Anthropic
- Google DeepMind / Google
- Meta
- SpaceXAI
- Microsoft / Azure
- Amazon / AWS
- NVIDIA
- TSMC
- United States federal government
- China — central AI governance / industrial apparatus
- European Commission / EU AI Office
- UK AI Security Institute
- SB Energy
- Entergy Louisiana
- Tennessee Valley Authority (TVA)
- Memphis Light, Gas and Water (MLGW)

Initial individual set:

- Sam Altman
- Dario Amodei
- Demis Hassabis
- Mark Zuckerberg
- Elon Musk
- Jensen Huang

Each row records a provisional tier, qualitative power vector, rationale, key relationships, public evidence, confidence and update date. **Do not copy these scores into code yet.** They are research hypotheses and should remain easy to revise.

### Relationship seed

The relationships database currently has **19 typed edges** spanning:

- executive authority
- cloud / compute
- chip supply
- manufacturing
- energy / grid
- regulation / constraints

Examples include:

```text
Microsoft / Azure ──cloud/compute──→ OpenAI
Amazon / AWS ──cloud/compute──→ Anthropic
Amazon / AWS ──cloud/compute──→ OpenAI
TSMC ──manufacturing──→ NVIDIA
NVIDIA ──chip supply──→ Meta
NVIDIA ──chip supply──→ SpaceXAI
SB Energy ──energy/grid──→ OpenAI
Entergy Louisiana ──energy/grid──→ Meta
TVA ──energy/grid──→ SpaceXAI
MLGW ──energy/grid──→ SpaceXAI
US federal government ──regulates/constrains──→ NVIDIA
EU AI Office ──regulates/constrains──→ OpenAI / Anthropic
```

The important emerging insight is that **usable frontier compute is jointly controlled across several layers**. Money, chips, data centres, electricity, grid connection, permitting and state constraints are complements rather than substitutes.

---

## 9. Next research target

Do **not render yet**.

Stress-test the graph for missing high-leverage nodes and edges, especially:

- Chinese frontier labs and cloud/compute actors;
- US government sub-bodies whose powers differ materially (White House/NSC, Commerce/BIS, DoD, DOE, FERC/state utility regulation where relevant);
- semiconductor chokepoints beyond NVIDIA/TSMC (advanced lithography, HBM, packaging/networking where decision-relevant);
- energy/grid actors for other major frontier sites, including transmission/interconnection/permitting;
- governance boards/ownership nodes when they have authority distinct from the CEO;
- evaluator/funder nodes only where their epistemic or ecosystem power is consequential.

Then identify which nodes/edges behave like **chokepoints** or high-leverage coordination points.

Only after that should the first visual layout be selected.
