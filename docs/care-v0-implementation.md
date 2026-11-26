# ESHKERE Care v0 implementation

Care is a static Astro workspace at `/care/` under the configured base path. Its entry in Universe is **Health Core → Physical → ESHKERE Care**. The WebGL map and the text index use the same destination. The return link goes to the Universe homepage, where the existing view switcher is available. The route, styles and client enhancement live within the Care feature. The Universe renderer and Current Source pipeline use their existing code paths.

## Routine maps

Hair, Nails and Face use the same four cadence lanes. Source order drives the sequence. Text identifies core, optional and as-needed steps, and a dashed connector leads to the next optional step. Each step offers a short rationale and, where applicable, a supply list, precautions and a public source. Health guidance and preferences use distinct labels. Face starts with general care and directs persistent or specific concerns to a dermatologist.

The content model holds stable module, cadence, step, supply and experiment IDs. A step's supply IDs refer to that module's inventory. Astro renders all three modules and native disclosures in HTML. JavaScript adds active-module navigation with shareable fragments, completion controls and inventory status. Without JavaScript, module links jump to readable maps and templates.

## Decisions for review

- **When should completion roll over?** The brief leaves timing and scheduling open. In this version, people uncheck steps or clear a cadence when they want to start again. There is no automatic day boundary.
- **Should an experiment last across visits?** An editable template and a storage boundary limited to completion and ownership leave cross-visit experiment continuity open. Each module has one editable page draft, with a hypothesis, one changed variable, qualitative observations, an evaluation date and stop criteria. A future decision about continuity needs to address where observations can live and who can access them.

Only step completion and owned/planned inventory choices go into `eshkere.care.v0` in browser storage. Saved choices are keyed by module and authored ID. The page explains shared-browser visibility and offers a confirmed reset for Care state. If storage is unavailable, a visitor can use the controls for the current page. Experiment fields have no submission or storage path in the app.

## Verification

Run `npm run check`, `npm run build` and `npm run test:source`. Then run `npm run preview` and `npm run test:care` in a separate terminal. `BASE_URL` defaults to `http://localhost:4321/eshkere`. Set `SCREENSHOT_DIR` to capture review images. `npm run test:ui` exercises the existing site and Universe against the same server.

The focused browser check covers keyboard interaction, disclosures, module history, saved choices and scoped/global reset, draft isolation, blocked storage, mobile layout, readable maps without JavaScript, and navigation via the WebGL and no-WebGL Universe maps. Desktop and mobile scenarios use Chromium with reduced motion.

Review run passed `check`, `build`, `test:source`, `test:care` and the full `test:ui` suite. A separate `BASE_PATH=/` build confirmed that the Care entry and Universe return links work at the site root.

## Screenshots

- [Hair on desktop, with a completed step and an open rationale](screenshots/care/hair-desktop.jpg)
- [Nails on desktop, with inventory and the editable experiment](screenshots/care/nails-template.jpg)
- [Face on mobile, with sunscreen guidance expanded](screenshots/care/face-mobile.jpg)
