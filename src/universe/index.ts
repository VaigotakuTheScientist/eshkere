import { CONTENT_TYPE_LABEL, type NodeRecord } from './data';
import { createStage, supportsWebGL, type Mode, type Stage } from './stage';

/**
 * The universe controller: input, HUD and lifecycle.
 *
 * Everything heavy lives behind this module's dynamic import, so the
 * homepage still paints without a line of WebGL having been parsed. Nothing
 * here runs until the visitor asks for it.
 */

export interface UniverseApi {
  /** Build the renderer ahead of time, without showing anything. */
  prepare(): void;
  open(region?: string): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

interface Refs {
  root: HTMLElement;
  index: HTMLElement | null;
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  hud: HTMLElement;
  crumbs: HTMLElement;
  levelText: HTMLElement;
  detail: HTMLElement;
  detailTitle: HTMLElement;
  detailBlurb: HTMLElement;
  detailLink: HTMLAnchorElement;
  detailKind: HTMLElement;
  hint: HTMLElement;
  openers: HTMLElement[];
  hero: HTMLElement | null;
}

const LEVEL_NAMES = ['', 'Universe', 'Galaxy', 'System'];

export function createUniverse(): UniverseApi | null {
  const root = document.querySelector<HTMLElement>('[data-universe]');
  if (!root) return null;

  const found = collectRefs(root);
  if (!found) return null;

  if (!supportsWebGL()) {
    // No renderer, so the text index stops being a mirror and becomes the
    // map itself: visible, in the tab order, and read out normally.
    document.documentElement.classList.add('universe-unsupported');
    const index = document.querySelector<HTMLElement>('.universe-index');
    if (index) {
      index.inert = false;
      index.removeAttribute('aria-hidden');
    }
    return null;
  }

  const heroSource = readHeroSource();
  if (!heroSource) return null;

  // Re-bind the guarded values: hoisted function declarations below cannot
  // see the narrowing that the early returns above performed.
  const refs = found;
  const overlay = root;
  const hero = heroSource;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controller = new AbortController();
  const { signal } = controller;

  let stage: Stage | null = null;
  let open = false;
  let intro = 0;
  let introRaf = 0;
  let lastReturnFocus: HTMLElement | null = null;
  /** Which entry was used, and the galaxy it asked for, if any. */
  let activeOpener: HTMLElement | null = null;
  let pendingRegion: string | null = null;
  let regionTimer = 0;
  let hoverX = 0;
  let hoverY = 0;
  let hoverQueued = false;

  /**
   * Pointer movement fires far faster than the screen refreshes, and each
   * event used to run a full pick over every object in the map. Coalescing
   * to one pick per frame makes the cost independent of how fast the
   * trackpad reports.
   */
  function queueHover(x: number, y: number) {
    hoverX = x;
    hoverY = y;
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      if (!stage || stage.mode !== 'universe') return;
      stage.setHover(stage.pick(hoverX, hoverY));
    });
  }

  /* ------------------------------------------------------------- staging */
  function ensureStage(): Stage {
    if (stage) return stage;
    stage = createStage(
      {
        canvas: refs.canvas,
        labels: refs.labels,
        heroImage: hero.image,
        heroPlanet: hero.planet,
        heroMark: hero.mark,
        heroFocus: hero.focus,
        heroHeadline: hero.headline,
        currentSourceRect: hero.starRect,
      },
      {
        onModeChange: handleMode,
        onProgress: handleProgress,
        onFocusChange: renderCrumbs,
        onHover: handleHover,
        onSelect: renderDetail,
      },
      reducedMotion
    );
    return stage;
  }

  function showOverlay() {
    if (open) return;
    open = true;
    lastReturnFocus = (document.activeElement as HTMLElement) ?? refs.openers[0] ?? null;
    overlay.hidden = false;
    document.documentElement.classList.add('universe-active');
    // Freeze the page underneath rather than letting it scroll behind glass.
    document.documentElement.style.setProperty('overflow', 'hidden');
    setPageInert(true);
    const instance = ensureStage();
    instance.resize();
    instance.start();
    rampIntro(1);
  }

  function hideOverlay() {
    if (!open) return;
    open = false;
    overlay.hidden = true;
    document.documentElement.classList.remove('universe-active', 'universe-open');
    document.documentElement.style.removeProperty('overflow');
    setPageInert(false);
    stage?.stop();
    window.clearTimeout(regionTimer);
    intro = 0;
    refs.canvas.style.opacity = '0';
    stage?.setIntro(0);
    refs.hero?.style.removeProperty('--universe-progress');
    refs.hero?.style.removeProperty('--universe-intro');
    pendingRegion = null;
    for (const opener of refs.openers) opener.setAttribute('aria-pressed', 'false');
    lastReturnFocus?.focus?.();
  }

  /**
   * Take the page underneath out of the tab order and the accessibility
   * tree, and hand both over to the map.
   *
   * `main` itself cannot be the unit here — the overlay is inside it, and
   * marking an ancestor inert makes its descendants inert too, which would
   * silently kill every control in the HUD. So the page is frozen one child
   * at a time, with the map's own two elements left alone.
   *
   * The text index is the mirror image: dormant while the page is an
   * ordinary page, live for exactly as long as the map is open.
   */
  function setPageInert(frozen: boolean) {
    const regions = new Set<HTMLElement>();
    for (const element of document.querySelectorAll<HTMLElement>(
      'main > *, body > header, body > footer, .site-header'
    )) {
      if (element.hasAttribute('data-universe')) continue;
      if (element.classList.contains('universe-index')) continue;
      regions.add(element);
    }
    for (const element of regions) element.inert = frozen;

    if (refs.index) {
      refs.index.inert = !frozen;
      refs.index.setAttribute('aria-hidden', frozen ? 'false' : 'true');
    }
  }

  /** The DOM → canvas hand-over. Both images sit still while it happens. */
  function rampIntro(to: number) {
    cancelAnimationFrame(introRaf);
    const from = intro;
    const start = performance.now();
    const duration = reducedMotion ? 220 : 150;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      intro = from + (to - from) * t;
      refs.canvas.style.opacity = String(intro);
      // The DOM headline fades out on exactly the same curve the dust fades
      // in on, so the hand-over has no visible moment of its own.
      refs.hero?.style.setProperty('--universe-intro', intro.toFixed(3));
      stage?.setIntro(intro);
      if (t < 1) introRaf = requestAnimationFrame(step);
    };
    introRaf = requestAnimationFrame(step);
  }

  /* ----------------------------------------------------------- callbacks */
  function handleMode(mode: Mode) {
    document.documentElement.classList.toggle('universe-open', mode === 'universe');
    for (const opener of refs.openers) {
      const entered = mode !== 'hero' && opener === activeOpener;
      opener.setAttribute('aria-pressed', String(entered));
    }
    refs.hud.hidden = mode !== 'universe';
    refs.hint.hidden = mode !== 'universe';
    if (mode === 'universe') {
      refs.levelText.textContent = LEVEL_NAMES[1] ?? '';
      if (pendingRegion) {
        const region = pendingRegion;
        pendingRegion = null;
        // A beat at the overview first, so the scale still registers before
        // the camera commits to one corner of it. Anything the visitor does
        // during that beat wins — pressing Escape used to leave a flight
        // queued that fired after the map had already started closing.
        window.clearTimeout(regionTimer);
        regionTimer = window.setTimeout(() => {
          if (stage?.mode === 'universe' && stage.level === 1) stage.focusRegion(region);
        }, 420);
      }
      // Land the keyboard inside the map itself rather than on one of its
      // controls — focusing "Back to the page" put a ring around the exit
      // the moment the universe opened, which is the wrong thing to point at.
      if (!overlay.contains(document.activeElement)) {
        overlay.focus({ preventScroll: true });
      }
    }
    if (mode === 'hero') hideOverlay();
  }

  function handleProgress(value: number) {
    refs.hero?.style.setProperty('--universe-progress', value.toFixed(3));
    refs.levelText.textContent = stage ? (LEVEL_NAMES[stage.level] ?? '') : '';
  }

  function handleHover(node: NodeRecord | null) {
    refs.canvas.style.cursor = node ? 'pointer' : 'default';
  }

  function renderCrumbs(path: NodeRecord[]) {
    refs.crumbs.replaceChildren();
    const entries: { label: string; onClick: () => void }[] = [
      { label: 'Universe', onClick: () => stage?.recentre() },
      ...path.map((node) => ({
        label: node.label,
        onClick: () => {
          if (node.kind === 'region') stage?.focusRegion(node.id);
          else stage?.focusSystem(node.id);
        },
      })),
    ];
    entries.forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'u-crumb';
      button.textContent = entry.label;
      button.addEventListener('click', entry.onClick, { signal });
      if (index === entries.length - 1) button.setAttribute('aria-current', 'true');
      refs.crumbs.append(button);
    });
    refs.levelText.textContent = LEVEL_NAMES[stage?.level ?? 1] ?? '';
  }

  function renderDetail(node: NodeRecord | null) {
    if (!node) {
      refs.detail.hidden = true;
      return;
    }
    refs.detail.hidden = false;
    // What the thing is, not what the sky calls it. "Resource" and "Project"
    // survive a change of skin; "planet" is this renderer's word.
    refs.detailKind.textContent = CONTENT_TYPE_LABEL[node.contentType];
    refs.detailTitle.textContent = node.label;
    refs.detailBlurb.textContent = node.blurb;
    if (node.href) {
      refs.detailLink.hidden = false;
      refs.detailLink.href = node.href;
      const external = /^https?:\/\//i.test(node.href);
      refs.detailLink.target = external ? '_blank' : '';
      refs.detailLink.rel = external ? 'noopener noreferrer' : '';
      refs.detailLink.textContent = external ? 'Open destination ↗' : 'Open destination →';
    } else {
      refs.detailLink.hidden = true;
    }
  }

  /* ------------------------------------------------------- pointer input */
  /**
   * Pointer only: drag to pan, hover to light a node, click to fly into it.
   *
   * There is deliberately no wheel or pinch handler here. Scrubbing the
   * hero → universe reveal with a trackpad made entering the map feel like
   * operating a slider rather than crossing a threshold, and it left the
   * visitor parked at arbitrary points inside a transition that only reads
   * as cinematic when it plays. Entry and exit are now discrete: the
   * switcher goes in, the HUD and Escape come back.
   */
  let panPointer: { id: number; x: number; y: number } | null = null;

  refs.canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'touch' && panPointer) return;
      panPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      refs.canvas.setPointerCapture(event.pointerId);
    },
    { signal }
  );

  refs.canvas.addEventListener(
    'pointermove',
    (event) => {
      if (!stage) return;
      if (panPointer && panPointer.id === event.pointerId && event.buttons) {
        stage.panBy(
          ((event.clientX - panPointer.x) / window.innerWidth) * 900,
          ((event.clientY - panPointer.y) / window.innerHeight) * 620
        );
        panPointer.x = event.clientX;
        panPointer.y = event.clientY;
        return;
      }
      if (stage.mode !== 'universe') return;
      queueHover(event.clientX, event.clientY);
    },
    { signal }
  );

  refs.canvas.addEventListener(
    'pointerup',
    (event) => {
      const moved =
        panPointer && Math.hypot(event.clientX - panPointer.x, event.clientY - panPointer.y) > 6;
      panPointer = null;
      if (!stage || stage.mode !== 'universe' || moved) return;
      const hit = stage.pick(event.clientX, event.clientY);
      if (hit) stage.activate(hit);
      else stage.select(null);
    },
    { signal }
  );

  /* ------------------------------------------------------------ keyboard */
  window.addEventListener(
    'keydown',
    (event) => {
      if (!open || !stage) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          if (!stage.zoomOutOneLevel()) stage.runTo(0);
          break;
        case '-':
        case '_':
          event.preventDefault();
          if (!stage.zoomOutOneLevel()) stage.runTo(0);
          break;
        case '+':
        case '=':
          event.preventDefault();
          stage.zoomInOneLevel();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          stage.panBy(-90, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          stage.panBy(90, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          stage.panBy(0, -70);
          break;
        case 'ArrowDown':
          event.preventDefault();
          stage.panBy(0, 70);
          break;
        case 'Home':
          event.preventDefault();
          stage.recentre();
          break;
        default:
          break;
      }
    },
    { signal }
  );

  /* ----------------------------------------------------------- HUD wiring */
  for (const button of refs.hud.querySelectorAll<HTMLElement>('[data-universe-action]')) {
    button.addEventListener(
      'click',
      () => {
        if (!stage) return;
        switch (button.dataset.universeAction) {
          case 'in':
            stage.zoomInOneLevel();
            break;
          case 'out':
            if (!stage.zoomOutOneLevel()) stage.runTo(0);
            break;
          case 'home':
            stage.recentre();
            break;
          case 'exit':
            stage.runTo(0);
            break;
          default:
            break;
        }
      },
      { signal }
    );
  }

  refs.detail
    .querySelector('[data-universe-detail-close]')
    ?.addEventListener('click', () => stage?.select(null), { signal });

  for (const opener of refs.openers) {
    opener.addEventListener(
      'click',
      () => {
        const instance = ensureStage();
        activeOpener = opener;
        // An entry can name a region. The reveal still plays in full — it is
        // the point of the feature — and the camera flies on to that galaxy
        // the moment the map has resolved.
        pendingRegion = opener.dataset.universeRegion ?? null;
        if (!open) showOverlay();
        if (stage?.mode === 'universe') {
          if (pendingRegion) instance.focusRegion(pendingRegion);
          else instance.recentre();
          pendingRegion = null;
        } else {
          instance.runTo(1);
        }
      },
      { signal }
    );
  }

  /* ----------------------------------------------------------- lifecycle */
  // Resizing fires continuously while a window is dragged, and each one
  // rebuilds geometry and re-measures every label.
  let resizeQueued = false;
  window.addEventListener(
    'resize',
    () => {
      if (resizeQueued || !stage) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        stage?.resize();
      });
    },
    { passive: true, signal }
  );
  document.addEventListener(
    'visibilitychange',
    () => stage?.setPaused(document.hidden),
    { signal }
  );

  return {
    prepare() {
      ensureStage();
    },
    open(region?: string) {
      const instance = ensureStage();
      pendingRegion = region ?? null;
      if (!open) showOverlay();
      instance.runTo(1);
    },
    close() {
      stage?.runTo(0);
    },
    isOpen: () => open,
    destroy() {
      controller.abort();
      stage?.destroy();
      hideOverlay();
    },
  };
}

