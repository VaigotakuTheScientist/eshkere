import type { NodeRecord } from './data';
import { createStage, supportsWebGL, type Mode, type Stage } from './stage';

/**
 * The universe controller: input, HUD and lifecycle.
 *
 * Everything heavy lives behind this module's dynamic import, so the
 * homepage still paints without a line of WebGL having been parsed. Nothing
 * here runs until the visitor asks for it.
 */

export interface UniverseApi {
  /** Drive the hero → universe transition directly, 0 to 1. */
  setProgress(value: number): void;
  /** Finish opening from wherever the gesture left off. */
  commit(): void;
  /** Abandon the gesture and fall back to the hero. */
  release(): void;
  open(): void;
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
  opener: HTMLElement | null;
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
  let gestureTimer = 0;
  let gestureValue = 0;
  let lastReturnFocus: HTMLElement | null = null;

  /* ------------------------------------------------------------- staging */
  function ensureStage(): Stage {
    if (stage) return stage;
    stage = createStage(
      {
        canvas: refs.canvas,
        labels: refs.labels,
        heroImage: hero.image,
        heroPlanet: hero.planet,
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
    lastReturnFocus = (document.activeElement as HTMLElement) ?? refs.opener;
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
    gestureValue = 0;
    intro = 0;
    refs.canvas.style.opacity = '0';
    stage?.setIntro(0);
    refs.hero?.style.removeProperty('--universe-progress');
    refs.hero?.style.removeProperty('--universe-intro');
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
    refs.hud.hidden = mode !== 'universe';
    refs.hint.hidden = mode !== 'universe';
    if (mode === 'universe') {
      refs.levelText.textContent = LEVEL_NAMES[1] ?? '';
      // Give the keyboard somewhere sensible to land.
      if (!refs.hud.contains(document.activeElement)) {
        refs.hud.querySelector<HTMLElement>('[data-universe-action="exit"]')?.focus();
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
    refs.detailKind.textContent =
      node.kind === 'comet' ? 'Current source' : node.kind === 'home' ? 'Home' : node.kind;
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

  /* --------------------------------------------------------------- input */
  function beginGesture(delta: number) {
    const instance = ensureStage();
    if (!open) showOverlay();
    gestureValue = Math.max(0, Math.min(1, gestureValue + delta));
    instance.setProgress(gestureValue);
    window.clearTimeout(gestureTimer);
    gestureTimer = window.setTimeout(endGesture, 170);
  }

  function endGesture() {
    if (!stage) return;
    if (gestureValue >= 0.999 || gestureValue <= 0.001) return;
    // Past a third of the way in, the reveal has already happened — finish
    // it rather than snapping the visitor back to where they started.
    if (gestureValue > 0.33) {
      stage.runTo(1);
      gestureValue = 1;
    } else {
      stage.runTo(0);
      gestureValue = 0;
    }
  }

  /**
   * How far one input event should carry the transition. Pinch deltas are
   * small and continuous; wheel notches are large and discrete, so they are
   * damped much harder or a single flick would swallow the whole reveal.
   */
  const advance = (event: WheelEvent) => {
    // Positive means "further out". A trackpad pinch inward reports a
    // positive deltaY; scrolling up past the top of the page reports a
    // negative one. Both mean the same thing here.
    const raw = event.ctrlKey ? event.deltaY : -event.deltaY;
    return raw / (event.ctrlKey ? 160 : 520);
  };

  window.addEventListener(
    'wheel',
    (event) => {
      // --- on the page: only the zoom-out direction is claimed, only at the
      // top of the hero, and only until the universe takes over. Browser
      // zoom is never permanently hijacked.
      if (!open) {
        if (window.scrollY > 8) return;
        const pinchIn = event.ctrlKey && event.deltaY > 0;
        const pullUp = !event.ctrlKey && event.deltaY < -2;
        if (!pinchIn && !pullUp) return;
        event.preventDefault();
        beginGesture(advance(event));
        return;
      }

      if (!stage) return;

      // --- mid-transition: keep feeding the same gesture, in either
      // direction, so the reveal tracks the fingers instead of running away
      // from them.
      if (stage.mode === 'transition') {
        event.preventDefault();
        beginGesture(advance(event));
        return;
      }

      // --- in the universe: whole semantic levels, and past the last one,
      // back out to the page the visitor came from. "Out" is the same
      // direction that got them here, so the gesture never reverses meaning
      // halfway through the experience.
      event.preventDefault();
      if (advance(event) > 0) {
        if (!stage.zoomOutOneLevel()) {
          gestureValue = 1;
          beginGesture(-Math.abs(advance(event)));
        }
      } else {
        stage.zoomInOneLevel();
      }
    },
    { passive: false, signal }
  );

  /* --------------------------------------------------------------- touch */
  let pinchStart = 0;
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
      const hit = stage.pick(event.clientX, event.clientY);
      stage.setHover(hit);
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

  window.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length !== 2) return;
      const [a, b] = [event.touches[0]!, event.touches[1]!];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinchStart) {
        pinchStart = distance;
        return;
      }
      const ratio = distance / pinchStart;
      if (!open && window.scrollY <= 8 && ratio < 0.92) {
        event.preventDefault();
        beginGesture((0.92 - ratio) * 1.4);
        pinchStart = distance;
      } else if (open && stage?.mode === 'transition') {
        // Pinching in carries on out; spreading pulls back to the page.
        event.preventDefault();
        beginGesture((1 - ratio) * 1.4);
        pinchStart = distance;
      } else if (open && stage?.mode === 'universe') {
        if (ratio < 0.86) {
          if (!stage.zoomOutOneLevel()) stage.runTo(0);
          pinchStart = distance;
        } else if (ratio > 1.16) {
          stage.zoomInOneLevel();
          pinchStart = distance;
        }
      }
    },
    { passive: false, signal }
  );

  window.addEventListener('touchend', () => {
    pinchStart = 0;
  }, { signal });

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

  refs.opener?.addEventListener(
    'click',
    () => {
      const instance = ensureStage();
      if (!open) showOverlay();
      gestureValue = 0;
      instance.runTo(1);
    },
    { signal }
  );

  /* ----------------------------------------------------------- lifecycle */
  window.addEventListener('resize', () => stage?.resize(), { passive: true, signal });
  document.addEventListener(
    'visibilitychange',
    () => stage?.setPaused(document.hidden),
    { signal }
  );

  return {
    setProgress(value) {
      const instance = ensureStage();
      if (!open) showOverlay();
      gestureValue = value;
      instance.setProgress(value);
    },
    commit() {
      ensureStage().runTo(1);
    },
    release() {
      stage?.runTo(0);
    },
    open() {
      const instance = ensureStage();
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
    opener: document.querySelector<HTMLElement>('[data-universe-open]'),
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

  const planetAttr = (wrapper.dataset.artPlanet ?? '').split(',').map(Number);
  const planet =
    planetAttr.length === 3 && planetAttr.every((value) => Number.isFinite(value))
      ? { cx: planetAttr[0]!, cy: planetAttr[1]!, r: planetAttr[2]! }
      : { cx: 0.64, cy: 0.5, r: 0.39 };

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
    focus,
    headline: document.querySelector<HTMLElement>('.hero__heading'),
    starRect: star ? star.getBoundingClientRect() : null,
  };
}
