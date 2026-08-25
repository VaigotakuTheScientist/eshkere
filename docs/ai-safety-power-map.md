# AI Safety Power Map — product / implementation brief

Status: **active research-to-visualization brief** for a likely Universe v0.1 Map-of-Maps experiment.

The richer strategic/research source of truth lives in Notion on the page `Study Key Decision Makers` under Grantmaking OS. This repository should keep only the public-safe product model and implementation constraints needed by coding agents.

---

## 1. Goal

Build a map that helps the user reason about **who can materially influence frontier-AI and AI-safety-relevant outcomes, through which levers, and through which dependencies**.

This is not a directory of people who identify as AI safety. It includes actors with power over safety-relevant outcomes even when safety is not their mission: frontier labs, cloud providers, chip/infrastructure actors, states, regulators, capital providers, evaluators, safety organizations, etc.

The map should answer questions such as:

- Who can directly change or delay a frontier training/deployment decision?
- Who controls scarce compute or physical infrastructure?
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
4. physical infrastructure / energy
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
- data-centre / energy / permitting actors
- great-power governments and key state institutions
- regulators / government technical bodies
- capital providers / boards / major owners
- unusually important technical talent
- independent evaluators / standards bodies
- AI-safety funders / research organizations / field-builders
- public / media / civil society
- international coordination bodies / alliances

People, organizations, states and infrastructure are different node types. Preserve those distinctions.

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
- **Contextual / latent:** power becomes high only in a scenario such as a crisis, election, accident, export-control change, war, etc.

Prefer `tier + power vector` over one universal score.

---

## 4. Primary visualization hypothesis

The first useful view should be an **actor ↔ lever ↔ dependency network**, not a generic social graph.

Conceptually:

```text
frontier labs / leaders ──→ model development + deployment ──┐
cloud / hyperscalers ─────→ compute allocation ──────────────┤
chips / manufacturing ────→ compute supply ─────────────────┤
data centres / energy ────→ physical scale ─────────────────┤
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
- typed edges = owns, funds, supplies compute, regulates, evaluates, employs, partners, competes, advises, depends on
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
- node type (person / organization / state / infrastructure / institution)
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

Do not infer private beliefs. Public stance claims must be based on attributable evidence and should remain explicitly uncertain where appropriate.

Do not hard-code current political/company roles as timeless facts; this map will need refreshable data.

---

## 7. Research-before-render workflow

Before implementing the visualization:

1. refine the actor population;
2. define the power-tier rubric and power-vector fields;
3. gather primary/public sources for each high-priority actor;
4. identify the most decision-relevant relationships;
5. decide what the first view must help the user think about;
6. only then choose layout and renderer.

The first visualization should be a view over a model we actually believe, not a visual taxonomy invented because it looks nice.

---

## 8. Product constraints

- Grantmaking OS remains the operational/database system; Universe is a selective cognitive/thinking layer over it.
- Do not mirror a reading queue into Universe. Current reading is ephemeral and already represented by the dynamic Current Source primitive.
- Permanent map objects should earn permanence by being landmarks in the mental model, not simply because they are resources the user once read.
- Preserve the current Universe privacy boundary; do not expose private Notion data on the public site.
- Do not build a generic graph engine or skin system before the first power-map use case proves the need.
- Use a side branch + PR for nontrivial implementation work; the current default branch auto-deploys.

---

## 9. Current v0.1 research seed

The structured source of truth is now the Notion database **`AI Safety Power Map — Decision Centers`** under `Study Key Decision Makers`.

The first seed contains **19 nodes**: 13 institutional/state decision centers plus six individual leaders.

Institutional/state seed:

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

Initial individual seed:

- Sam Altman
- Dario Amodei
- Demis Hassabis
- Mark Zuckerberg
- Elon Musk
- Jensen Huang

Each Notion row records a provisional tier, qualitative power vector, rationale, key relationships, public evidence, confidence and update date. **Do not copy these scores into code yet.** They are research hypotheses and should remain easy to revise.

### Next research target

Before rendering, add a typed relationship/dependency layer and stress-test missing decision centers. In particular, inspect:

- Chinese frontier labs and cloud/compute actors;
- US government sub-bodies whose powers differ materially (White House/NSC, Commerce/BIS, DoD, DOE, etc.);
- semiconductor chokepoints beyond NVIDIA/TSMC (advanced lithography, HBM, packaging/networking where decision-relevant);
- data-centre / energy / permitting nodes where they create real constraints;
- governance boards/ownership nodes when they have authority distinct from the CEO;
- safety-evaluation/funding nodes only where their epistemic or ecosystem power is consequential.

The highest-value next question is whether the **relationship graph** reveals chokepoints, dependencies or coordination nodes that a ranked actor list hides.
