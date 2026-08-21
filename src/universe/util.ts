/**
 * Small helpers shared by the universe layer.
 *
 * Everything here is deterministic on purpose: the map is an authored
 * composition, not a simulation, so a given build always produces the same
 * sky. That keeps screenshots comparable and makes visual regressions
 * obvious.
 */

/**
 * Mulberry32 — a tiny seeded PRNG. Each generator gets its own seed so
 * adding a galaxy never reshuffles the stars in the others.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max) from a seeded generator. */
export const range = (r: () => number, min: number, max: number): number =>
  min + r() * (max - min);

/**
 * Sum of three uniforms — a cheap bell curve. Used where a cluster should
 * thin out towards its edges instead of ending abruptly.
 */
export const gaussish = (r: () => number): number => (r() + r() + r()) / 3 - 0.5;

export const clamp = (value: number, min = 0, max = 1): number =>
  value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Remap `value` from [inMin, inMax] to [0, 1], clamped at both ends. */
export const track = (value: number, inMin: number, inMax: number): number =>
  clamp((value - inMin) / (inMax - inMin));

/** Smooth 0→1 ramp across a sub-range of the transition timeline. */
export const phase = (value: number, inMin: number, inMax: number): number => {
  const t = track(value, inMin, inMax);
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Frame-rate independent approach: pulls `current` a fixed *proportion* of
 * the way to `target` per second, so the same motion plays out identically
 * at 60Hz and 120Hz.
 */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** #rrggbb → linear-ish [r, g, b] in 0..1, good enough for additive points. */
export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Blend two hex colours and return an rgb triplet. */
export function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
