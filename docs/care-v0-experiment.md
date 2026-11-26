# ESHKERE Care — v0 experiment and implementation brief

Status: proposed experiment; not a launched product.
Date: 2026-11-26.

## Purpose

Turn personal-care knowledge into an attractive, usable set of routine maps. Test whether a person actually returns to the interface to understand, perform and improve care routines, rather than merely collecting advice or buying products.

Health is the non-optional foundation; aesthetics, play and self-expression are legitimate optional goals. Appearance can influence social perception, but social outcomes are contextual, not a beauty score or guarantee. Scientific evidence constrains health claims and guides experimentation.

## Product placement

Working name: ESHKERE Care. Begin as a bounded Universe experiment, not a new galaxy, separate company or committed standalone product.

The existing Universe taxonomy stays intact:
- Health Core / Physical: hygiene, prevention, comfort and safety (primary entry).
- Culture & Play: aesthetics, personal style, creativity.
- Knowledge & Science: biology, chemistry, evidence and learning.
- Power: optional connection to personal presentation and social perception.

These are typed relationships to one canonical destination, not copies of the same app or mutually exclusive parent categories. The first implementation needs only one real entry from Health Core; add cross-domain discovery later if it improves navigation. Keep the existing AI Safety world experiment intact; this proposal does not supersede its priorities.

Care is a possible MoM child map and Explore / Vibe experience. Use a routine-oriented, non-cosmic representation when it better serves the task. Do not force every step or product into a planet.

## Smallest useful v0

One responsive Care workspace with Hair, Nails and Face modules, with a consistent model and task-specific presentation.

- Routine map: morning, evening, wash-day/periodic and as-needed groups; sequence, optional branches, short explanations, supplies, safety notes.
- Inventory/shopping: a small editable list of generic tool/product categories with owned/planned status; no store integrations.
- Experiment: one active, user-editable experiment per module, with a hypothesis, changed variable, qualitative observations, evaluation date and stop criteria. Do not imply causal certainty from a personal trial.
- Knowledge: concise rationale attached to relevant steps, with vetted public sources for medical or health claims. Distinguish evidence, preference and uncertainty.
- Progress: user-controlled completion state; no streak punishment, beauty rating, comparison leaderboard or automatic medical inference.

Initial public-safe example content (not personal records):
- Hair: inspect and detangle only as needed; condition on wash days; lightly refresh texture; shape and gently dry. Experiment with detangling comfort and styling technique, avoiding excessive tension or heat.
- Nails: regular hygiene, gentle shaping, moisturization; optional ordinary nail polish with base/color/top coat and safe removal. Avoid damaging cuticles. Experiment with clear versus colored finishes.
- Face: gentle cleansing, moisturizing and sun protection. Optional concern-specific care must be clearly separated from generic routine guidance; do not generate or hard-code an individual's medical treatment plan.

The visual emphasis is on when, what, why, optionality and relationships. A compact routine checklist/flow with expandable details is preferable to a decorative map if that proves more useful.

## Implementation boundary

Read AGENTS.md, docs/universe-map-spec.md and docs/universe-v0-experiment.md before coding. Reuse Astro, TypeScript, design tokens, existing navigation and base-path conventions. Proposed feature boundary: src/care/ (neutral models/data/logic) and a dedicated Astro route (e.g. /care/ under configured base). Adapt paths to actual repository conventions. Use small vanilla client scripts where needed; no new UI framework.

Model stable IDs for module, routine, step, product category and experiment; typed domain relationships; step timing, order, optionality, rationale, precautions and source references. Keep content separate from view and completion state. Avoid building a generalized graph engine, skin engine or speculative backend.

Public-safe generic content can live in the repository. For v0, local browser storage may hold non-sensitive completion/ownership preferences only, with a visible reset and disclosure that storage is device/browser-specific and not access-controlled. Keep medical histories, personal photos, private notes, actual treatment logs and sensitive observations out of public GitHub, GitHub Pages builds, analytics and static assets. Do not import private Notion content. If sensitive personal tracking is needed, use a separate private/local environment and revisit the privacy model before implementing it.

Health guardrails: no diagnosis, prescriptions, unsupported efficacy claims or appearance ranking. Include source links and professional-care escalation where appropriate. No automatic health treatment recommendations from progress tracking.

## Proposed implementation sequence

1. Build the route and three module views with generic public-safe starter content, accessible navigation and meaningful empty states.
2. Add routine completion and inventory preferences, reset behavior and lightweight experiment templates (without storing sensitive notes on the public site).
3. Add a single canonical Universe destination in Health Core / Physical, with equivalent text/no-WebGL fallback and correct navigation back to Universe.
4. Review screenshots and test actual use; only then consider cross-domain links, private persistence or further features.

## Acceptance criteria

- All three modules accessible on desktop and mobile, and with keyboard navigation.
- Routine steps distinguish required/optional/as-needed and expose why/safety information.
- No personal photos, treatment histories, private notes, tokens or private URLs in public artifacts.
- Completion and inventory preferences persist locally across reloads, can be reset, and remain independent of authored content.
- Canonical Care link respects Astro base path and works without WebGL; existing Universe behavior, reduced motion and current-source privacy are unchanged.
- npm run check, npm run build, npm run test:source and relevant UI checks pass (run UI checks against a running server); add focused tests for module switching, state/reset, navigation and accessibility. Report actual results and capture screenshots in implementation PR.

## Evaluation and open decisions

After 1–2 weeks of voluntary use, ask: Does it make care easier to remember, understand and perform? Is it more pleasant than a static note? Which map relationships help? Does it reduce unnecessary purchases? Are there steps that should be optional or removed?

Defer accounts, sync, product recommendations, AI medical analysis, photo tracking, monetization, standalone branding and a generalized cross-domain platform. Reassess only if the experiment generates real demand.

Strategic rationale and experiment results belong in the ESHKERE / Universe strategic workspace; this brief is the concise implementation context. Treat this proposal as provisional, not as evidence of a mature organization or approved change to the authoritative Universe map spec.
