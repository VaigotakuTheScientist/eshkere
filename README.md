# Eshkere — Maximize Health, Play Games

The website of **Eshkere**, an early-stage exploratory organization built around one
idea: health — physical, mental and social well-being — is the non-optional
foundation of human flourishing, and games — every pursuit people can freely
choose — are the valuable, optional layer on top.

This is a **serious institutional prototype**, not evidence of a mature
organization. The site's one hard rule: nothing pretends to be further along
than it is. Where real content doesn't exist yet, the site shows deliberate
empty states or clearly labelled sample entries — never invented staff,
partners, funding, portfolio, publications or history.

> This project is separate from `eshkere-strategy`, which is a different,
> personal project. Nothing here imports from or modifies it.

## Stack

- [Astro](https://astro.build) 7 + TypeScript, fully static output
- Plain scoped CSS with design tokens (`src/styles/tokens.css`)
- Astro content collections for all structured content
- Self-hosted fonts (Playfair Display, Space Grotesk, Silkscreen via Fontsource)
- Hand-rolled static search (JSON index generated at build time)
- No client-side frameworks; a few small vanilla scripts for menu, search and filters

## Commands

| Command             | Action                                             |
| ------------------- | -------------------------------------------------- |
| `npm install`       | Install dependencies                               |
| `npm run dev`       | Dev server at `http://localhost:4321/eshkere/`     |
| `npm run build`     | Production build to `dist/`                        |
| `npm run preview`   | Serve the production build locally                 |
| `npm run check`     | Type-check (`astro check`)                         |
| `npm run test:ui`   | Playwright UI checks (needs a running server): `BASE_URL=http://localhost:4321/eshkere node scripts/ui-check.mjs` |

## Deploying

The site builds for GitHub Pages project hosting by default
(`base: /eshkere`). `.github/workflows/deploy.yml` publishes `dist/` to
GitHub Pages on pushes to `main` (enable **Settings → Pages → Source: GitHub
Actions** once). For a custom domain, build with `SITE=https://example.org
BASE_PATH=/ npm run build`.

## Content architecture

All content lives in editable files — no code changes needed to publish:

| Location | What it holds |
| --- | --- |
| `src/content/portfolio/` | Portfolio entries (projects, programs, experiments, supported work). Currently empty by design. |
| `src/content/research/` | Research & News articles (`type`: research / news / announcement) |
| `src/content/blog/` | Blog posts |
| `src/content/staff-work/` | Staff publications & projects (`kind`: publication / research / tool / project / external) |
| `src/content/team/` | Team profiles. Currently empty by design — real people only. |
| `src/data/history.json` | Timeline events — confirmed events only |
| `src/data/careers.json` | Open roles — real vacancies only |
| `src/data/site.ts` | Site config: partnership/press contacts (`null` renders honest "forthcoming" states), social links |

Each collection has a `_template.md` showing the frontmatter. Files starting
with `_` are ignored by the build.

### The `prototype` flag

Entries with `prototype: true` are **sample content** demonstrating the
editorial system. They are visibly badged "Sample" everywhere they appear
(cards, article pages, search results). When real content exists, delete the
samples or replace them. Never publish real claims under the flag, and never
remove the flag from sample content.

## Placeholders awaiting real information

- Portfolio entries (empty state shown)
- Team profiles (empty state shown)
- Open roles (empty state shown)
- Partnership contact and press contact (`src/data/site.ts`)
- Social links (`src/data/site.ts`)
- History events beyond the site's own launch (`src/data/history.json`)
- Real research/blog/staff publications to replace the labelled samples
