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
| `npm run test:source` | Offline checks for the Notion current-source validation rules |
| `npm run sync:source` | Refresh `current-source.generated.json` from Notion (needs `NOTION_TOKEN`) |

## Deploying

The site builds for GitHub Pages project hosting by default
(`base: /eshkere`). `.github/workflows/deploy.yml` publishes `dist/` to
GitHub Pages on pushes to `main` (enable **Settings → Pages → Source: GitHub
Actions** once). For a custom domain, build with `SITE=https://example.org
BASE_PATH=/ npm run build`.

## Current source (Notion → hero star)

The bright four-point star on the hero planet links to whatever you are
currently reading. It is driven by the private **Sources** database in
Grantmaking OS, so changing what you read never requires editing this repo:

```
Notion `Current` checkbox → hourly GitHub Action → Astro build → star hotspot
```

`scripts/fetch-current-source.mjs` queries the Sources data source for rows
with `Current` checked, takes the `Source` title and `URL`, and overwrites
`src/data/current-source.generated.json` just before `npm run build`. Only
those two fields ever leave Notion. The committed copy of that file is a
placeholder so local builds and typechecks work without a token; CI's
rewrite is not committed back.

**`Status` and `Current` mean different things.** `Status = Reading` may
apply to several sources at once — it tracks what you have open. `Current`
marks the single source the website should point at. Exactly one row should
have `Current` checked.

The sync is deliberately strict: zero matches, more than one match, a
missing or non-`http(s)` URL, an auth failure or an API outage all fail the
job **before** deployment, so a bad sync never replaces the live site with a
broken one. The previous deployment simply stays up.

### One-time setup

1. Create a Notion internal integration with **read** access.
2. Share the **Sources** database with that integration.
3. In this repository, add the integration token as an Actions secret named
   `NOTION_TOKEN` (Settings → Secrets and variables → Actions).
4. In Notion, check `Current` on exactly one Source that has a valid
   `http(s)` URL.
5. Wait for the hourly run, or trigger **Actions → Deploy to GitHub Pages →
   Run workflow** to refresh immediately.

The token is only ever read from `${{ secrets.NOTION_TOKEN }}` inside the
workflow. It is never committed, never exposed to client-side JavaScript,
and never printed — Notion errors are reported by error code only.

Run `npm run test:source` to exercise the validation rules offline (no token
or network needed).

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
