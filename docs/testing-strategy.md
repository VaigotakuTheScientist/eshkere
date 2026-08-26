# Testing strategy

Use **proportional verification**. Do not run the entire browser/UI regression suite after every small edit when a narrower check can establish correctness.

## Default test ladder

1. **Fast checks after ordinary edits**
   - type/static/build checks relevant to the change (`astro check`, source/data validation, lint/type checks where available);
   - targeted assertions for the changed model/component/route;
   - no full-site browser sweep merely because a file changed.

2. **Targeted browser checks when interaction/layout changes**
   - exercise the affected route, interaction, viewport, accessibility behavior, or visual layout;
   - prefer a small deterministic smoke/regression subset over the monolithic full suite during iteration.

3. **Full regression suite at meaningful gates**
   - before merging/deploying a nontrivial feature;
   - after shared navigation, global CSS/layout, Universe renderer/navigation, accessibility/fallback infrastructure, or other cross-cutting behavior changes;
   - when targeted checks expose a plausible regression outside the local change.

## Flakiness / resource contention

The Universe browser checks use Chromium with SwiftShader software WebGL. Avoid running multiple full UI suites concurrently on the same machine. A failure that appears only under concurrent software-renderer load should be rerun once in isolation before treating it as a product regression. Do not repeatedly rerun the whole suite after unrelated data/doc-only edits.

Longer term, split `scripts/ui-check.mjs` into selectable scopes (for example `smoke`, `power-map`, `universe`, and `full`) or otherwise support targeted invocation. The current monolithic suite remains the final merge/deploy regression gate until that split exists.