/* --------------------------------------------------------------- helpers */

function collectRefs(root: HTMLElement): Refs | null {
  const query = <T extends HTMLElement>(selector: string): T | null =>
    root.querySelector<T>(selector);

  const canvas = query<HTMLCanvasElement>('[data-universe-canvas]');
  const labels = query('[data-universe-labels]');
  const hud = query('[data-universe-hud]');
  const crumbs = query('[data-universe-crumbs]');
  const levelText = query('[data-universe-level]');
  const detail = query('[data-universe-detail]');
  const detailTitle = query('[data-universe-detail-title]');
  const detailBlurb = query('[data-universe-detail-blurb]');
  const detailKind = query('[data-universe-detail-kind]');
  const detailLink = query<HTMLAnchorElement>('[data-universe-detail-link]');
  const hint = query('[data-universe-hint]');

  if (
    !canvas ||
    !labels ||
    !hud ||
    !crumbs ||
    !levelText ||
    !detail ||
    !detailTitle ||
    !detailBlurb ||
    !detailKind ||
    !detailLink ||
    !hint
  ) {
    return null;
  }

  return {
    root,
    index: document.querySelector<HTMLElement>('.universe-index'),
    canvas,
    labels,
    hud,
    crumbs,
    levelText,
    detail,
    detailTitle,
    detailBlurb,
    detailKind,
    detailLink,
    hint,
    openers: [...document.querySelectorAll<HTMLElement>('[data-universe-open]')],
    hero: document.querySelector<HTMLElement>('.hero'),
  };
}

