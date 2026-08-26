# Claude context

Before making substantial changes in this repository, read [`AGENTS.md`](AGENTS.md).

For Universe work, read both:

- [`docs/universe-map-spec.md`](docs/universe-map-spec.md) — authoritative for the existing cinematic map, interaction, performance, accessibility and fallback behavior.
- [`docs/universe-v0-experiment.md`](docs/universe-v0-experiment.md) — the **current product experiment**, focused on making one real AI Safety world genuinely useful and repeat-use-worthy.

If the task depends on product or organizational intent and Notion is connected, search the workspace for the exact pages `ESHKERE`, `ESHKERE Universe — Product Notes & Brainstorm`, and `Universe v0 — AI Safety World Experiment` rather than inferring long-term strategy from the current codebase.

## Claude Code subagent policy

The **main Claude owns implementation and integration**. Subagents are a context-management and quality-control layer, not a miniature product team.

Use Claude Code's built-in **Explore** subagent for read-only repository discovery when exploration would otherwise flood the main context. Do not create or maintain an ESHKERE-specific repo-explorer unless the built-in capability later proves insufficient.

Project-specific agents live in `.claude/agents/`:

- **`code-reviewer`** — cold, independent, non-editing review after nontrivial implementation and before merge when a fresh diff/spec read could catch semantic, architectural, regression, or evidence problems.
- **`visual-qa`** — independent, non-editing browser/UI verification for changed visual or interactive behavior. It follows [`docs/testing-strategy.md`](docs/testing-strategy.md): targeted checks during iteration; full regression only at an explicit merge/deploy gate or for genuinely cross-cutting changes.

Delegation rules:

1. **Do not delegate trivial work merely because a subagent exists.** Use a subagent when the side task is substantial, recurring, or would pollute the main context with search results/logs/browser output.
2. **Main Claude normally remains the only implementation editor.** Reviewer and QA agents inspect/test and return findings; main Claude applies fixes.
3. **Do not run multiple Chromium/SwiftShader-heavy QA jobs concurrently.** The Universe browser suite can become timing-sensitive under software-renderer contention.
4. **Do not use subagents to invent product strategy.** If a review uncovers a material product/research ambiguity, surface it to the strategic layer/user rather than resolving it silently.
5. **Prefer one cold review and one relevant QA pass over agent chatter.** The goal is independent verification and preserved context, not maximum delegation.

A useful implementation loop is:

```text
approved issue/spec
      ↓
main Claude implements
      ├─ built-in Explore when repository discovery is substantial
      ↓
targeted visual-qa when UI behavior changed
      ↓
cold code-reviewer
      ↓
main Claude fixes concrete findings
      ↓
full regression only when the change reaches its merge/deploy gate
      ↓
product/human review → merge
```

When `.claude/agents/` is created for the first time during an already-running Claude Code session, restart that session once if the new agents are not discovered; current Claude Code watches an existing agents directory for subsequent edits.
