import * as THREE from 'three';
import type { NodeRecord } from './data';
import { clamp } from './util';

/**
 * Labels live in the DOM, not in the canvas.
 *
 * Three things fall out of that and all three matter: the type is crisp and
 * uses the site's own fonts, each label is a real focusable control so the
 * map is navigable by keyboard and legible to a screen reader, and labels
 * can be laid out with ordinary CSS instead of texture atlases.
 *
 * The cost of that choice is that layout has to be *read* from the DOM, and
 * reading layout in the same frame as writing it is the classic way to make
 * a render loop slow. So sizes are measured once, in a single batched pass,
 * and never read again during animation.
 */

export interface LabelHandle {
  id: string;
  node: NodeRecord;
  element: HTMLButtonElement | HTMLAnchorElement;
  /** 0 hides the label entirely; it is removed from the tab order too. */
  target: number;
  current: number;
  screen: { x: number; y: number; visible: boolean };
  /** Intrinsic size, measured while laid out and then cached. */
  width: number;
  height: number;
  /** Ranking for collision priority — fixed, so computed once. */
  rank: number;
  /* --- committed state, so the DOM is only written when it changes --- */
  placed: boolean;
  lastX: number;
  lastY: number;
  lastOpacity: number;
  lastFocusable: boolean;
  /** When the visibility decision was last allowed to change. */
  settledAt: number;
}

export interface LabelLayerOptions {
  container: HTMLElement;
  nodes: NodeRecord[];
  onActivate(node: NodeRecord): void;
  onHover(node: NodeRecord | null): void;
}

const KIND_CLASS: Record<NodeRecord['kind'], string> = {
  region: 'u-label--region',
  system: 'u-label--system',
  planet: 'u-label--planet',
  home: 'u-label--home',
  comet: 'u-label--comet',
  mark: 'u-label--mark',
};

/** Margins the HUD occupies, plus a little breathing room at the edges. */
const SAFE = { top: 76, right: 16, bottom: 62, left: 16 };

/**
 * Collision hysteresis.
 *
 * A label that is already up keeps its place until it is properly buried;
 * one that is down waits until it is properly clear. Without the gap between
 * these two numbers a label sitting exactly on the boundary flips state on
 * whatever sub-pixel the camera happens to land on.
 */
const BURY = 0.3;
const CLEAR = 0.06;

/**
 * And a floor on how often that decision may change at all. Hysteresis
 * alone is a band; this is a guarantee — nothing can oscillate faster than
 * this no matter what the geometry does.
 */
const DWELL_MS = 360;

/**
 * How far a label's edge sits from the thing it names, in pixels. Close
 * enough to read as attached, far enough not to sit on it.
 */
const ATTACH_GAP = 10;