/**
 * Read the hero exactly as the browser is currently drawing it: the visible
 * artwork, where its globe sits, how CSS is cropping it, and where the
 * Current Source star is on screen. Nothing here is hard-coded, so switching
 * artwork or changing the Notion source needs no change to this module.
 */
function readHeroSource() {
  const wrapper = document.querySelector<HTMLElement>('[data-art-image]:not([hidden])');
  const image = wrapper?.querySelector('img');
  if (!wrapper || !image || !image.naturalWidth) return null;

  const triple = (raw: string | undefined, fallback: [number, number, number]) => {
    const parts = (raw ?? '').split(',').map(Number);
    return parts.length === 3 && parts.every((value) => Number.isFinite(value))
      ? (parts as [number, number, number])
      : fallback;
  };

  const [cx, cy, r] = triple(wrapper.dataset.artPlanet, [0.64, 0.5, 0.39]);
  const planet = { cx, cy, r };
  const [mx, my, mr] = triple(wrapper.dataset.artMark, [-0.05, 0.32, 0.033]);
  const mark = { x: mx, y: my, r: mr };

  const [rawX, rawY] = getComputedStyle(image).objectPosition.split(' ');
  const focus = {
    x: (parseFloat(rawX ?? '50') || 50) / 100,
    y: (parseFloat(rawY ?? '50') || 50) / 100,
  };

  const star = [
    ...document.querySelectorAll<HTMLAnchorElement>(
      '[data-art-hotspots]:not([hidden]) .hero__hotspot'
    ),
  ].find((spot) => (spot.textContent ?? '').includes('Currently reading:'));

  return {
    image,
    planet,
    mark,
    focus,
    headline: document.querySelector<HTMLElement>('.hero__heading'),
    starRect: star ? star.getBoundingClientRect() : null,
  };
}
