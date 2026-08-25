# ESHKERE repository context for coding agents

This file is the concise implementation-context router for AI coding agents working in this repository.

## What this repository is

This repository contains the **public ESHKERE website**, currently an early-stage institutional prototype.

**ESHKERE is larger than this repository.** ESHKERE is currently best understood as an early-stage exploratory umbrella organization for building ambitious projects that we believe should exist. The website is one public surface of that organization, not the organization itself.

Do not infer ESHKERE's full organizational strategy from the current site architecture.

## Strategic memory vs implementation memory

- **Notion is the strategic source of truth** for why ESHKERE exists, project relationships, long-term hypotheses, decisions, open questions, experiments and priorities.
- **GitHub is the implementation source of truth** for code, technical architecture, deployment, constraints and agent instructions.

If a task depends on product/organizational intent and a Notion connector is available, search for these exact pages before guessing:

- `ESHKERE` — top-level organization / OS page
- `ESHKERE Universe — Product Notes & Brainstorm` — Universe product source of truth
- `Grantmaking OS` — grantmaking operating system / project source of truth

Do not copy entire Notion strategy notes into this repository. Keep GitHub concise and implementation-relevant.

## ESHKERE → project boundaries

Current conceptual hierarchy:

```text
ESHKERE
├── public website (this repository)
├── Universe
│   ├── MoM — Map of Maps
│   ├── Explore / Vibe + ambient living-world layer
│   ├── Learn / Complete
│   └── AI world-builder / personalization
├── Grantmaking OS
└── future projects / research / programs / experiments
```

These labels are intentionally provisional. A project can evolve from idea → experiment → project → product/program → major internal unit → separate organization/subsidiary/spinout. Do not hard-code organizational assumptions into technical architecture unless the task explicitly requires them.

## Universe: present vs possible future

Universe currently lives partly inside the ESHKERE website, but it may eventually become a standalone product or application with its own domain/repository/team.

Therefore:

- Keep Universe code reasonably modular and extractable.
- Avoid unnecessary coupling between Universe internals and unrelated homepage/content concerns.
- Do **not** build speculative accounts, backend services, databases, multiplayer systems or AI infrastructure merely because they may exist later.
- Do preserve clean boundaries so those systems could be added later without rewriting everything.
- Prefer reusable data/configuration boundaries over one-off hard-coded assumptions when the cost is small.

For current map behavior and implementation decisions, **`docs/universe-map-spec.md` is authoritative**. Read it before materially changing the Universe map.

The long-term AI-native direction, if pursued, should generally prefer:

```text
AI → structured decisions/configuration → trusted Universe components → rendered world
```

over allowing an LLM to generate arbitrary production frontend code for every interaction.

## Product-engineering principle

**Think at 10/10 scale; implement one important experiment at a time.**

Preserve paths to ambitious future versions, but do not confuse future possibility with current requirements. Prefer the smallest implementation that either creates real value or tests an important assumption.

## Current technical constraints

Follow the README and existing specs. In particular:

- The site is currently Astro + TypeScript with static output.
- Preserve accessibility and `prefers-reduced-motion` behavior.
- Preserve the current Universe performance/fallback strategy unless a task explicitly changes it.
- Keep private Notion tokens/data server/build-time only; never expose secrets to client-side JavaScript.
- Snapshot branches are recovery artifacts. Do not rewrite them.
- Do not invent staff, partners, funding, portfolio claims, publications or history that are not real.

## When adding a new large feature

Before implementing a feature that changes Universe's product model, ESHKERE's organizational boundaries, persistence/accounts, AI personalization, or project structure:

1. Read the relevant repository spec(s).
2. If available, consult the corresponding Notion source-of-truth page.
3. Distinguish **current experiment** from **long-term possibility**.
4. Implement the smallest coherent version that preserves reasonable future boundaries.
5. Update GitHub docs when a technical constraint/decision changes; update Notion when strategic/product reasoning changes.
