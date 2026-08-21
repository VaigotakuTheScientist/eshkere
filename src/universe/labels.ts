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
 */

export interface LabelHandle {
  id: string;
  node: NodeRecord;
  element: HTMLButtonElement | HTMLAnchorElement;
  /** 0 hides the label entirely; it is removed from the tab order too. */
  target: number;
  current: number;
  screen: { x: number; y: number; visible: boolean };
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
};

export function createLabelLayer(options: LabelLayerOptions) {
  const handles: LabelHandle[] = [];
  const projected = new THREE.Vector3();

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
    });
  }

  const byId = new Map(handles.map((handle) => [handle.id, handle]));

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
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const ordered = [...handles].sort((a, b) => rank(b.node) - rank(a.node));

      for (const handle of ordered) {
        handle.current += (handle.target - handle.current) * Math.min(1, dt * 6);

        if (handle.current < 0.02) {
          hide(handle);
          continue;
        }

        // The node's place is the universe's business; the label's offset is
        // the screen's. Transform the position by the root (which may be
        // scaled and, in portrait, turned a quarter turn) and only then step
        // the label away from it along world axes — so "below the galaxy"
        // stays below on screen whichever way the composition is oriented.
        projected
          .set(handle.node.position[0], handle.node.position[1], handle.node.position[2])
          .applyMatrix4(root.matrixWorld);
        const offset = handle.node.labelOffset;
        if (offset) {
          const scale = root.scale.x;
          projected.x += offset[0] * scale;
          projected.y += offset[1] * scale;
          projected.z += offset[2] * scale;
        }
        projected.project(camera);

        if (projected.z > 1) {
          hide(handle);
          continue;
        }

        const x = (projected.x * 0.5 + 0.5) * viewport.width;
        // Galaxy names are offset in world space so they scale with the
        // galaxy; everything smaller gets a fixed drop in screen pixels, so
        // a system's name clears its own star at every zoom level.
        const drop = handle.node.kind === 'region' ? 0 : 26;
        const y = (0.5 - projected.y * 0.5) * viewport.height + drop;
        const width = handle.element.offsetWidth || 120;
        const height = handle.element.offsetHeight || 22;
        const box = { x: x - width / 2, y: y - height / 2, w: width, h: height };

        // Keep every label whole and clear of the HUD. A narrow viewport is
        // the common case here — a galaxy name is wider than a third of a
        // phone — so nudge the label back inside rather than dropping it,
        // and only give up when the nudge would be big enough to point at
        // the wrong object.
        const nudged = {
          x: fit(box.x, box.w, SAFE.left, viewport.width - SAFE.right),
          y: fit(box.y, box.h, SAFE.top, viewport.height - SAFE.bottom),
        };
        if (
          Math.abs(nudged.x - box.x) > box.w * 0.45 ||
          Math.abs(nudged.y - box.y) > box.h * 1.5
        ) {
          hide(handle);
          continue;
        }
        box.x = nudged.x;
        box.y = nudged.y;

        const collides = placed.some(
          (other) =>
            box.x < other.x + other.w &&
            box.x + box.w > other.x &&
            box.y < other.y + other.h &&
            box.y + box.h > other.y
        );
        if (collides) {
          hide(handle);
          continue;
        }
        placed.push(box);

        const placedX = box.x + box.w / 2;
        const placedY = box.y + box.h / 2;
        handle.screen = { x: placedX, y: placedY, visible: true };
        handle.element.style.transform = `translate3d(${Math.round(placedX)}px, ${Math.round(placedY)}px, 0) translate(-50%, -50%)`;
        handle.element.style.opacity = String(handle.current);
        handle.element.hidden = false;
        handle.element.tabIndex = handle.current > 0.6 ? 0 : -1;
        handle.element.setAttribute('aria-hidden', handle.current > 0.6 ? 'false' : 'true');
      }
    },
    destroy() {
      for (const handle of handles) handle.element.remove();
    },
  };
}

/** Margins the HUD occupies, plus a little breathing room at the edges. */
const SAFE = { top: 76, right: 16, bottom: 62, left: 16 };

/** Slide a box of width `size` back inside [min, max], if it fits at all. */
function fit(start: number, size: number, min: number, max: number): number {
  if (size > max - min) return min;
  return Math.min(Math.max(start, min), max - size);
}

function hide(handle: LabelHandle) {
  handle.screen.visible = false;
  handle.element.hidden = true;
  handle.element.tabIndex = -1;
  handle.element.setAttribute('aria-hidden', 'true');
}

function rank(node: NodeRecord): number {
  if (node.kind === 'region') return 4;
  if (node.kind === 'home') return 3;
  if (node.kind === 'system') return 2;
  return 1;
}

export type LabelLayer = ReturnType<typeof createLabelLayer>;
