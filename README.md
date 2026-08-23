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
- One lazily-loaded WebGL island (Three.js) for the universe map — see below

## Commands

| Command             | Action                                             |
| ------------------- | -------------------------------------------------- |
| `npm install`       | Install dependencies                               |
| `npm run dev`       | Dev server at `http://localhost:4321/eshkere/`     |
| `npm run build`     | Production build to `dist/`                        |
| `npm run preview`   | Serve the production build locally                 |
| `npm run check`     | Type-check (`astro check`)                         |
| `npm run test:ui`   | Playwright UI checks, including the universe map (needs a running server): `BASE_URL=http://localhost:4321/eshkere node scripts/ui-check.mjs` |
| `npm run test:source` | Offline checks for the Notion current-source validation rules |
| `npm run sync:source` | Refresh `current-source.generated.json` from Notion (needs `NOTION_TOKEN`) |

## The universe map

This is the live version of the site. The homepage hero is the *near camera
state* of a larger map. Zooming out —
with the **Zoom out to the universe** control, a trackpad pinch, a two-finger
scroll up at the top of the page, or `+`/`-` and `Esc` once inside — pulls the
camera back until the artwork turns out to be one planet in an Eshkere
universe: a **Health Core** at the centre with **AI Safety**, **Power**,
**Knowledge & Science** and **Culture & Play** arranged around it.

Design and interaction decisions live in
[`docs/universe-map-spec.md`](docs/universe-map-spec.md), which is the
authoritative spec. The code follows this shape:

| Path | What it is |
| --- | --- |
| `src/universe/data.ts` | The authored composition — every position is hand-placed, there is no layout algorithm |
| `src/universe/stage.ts` | Scene, camera rig, and the single `progress` value that carries the hero → universe transition |
| `src/universe/regions.ts` | The five region morphologies (core, lattice, vortex, spiral, cloud) |
| `src/universe/sky.ts` | Parallax star layers, nebulae, and the escape-velocity streak field |
| `src/universe/hero.ts` | The hero artwork as a WebGL plane, and the headline as particles |
| `src/universe/planet.ts` | The home world: the artwork projected onto a sphere, morphing into a real one |
| `src/universe/markers.ts` | Star systems, planets, link filaments, and the Current Source comet |
| `src/universe/labels.ts` | Labels as real DOM controls, projected each frame |
| `src/universe/index.ts` | Input, HUD and lifecycle — the only module the page imports |

### What it costs the homepage

Nothing until it is asked for. The page ships a ~2KB boot script; the
renderer (Three.js plus the map) is a separate ~146KB gzipped chunk that is
prefetched when the browser goes idle and only ever *executed* when a
visitor starts to zoom out. First paint never waits on WebGL, and the hero
at rest is byte-for-byte the hero that was there before.

### When it cannot run

- **No WebGL** — `.universe-index`, a complete text version of the map built
  from the same data, stops being a screen-reader mirror and becomes the
  visible map. The switcher's entries remove themselves rather than promising
  something they cannot do.
- **`prefers-reduced-motion`** — the flight, the streaks and the drift are
  replaced by a short crossfade to the resolved map. Everything is still
  reachable.
- **A device that cannot keep up** — the renderer walks down a ladder as it
  detects sustained slow frames: device pixel ratio first, then the nebulae,
  then the streak field — and walks back *up* again when frames recover, so
  one bad second does not cost the rest of the session. Composition, labels
  and navigation are never traded away.

### Where the frames go

The map is fill-bound, not CPU-bound: profiling a stationary view puts ~88%
of main-thread samples in idle. So the things that matter are the size of
the drawing buffer and the cost of each fragment, in that order.

- Everything crisp on screen — labels, HUD, breadcrumbs — is DOM at native
  resolution, so the canvas can render below device pixel ratio without
  anything gaining a soft edge. It starts at 1.5 and climbs to 1.75 when
  frames allow.
- Static noise fields are baked once into textures rather than evaluated per
  fragment (`src/universe/bake.ts`). The two nebula clouds cover most of the
  screen between them and were the most expensive surface in the scene.
- The planet's surface walks its noise octaves once and reuses them, rather
  than calling a four-octave fbm five times over. Same continents, from the
  same arithmetic.
- Labels are measured once and cached. Reading `offsetWidth` during the
  render loop forces synchronous layout, and reading it from a *hidden*
  element returns zero — which is what made labels flicker.
- The label layout pass is skipped entirely while the camera, the root
  transform and the viewport all hold still and nothing is fading.
- Shaders are compiled, linked and bound during the pre-warm, not on the
  first frame that draws them. Program linking is synchronous, and it used
  to land in the middle of the transition.

### How the artwork becomes a planet

The hero artwork is one painted view of a globe that runs off the bottom of
its own canvas, so scaling it backwards could only ever produce a cropped
disc. Instead it hands over to a real sphere, early — around a tenth of the
way into the transition, while the camera is accelerating hardest.

The hand-over has nothing to notice because it is not a cross-fade between
two pictures. At the moment of the swap the sphere renders *the artwork
itself*, projected orthographically onto its own front hemisphere, tracking
the same mask the plane is closing — so the two are the same disc, pixel for
pixel. Only then does `uMorph` dissolve that projection into a procedural
world: continents, coastlines, city lights on the night side, an atmosphere
rim, and the artist's green smiley kept in the place they drew it. The
silhouette never changes; only the surface resolves.

The sphere is billboarded, which is what keeps the projection screen-locked
while the camera flies, and lets the mark stay findable and clickable from
any angle.

### Adding to the map

Everything addressable comes from `src/universe/data.ts`: add a `System` to a
region, or a `Destination` to a system, and it appears in the renderer, in
the labels, in the keyboard order and in the text fallback at once. A planet
with `href: null` is shown as a real part of the taxonomy that has no page
yet — the map says so rather than inventing a link.

## Deploying

The site builds for GitHub Pages project hosting by default
(`base: /eshkere`). `.github/workflows/deploy.yml` publishes `dist/` to the
`gh-pages` branch on every push to the default branch
(`claude/eshkere-org-website-84n8s3`), and again every hour so the Notion
`Current` source stays fresh. Whatever the default branch holds is what the
live site is. For a custom domain, build with `SITE=https://example.org
BASE_PATH=/ npm run build`.

### Rolling back

`snapshot/pre-universe-map-2026-08-21` is a frozen, immutable branch holding
the site exactly as it was before the universe map. **Nothing in this
repository ever writes to it.** Rolling back means redeploying it — there is
nothing to reconstruct.

**Immediately (about a minute, holds until the next hourly run):**

> Actions → *Deploy to GitHub Pages* → **Run workflow** → branch
> `snapshot/pre-universe-map-2026-08-21`

That branch carries its own copy of the workflow, so it builds and publishes
itself to the site root.

**Permanently (one command):**

```sh
git push origin +snapshot/pre-universe-map-2026-08-21:claude/eshkere-org-website-84n8s3
```

This points the default branch back at the snapshot. The push triggers a
deploy, and every hourly run after it rebuilds the same thing, so the
rollback sticks. The snapshot branch is only ever read. Nothing is lost: the
universe-map history stays on `feature/universe-map`, and re-promoting is the
same fast-forward that put it live in the first place.

> There is deliberately no second workflow that writes to `gh-pages`. The
> preview workflow that published the experiment to a `preview/` subdirectory
> was removed once the universe map became the live site — one deployment
> mechanism, one place the live site comes from. It is recoverable from git
> history (commit `48297b8`) if a future experiment needs it again.

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
| `src/data/hero-art.ts` | The hero artwork, its clickable regions, and the globe geometry the universe map borrows |

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