export function createLabelLayer(options: LabelLayerOptions) {
  const handles: LabelHandle[] = [];
  const projected = new THREE.Vector3();
  const originProjected = new THREE.Vector3();

  for (const node of options.nodes) {
    const external = !!node.href && /^https?:\/\//i.test(node.href);
    const element = document.createElement(node.href ? 'a' : 'button');
    element.className = `u-label ${KIND_CLASS[node.kind]}`;
    element.dataset.nodeId = node.id;

    if (element instanceof HTMLAnchorElement && node.href) {
      element.href = node.href;
      if (external) {
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
    } else if (element instanceof HTMLButtonElement) {
      element.type = 'button';
    }

    if (node.shortLabel) {
      // Two forms, one meaning: the short one is drawn at rest and the full
      // one on hover or focus. The accessible name is always the full one.
      element.setAttribute('aria-label', node.label);
      for (const [variant, value] of [
        ['short', node.shortLabel],
        ['full', node.label],
      ] as const) {
        const span = document.createElement('span');
        span.className = `u-label__text u-label__text--${variant}`;
        span.textContent = value;
        span.setAttribute('aria-hidden', 'true');
        element.append(span);
      }
    } else {
      const text = document.createElement('span');
      text.className = 'u-label__text';
      text.textContent = node.label;
      element.append(text);
    }

    if (node.kind === 'planet' && !node.href) {
      const status = document.createElement('span');
      status.className = 'u-label__status';
      status.textContent = 'no destination yet';
      element.append(status);
    }

    // A planet with a real destination is a link and behaves like one. Every
    // other label flies the camera instead of navigating.
    element.addEventListener('click', (event) => {
      if (element instanceof HTMLAnchorElement) return;
      event.preventDefault();
      options.onActivate(node);
    });
    element.addEventListener('pointerenter', () => options.onHover(node));
    element.addEventListener('focus', () => options.onHover(node));
    element.addEventListener('pointerleave', () => options.onHover(null));
    element.addEventListener('blur', () => options.onHover(null));

    options.container.append(element);
    handles.push({
      id: node.id,
      node,
      element,
      target: 0,
      current: 0,
      screen: { x: 0, y: 0, visible: false },
      width: 120,
      height: 22,
      rank: rankOf(node),
      placed: false,
      lastX: Number.NaN,
      lastY: Number.NaN,
      lastOpacity: -1,
      lastFocusable: false,
      settledAt: 0,
    });
  }

  const byId = new Map(handles.map((handle) => [handle.id, handle]));
  // Collision priority never changes, so the order is settled once rather
  // than re-sorted on every frame.
  const ordered = [...handles].sort((a, b) => b.rank - a.rank);

  /**
   * Measure every label in one pass: all the reads together, then all the
   * writes. Interleaving them is what turns a label layer into a layout
   * thrash, and reading a hidden element's width is what made the collision
   * result depend on the collision result.
   */
  function measure() {
    for (const handle of handles) {
      handle.element.style.visibility = 'hidden';
      handle.element.hidden = false;
    }
    for (const handle of handles) {
      handle.width = handle.element.offsetWidth || 120;
      handle.height = handle.element.offsetHeight || 22;
    }
    for (const handle of handles) {
      handle.element.style.visibility = '';
      handle.element.hidden = !handle.placed;
    }
  }

  let destroyed = false;
  measure();
  // Web fonts change every one of those numbers when they arrive.
  document.fonts?.ready
    .then(() => {
      if (!destroyed) measure();
    })
    .catch(() => {});

  /* --------------------------------------------------------- change gate */
  // A fingerprint of everything the layout depends on. While it holds still
  // and nothing is fading, the entire projection and collision pass is
  // skipped — which in a stationary view is every frame.
  const fingerprint = new Float64Array(14);
  const previous = new Float64Array(14);
  let hasPrevious = false;

  const boxes: { x: number; y: number; w: number; h: number }[] = handles.map(() => ({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }));
  const placedBoxes: typeof boxes = [];
  // Last frame's node positions, so a stationary view can still notice the
  // one or two things in the map that move on their own.
  const positions = new Float64Array(handles.length * 3);

  return {
    handles,
    get(id: string) {
      return byId.get(id);
    },
    setTarget(id: string, value: number) {
      const handle = byId.get(id);
      if (handle) handle.target = clamp(value);
    },
    setAll(value: number) {
      for (const handle of handles) handle.target = clamp(value);
    },
    /** Re-measure after anything that could change intrinsic label size. */
    remeasure: measure,
    /**
     * Project every visible label and drop the ones that would collide.
     * Bigger labels win, so a galaxy name is never hidden by one of its own
     * systems — the composition stays readable instead of turning into a
     * pile of overlapping type.
     */
    update(
      camera: THREE.PerspectiveCamera,
      root: THREE.Object3D,
      viewport: { width: number; height: number },
      dt: number
    ) {
      let animating = false;
      for (const handle of handles) {
        if (Math.abs(handle.target - handle.current) > 0.002) {
          handle.current += (handle.target - handle.current) * Math.min(1, dt * 6);
          animating = true;
        } else if (handle.current !== handle.target) {
          handle.current = handle.target;
          animating = true;
        }
      }

      const m = root.matrixWorld.elements;
      fingerprint[0] = camera.position.x;
      fingerprint[1] = camera.position.y;
      fingerprint[2] = camera.position.z;
      fingerprint[3] = camera.quaternion.x;
      fingerprint[4] = camera.quaternion.y;
      fingerprint[5] = camera.quaternion.z;
      fingerprint[6] = camera.quaternion.w;
      fingerprint[7] = m[0]!;
      fingerprint[8] = m[5]!;
      fingerprint[9] = m[12]!;
      fingerprint[10] = m[13]!;
      fingerprint[11] = m[14]!;
      fingerprint[12] = viewport.width;
      fingerprint[13] = viewport.height;

      let moved = !hasPrevious;
      if (!moved) {
        for (let i = 0; i < fingerprint.length; i += 1) {
          if (fingerprint[i] !== previous[i]) {
            moved = true;
            break;
          }
        }
      }
      previous.set(fingerprint);
      hasPrevious = true;

      const now = performance.now();

      if (moved || animating) {
        // Everything may have shifted: place the whole set, in priority
        // order, so a name is only ever buried by a more important one.
        placedBoxes.length = 0;
        for (let index = 0; index < ordered.length; index += 1) {
          place(index, camera, root, viewport, now);
        }
        rememberPositions();
        return;
      }

      // The view is holding still, but the map is not entirely static: the
      // comet travels its orbit, and the home world's smiley rides the
      // planet. Rather than name those, notice that a node's position has
      // changed and re-place just that label against the layout the last
      // full pass settled on. Comparing a hundred floats is nothing next to
      // projecting and colliding every label again, and it means anything
      // that starts moving later is handled without being told about.
      for (let index = 0; index < ordered.length; index += 1) {
        const at = ordered[index]!.node.position;
        const slot = index * 3;
        if (
          positions[slot] === at[0] &&
          positions[slot + 1] === at[1] &&
          positions[slot + 2] === at[2]
        ) {
          continue;
        }
        positions[slot] = at[0];
        positions[slot + 1] = at[1];
        positions[slot + 2] = at[2];
        place(index, camera, root, viewport, now);
      }
    },
    destroy() {
      destroyed = true;
      for (const handle of handles) handle.element.remove();
    },
  };

  /** Cache every node's position, so the next frame can spot what moved. */
  function rememberPositions() {
    for (let index = 0; index < ordered.length; index += 1) {
      const at = ordered[index]!.node.position;
      const slot = index * 3;
      positions[slot] = at[0];
      positions[slot + 1] = at[1];
      positions[slot + 2] = at[2];
    }
  }

  /**
   * Project one label, decide where it sits, and show it unless the labels
   * already placed have taken too much of it. `placedBoxes` is the layout so
   * far: a full pass fills it in priority order, and a single moving label
   * re-enters it in place.
   */
  function place(
    index: number,
    camera: THREE.PerspectiveCamera,
    root: THREE.Object3D,
    viewport: { width: number; height: number },
    now: number
  ) {
    const handle = ordered[index]!;
    const box = boxes[index]!;

    if (handle.current < 0.02) {
      settle(handle, box, false, now);
      return;
    }

    // The node's place is the universe's business; the label's offset is the
    // screen's. Transform the position by the root (which may be scaled and,
    // in portrait, turned a quarter turn) and only then step the label away
    // from it along world axes — so "below the galaxy" stays below on screen
    // whichever way the composition is oriented.
    projected
      .set(handle.node.position[0], handle.node.position[1], handle.node.position[2])
      .applyMatrix4(root.matrixWorld);
    // The world-space step first: it scales with the scene, so it is what
    // clears whatever the region draws around this node at any zoom. The
    // screen-space gap below is only the final few pixels.
    const offset = handle.node.labelOffset;
    if (offset) {
      const scale = root.scale.x;
      projected.x += offset[0] * scale;
      projected.y += offset[1] * scale;
      projected.z += offset[2] * scale;
    }
    projected.project(camera);

    if (projected.z > 1) {
      settle(handle, box, false, now);
      return;
    }

    const nodeX = (projected.x * 0.5 + 0.5) * viewport.width;
    const nodeY = (0.5 - projected.y * 0.5) * viewport.height;

    box.w = handle.width;
    box.h = handle.height;

    // Where the label goes relative to its node.
    //
    // A galaxy name keeps its world-space offset, because it has to scale
    // with the galaxy. Everything smaller is placed on the far side of its
    // node from whatever it belongs to — a system away from its galaxy, a
    // planet away from its system. That is what keeps a label out of the
    // bright middle of a dense region, where the type simply cannot be read
    // over the particles, and it makes which star a name belongs to
    // unambiguous.
    let x = nodeX;
    let y = nodeY;
    if (handle.node.kind !== 'region') {
      let dirX = 0;
      let dirY = 1;
      const origin = handle.node.origin;
      if (origin) {
        originProjected.set(origin[0], origin[1], origin[2]).applyMatrix4(root.matrixWorld);
        originProjected.project(camera);
        dirX = nodeX - (originProjected.x * 0.5 + 0.5) * viewport.width;
        dirY = nodeY - (0.5 - originProjected.y * 0.5) * viewport.height;
        const length = Math.hypot(dirX, dirY);
        // A node sitting on top of its own origin — a galaxy's central
        // system, say — has no outward direction, so it falls back to
        // straight down.
        if (length < 1) {
          dirX = 0;
          dirY = 1;
        } else {
          dirX /= length;
          dirY /= length;
        }
      }
      // Distance from the label's centre to its own edge along that
      // direction, so the gap is the same whichever way it points.
      const edge = Math.min(
        Math.abs(dirX) > 1e-4 ? Math.abs(box.w / 2 / dirX) : Infinity,
        Math.abs(dirY) > 1e-4 ? Math.abs(box.h / 2 / dirY) : Infinity
      );
      const reach = edge + ATTACH_GAP + (handle.node.labelPad ?? 0);
      x = nodeX + dirX * reach;
      y = nodeY + dirY * reach;
    }

    box.x = x - box.w / 2;
    box.y = y - box.h / 2;

    // Keep every label whole and clear of the HUD. A narrow viewport is the
    // common case here — a galaxy name is wider than a third of a phone — so
    // nudge the label back inside rather than dropping it, and only give up
    // when the nudge would be big enough to point at the wrong object.
    const fitX = fit(box.x, box.w, SAFE.left, viewport.width - SAFE.right);
    const fitY = fit(box.y, box.h, SAFE.top, viewport.height - SAFE.bottom);
    if (Math.abs(fitX - box.x) > box.w * 0.45 || Math.abs(fitY - box.y) > box.h * 1.5) {
      settle(handle, box, false, now);
      return;
    }
    box.x = fitX;
    box.y = fitY;

    // How much of this label the labels above it have already taken. A label
    // never buries itself: on a re-place its own box is still in the layout.
    let buried = 0;
    for (let other = 0; other < placedBoxes.length; other += 1) {
      const against = placedBoxes[other]!;
      if (against === box) continue;
      buried += overlapFraction(box, against);
      if (buried >= 1) break;
    }

    // Hysteresis, so a label on the boundary does not flip on sub-pixel
    // camera drift, plus a dwell floor so nothing can oscillate quickly even
    // if the geometry does something unexpected.
    const threshold = handle.placed ? BURY : CLEAR;
    let show = buried <= threshold;
    if (show !== handle.placed && now - handle.settledAt < DWELL_MS) show = handle.placed;

    settle(handle, box, show, now);
  }

  /** Commit a decision, and keep the layout list in step with it. */
  function settle(
    handle: LabelHandle,
    box: { x: number; y: number; w: number; h: number },
    show: boolean,
    now: number
  ) {
    const at = placedBoxes.indexOf(box);
    if (show && at < 0) placedBoxes.push(box);
    else if (!show && at >= 0) placedBoxes.splice(at, 1);
    commit(handle, show, now, box, handle.current);
  }

  /** Write to the DOM only where something actually changed. */
  function commit(
    handle: LabelHandle,
    show: boolean,
    now: number,
    box?: { x: number; y: number; w: number; h: number },
    opacity = 0
  ) {
    if (show !== handle.placed) {
      handle.placed = show;
      handle.settledAt = now;
      handle.element.hidden = !show;
    }
    if (!show) {
      if (handle.screen.visible) handle.screen.visible = false;
      if (handle.lastFocusable) {
        handle.lastFocusable = false;
        handle.element.tabIndex = -1;
        handle.element.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    if (!box) return;

    const x = Math.round(box.x + box.w / 2);
    const y = Math.round(box.y + box.h / 2);
    if (x !== handle.lastX || y !== handle.lastY) {
      handle.lastX = x;
      handle.lastY = y;
      handle.element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
    const rounded = Math.round(opacity * 100) / 100;
    if (rounded !== handle.lastOpacity) {
      handle.lastOpacity = rounded;
      handle.element.style.opacity = String(rounded);
    }
    const focusable = opacity > 0.6;
    if (focusable !== handle.lastFocusable) {
      handle.lastFocusable = focusable;
      handle.element.tabIndex = focusable ? 0 : -1;
      handle.element.setAttribute('aria-hidden', focusable ? 'false' : 'true');
    }
    handle.screen.x = x;
    handle.screen.y = y;
    handle.screen.visible = true;
  }
}

/** Fraction of `box` covered by `other`. */
function overlapFraction(
  box: { x: number; y: number; w: number; h: number },
  other: { x: number; y: number; w: number; h: number }
): number {
  const dx = Math.min(box.x + box.w, other.x + other.w) - Math.max(box.x, other.x);
  if (dx <= 0) return 0;
  const dy = Math.min(box.y + box.h, other.y + other.h) - Math.max(box.y, other.y);
  if (dy <= 0) return 0;
  return (dx * dy) / (box.w * box.h);
}

/** Slide a box of width `size` back inside [min, max], if it fits at all. */
function fit(start: number, size: number, min: number, max: number): number {
  if (size > max - min) return min;
  return Math.min(Math.max(start, min), max - size);
}

function rankOf(node: NodeRecord): number {
  if (node.kind === 'region') return 4;
  if (node.kind === 'home') return 3;
  if (node.kind === 'system') return 2;
  return 1;
}

export type LabelLayer = ReturnType<typeof createLabelLayer>;
