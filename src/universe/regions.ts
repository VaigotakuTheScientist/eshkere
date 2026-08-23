import * as THREE from 'three';
import type { Region, Vec3 } from './data';
import { gaussish, hexToRgb, mixRgb, range, rng } from './util';

/**
 * Region geometry: the Health Core plus the four game galaxies.
 *
 * Each region gets its own morphology rather than its own flat brand colour
 * — a lattice, a vortex, a spiral and a cloud read as different *kinds of
 * place*, which a recoloured blob never does. They share one point shader
 * so the whole map still looks like one universe.
 */

const REGION_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;
  attribute float aFlow;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBreath;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = 0.68 + 0.32 * sin(uTime * (0.3 + aSeed * 0.7) + aSeed * 31.0);

    vec3 p = position;
    // Differential rotation about the region's own axis: the inside turns
    // faster than the rim, which is what stops a galaxy looking like a decal.
    float ang = uTime * aFlow;
    float c = cos(ang), s = sin(ang);
    p.xy = mat2(c, -s, s, c) * p.xy;
    p *= uBreath;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // The constant is the distance at which a point renders at its authored
    // size. It has to be of the order of the universe's own camera distance,
    // or every galaxy collapses to a field of single pixels.
    gl_PointSize = clamp(aSize * uPixelRatio * (1550.0 / max(-mv.z, 1.0)), 1.0, 26.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const REGION_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    // A soft halo with a tight core: reads as a star at one pixel and as a
    // glow at ten, which is the whole range these points are drawn at.
    float shape = smoothstep(0.5, 0.0, d) * smoothstep(0.5, 0.0, d) * 0.6
      + smoothstep(0.24, 0.0, d);
    float a = shape * vAlpha * uOpacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

interface CloudPoint {
  x: number;
  y: number;
  z: number;
  size: number;
  /** 0 = core colour, 1 = rim colour. */
  tint: number;
  flow: number;
}

function pointsFromCloud(points: CloudPoint[], palette: string[]) {
  const count = points.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const flows = new Float32Array(count);
  // A ramp across however many colours the region declares, so a palette can
  // carry one hue per named system rather than always exactly three.
  const ramp = (palette.length ? palette : ['#ffffff']).map(hexToRgb);
  const last = ramp.length - 1;
  const r = rng(9001);

  points.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
    const scaled = Math.max(0, Math.min(1, point.tint)) * last;
    const step = Math.min(last, Math.floor(scaled));
    const rgb = mixRgb(ramp[step]!, ramp[Math.min(last, step + 1)]!, scaled - step);
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
    sizes[i] = point.size;
    seeds[i] = r();
    flows[i] = point.flow;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aFlow', new THREE.BufferAttribute(flows, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 1 },
      uBreath: { value: 1 },
    },
    vertexShader: REGION_VERTEX,
    fragmentShader: REGION_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;
  return { object, material };
}

/* -------------------------------------------------------- morphologies */

/**
 * Where the region's named systems sit, in the region's own coordinates.
 *
 * A galaxy's dust used to be generated with no knowledge of this, which is
 * how Culture & Play ended up with seven bright clumps in one set of places
 * and five labelled stars in another — every label correctly attached to a
 * star that happened to be sitting in a gap. The shapes that have visible
 * structure now grow that structure around the things that have names.
 */
type Anchors = Vec3[];

/** Morphologies whose visible structure is built on the system anchors. */
const ANCHORED = new Set<Region['morphology']>(['cloud', 'lattice']);

/** AI Safety — a jittered shell lattice: engineered, high-energy, ordered. */
function latticeCloud(radius: number, seed: number, count: number): CloudPoint[] {
  const r = rng(seed);
  const points: CloudPoint[] = [];
  const step = radius / 5.5;

  // A quantised grid, softened. Structure you can feel without counting it.
  for (let i = -5; i <= 5; i += 1) {
    for (let j = -5; j <= 5; j += 1) {
      for (let k = -2; k <= 2; k += 1) {
        const x = i * step + gaussish(r) * step * 0.55;
        const y = j * step + gaussish(r) * step * 0.55;
        const z = k * step * 0.8 + gaussish(r) * step * 0.4;
        const d = Math.hypot(x, y, z * 1.4);
        if (d > radius) continue;
        points.push({
          x,
          y,
          z,
          size: range(r, 3.0, 6.4) * (1 - d / radius / 1.7),
          tint: d / radius,
          flow: 0.014 * (1 - d / radius / 2),
        });
        // A short spur off each node: the lattice reads as wired together
        // rather than as a cloud that happens to be evenly spaced.
        for (let n = 0; n < 3; n += 1) {
          const along = (n + 1) / 4;
          points.push({
            x: x * (1 - along * 0.14),
            y: y * (1 - along * 0.14),
            z: z * (1 - along * 0.14),
            size: range(r, 0.8, 1.7),
            tint: d / radius,
            flow: 0.014 * (1 - d / radius / 2),
          });
        }
      }
    }
  }

  // Signal dust filling the gaps between lattice nodes.
  for (let i = points.length; i < count; i += 1) {
    const d = Math.pow(r(), 0.55) * radius;
    const angle = r() * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * d,
      y: Math.sin(angle) * d,
      z: gaussish(r) * radius * 0.42,
      size: range(r, 1.0, 2.4),
      tint: Math.min(1, d / radius + range(r, -0.15, 0.15)),
      flow: 0.012,
    });
  }
  return points;
}

/** Power — streams converging on a conversion core. Kinetic, gravitational. */
function vortexCloud(radius: number, seed: number, count: number): CloudPoint[] {
  const r = rng(seed);
  const points: CloudPoint[] = [];
  const streams = 5;

  for (let i = 0; i < count; i += 1) {
    const stream = i % streams;
    // Density rises sharply towards the middle: everything is being pulled in.
    const t = Math.pow(r(), 1.9);
    const d = radius * (0.06 + t * 0.94);
    const angle =
      (stream / streams) * Math.PI * 2 + Math.log(d / radius + 0.08) * 2.6 + gaussish(r) * 0.34;
    points.push({
      x: Math.cos(angle) * d,
      y: Math.sin(angle) * d * 0.92,
      z: gaussish(r) * radius * 0.3 * (0.3 + t),
      size: range(r, 1.2, 3.6) * (1.5 - t),
      tint: t,
      // Inner material whips round; the outer streams barely move.
      flow: 0.05 * (1 - t) + 0.004,
    });
  }
  return points;
}

/** Knowledge & Science — a clean two-arm logarithmic spiral. */
function spiralCloud(radius: number, seed: number, count: number): CloudPoint[] {
  const r = rng(seed);
  const points: CloudPoint[] = [];
  const arms = 2;
  const tightness = 3.4;

  for (let i = 0; i < count; i += 1) {
    const arm = i % arms;
    const t = Math.pow(r(), 0.62);
    const d = radius * t;
    const spread = 0.16 + 0.34 * t;
    const angle = (arm / arms) * Math.PI * 2 + t * tightness + gaussish(r) * spread * 2;
    points.push({
      x: Math.cos(angle) * d,
      y: Math.sin(angle) * d,
      // A genuinely thin disc — the only region that reads as flat.
      z: gaussish(r) * radius * 0.09,
      size: range(r, 1.1, 3.4) * (1.35 - t * 0.7),
      tint: t,
      flow: 0.02 * (1 - t * 0.55),
    });
  }

  // A dense, near-white bulge at the centre.
  for (let i = 0; i < count * 0.14; i += 1) {
    const d = Math.pow(r(), 2.4) * radius * 0.2;
    const angle = r() * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * d,
      y: Math.sin(angle) * d,
      z: gaussish(r) * radius * 0.05,
      size: range(r, 1.6, 3.8),
      tint: 0,
      flow: 0.03,
    });
  }
  return points;
}

/** Culture & Play — irregular neon clumps, drawn as pixels rather than stars. */
/**
 * Culture & Play — an archipelago.
 *
 * Its first form was a handful of overlapping gaussian blobs of hard square
 * pixels, which additive blending turned into one white-hot pile in the
 * middle: bright, blocky, and impossible to tell apart. This is the opposite
 * shape. Each named system is its own small open cluster, sitting on a ring
 * with nothing in the centre, carrying its own colour out of the region's
 * palette and wearing a thin arc like an atoll. Between them is a sparse sea
 * so the whole thing still reads as one galaxy rather than five islands.
 *
 * Nothing in a cluster flows: the labels are anchored to these positions, so
 * dust that rotated away from them would undo the attachment. The sea drifts
 * instead, which is where the life comes from.
 */
function archipelagoCloud(
  radius: number,
  seed: number,
  count: number,
  anchors: Anchors = []
): CloudPoint[] {
  const r = rng(seed);
  const points: CloudPoint[] = [];
  if (anchors.length === 0) return points;

  const last = Math.max(1, anchors.length - 1);
  const perCluster = Math.floor((count * 0.78) / anchors.length);
  const core = radius * 0.17;

  anchors.forEach((anchor, index) => {
    // One hue per system, so the region can be read from a distance: five
    // colours in five places, not one neon smear.
    const hue = index / last;
    const tiltX = range(r, -0.5, 0.5);
    const tiltY = range(r, -0.5, 0.5);

    for (let i = 0; i < perCluster; i += 1) {
      // A shallow power keeps the population out at the edges instead of
      // piling it in the centre — the difference between an open cluster
      // and a blob.
      const onArc = i % 100 < 17;
      const t = onArc ? 1.45 + gaussish(r) * 0.06 : Math.pow(r(), 0.72);
      const a = r() * Math.PI * 2;
      const d = core * t;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d * (onArc ? 0.62 : 0.94);
      const z = (onArc ? gaussish(r) * core * 0.1 : gaussish(r) * core * 0.42) + x * tiltX + y * tiltY;
      const bright = !onArc && r() < 0.05;
      points.push({
        x: anchor[0] + x,
        y: anchor[1] + y,
        z: anchor[2] + z,
        size: bright ? range(r, 2.6, 3.9) : range(r, 1.1, 2.4),
        tint: hue + gaussish(r) * 0.03,
        flow: 0,
      });
    }
  });

  // The sea: faint, wide, and the only part that moves.
  const sea = count - points.length;
  for (let i = 0; i < sea; i += 1) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.5) * radius * 1.16;
    points.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * 0.88,
      z: gaussish(r) * radius * 0.3,
      size: range(r, 0.8, 1.7),
      tint: r(),
      flow: 0.004 + r() * 0.004,
    });
  }
  return points;
}

/** Health Core — a dense warm nucleus that thins into three broad arcs. */
function coreCloud(radius: number, seed: number, count: number): CloudPoint[] {
  const r = rng(seed);
  const points: CloudPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    // Steep power keeps almost everything inside the nucleus.
    const t = Math.pow(r(), 3.1);
    const d = radius * t;
    const angle = r() * Math.PI * 2;
    const tilt = (r() - 0.5) * Math.PI;
    points.push({
      x: Math.cos(angle) * d,
      y: Math.sin(angle) * d,
      z: Math.sin(tilt) * d * 0.62,
      size: range(r, 1.4, 4.4) * (1.5 - t),
      tint: t,
      flow: 0.026 * (1 - t),
    });
  }
  return points;
}

/* ------------------------------------------------------ region assembly */

export interface RegionObject {
  id: string;
  group: THREE.Group;
  /** Region-wide brightness, animated when focus changes. */
  setOpacity(value: number): void;
  update(time: number, pixelRatio: number): void;
  /** Bright centre used for the halo and for camera targeting. */
  centre: THREE.Vector3;
  radius: number;
}

/**
 * A big, soft, additive disc. Stacked behind every bright object, this is
 * what stands in for a bloom pass: resolution-independent, one draw call,
 * and it costs nothing when its opacity is zero.
 */
export function createHalo(color: string, size: number, opacity: number): THREE.Mesh {
  const [r, g, b] = hexToRgb(color);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Vector3(r, g, b) },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float d = length(vUv - vec2(0.5)) * 2.0;
        float halo = pow(max(0.0, 1.0 - d), 2.6);
        float core = pow(max(0.0, 1.0 - d * 3.4), 2.0);
        gl_FragColor = vec4(uColor, (halo * 0.55 + core) * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.frustumCulled = false;
  return mesh;
}

/** A thin luminous ring — containment rings, lensing rims, core arcs. */
function createRing(options: {
  radius: number;
  thickness: number;
  color: string;
  opacity: number;
  arc?: number;
  rotation?: THREE.Euler;
}): THREE.Mesh {
  const geometry = new THREE.RingGeometry(
    options.radius - options.thickness / 2,
    options.radius + options.thickness / 2,
    96,
    1,
    0,
    options.arc ?? Math.PI * 2
  );
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(options.color),
    transparent: true,
    opacity: options.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  if (options.rotation) mesh.rotation.copy(options.rotation);
  mesh.frustumCulled = false;
  return mesh;
}

const CLOUD_BUILDERS: Record<
  Region['morphology'],
  (radius: number, seed: number, count: number, anchors: Anchors) => CloudPoint[]
> = {
  core: coreCloud,
  lattice: latticeCloud,
  vortex: vortexCloud,
  spiral: spiralCloud,
  cloud: archipelagoCloud,
};

export function buildRegion(region: Region, quality: 'high' | 'low'): RegionObject {
  const group = new THREE.Group();
  group.position.set(region.position[0], region.position[1], region.position[2]);

  const density = quality === 'high' ? 1 : 0.5;
  const baseCount = Math.round(
    (region.morphology === 'core' ? 2600 : 5200) * density
  );
  const anchors: Anchors = region.systems.map((system) => system.offset);
  const cloud = CLOUD_BUILDERS[region.morphology](
    region.radius,
    region.seed,
    baseCount,
    anchors
  );
  const dust = pointsFromCloud(cloud, region.palette);
  group.add(dust.object);

  const extras: { material: THREE.Material; base: number }[] = [];
  const addExtra = (object: THREE.Mesh, base: number) => {
    extras.push({ material: object.material as THREE.Material, base });
    group.add(object);
  };

  // Every region gets a halo; the core gets a much larger, warmer one, and
  // the archipelago gets a much fainter one — it has no bright middle to
  // sit behind, and a strong glow there was most of what made it muddy.
  const haloStrength =
    region.morphology === 'core' ? 0.48 : region.morphology === 'cloud' ? 0.16 : 0.44;
  const halo = createHalo(
    region.palette[0] ?? '#ffffff',
    region.radius * (region.morphology === 'core' ? 4.4 : region.morphology === 'cloud' ? 2.2 : 3.0),
    haloStrength
  );
  addExtra(halo, haloStrength);

  const r = rng(region.seed + 77);

  switch (region.morphology) {
    case 'lattice': {
      // Containment rings on three axes: the engineered feel, in one gesture.
      for (const [i, tilt] of [0.2, 1.15, 2.1].entries()) {
        addExtra(
          createRing({
            radius: region.radius * (0.55 + i * 0.2),
            thickness: 1.8,
            color: i === 1 ? '#9d6bff' : '#4de3ff',
            opacity: 0.42,
            rotation: new THREE.Euler(tilt, i * 0.6, i * 0.4),
          }),
          0.42
        );
      }
      // Signal beacons, sitting on the systems themselves — the lattice's
      // bright points and its named points are the same points.
      for (const [i, anchor] of anchors.slice(0, 4).entries()) {
        const beacon = createHalo(i % 2 ? '#9d6bff' : '#8ff0ff', region.radius * 0.34, 0.44);
        beacon.position.set(anchor[0], anchor[1], anchor[2]);
        addExtra(beacon, 0.44);
      }
      addExtra(createHalo('#4de3ff', region.radius * 1.4, 0.26), 0.26);
      break;
    }
    case 'vortex': {
      // Bright rim around a dark middle: light bending round a mass.
      addExtra(
        createRing({
          radius: region.radius * 0.3,
          thickness: 7,
          color: '#ffd9f0',
          opacity: 0.8,
          rotation: new THREE.Euler(0.42, 0.2, 0),
        }),
        0.8
      );
      addExtra(
        createRing({
          radius: region.radius * 0.52,
          thickness: 2.2,
          color: '#ff4fc8',
          opacity: 0.36,
          rotation: new THREE.Euler(0.42, 0.2, 0),
        }),
        0.36
      );
      addExtra(createHalo('#ff8fd8', region.radius * 1.5, 0.55), 0.55);
      break;
    }
    case 'spiral': {
      // A crystalline figure laid over the disc — the diagrammatic hint.
      const vertices: number[] = [];
      const nodes = Array.from({ length: 7 }, () => {
        const angle = r() * Math.PI * 2;
        const d = range(r, 0.35, 0.95) * region.radius;
        return new THREE.Vector3(
          Math.cos(angle) * d,
          Math.sin(angle) * d,
          gaussish(r) * region.radius * 0.1
        );
      });
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          if (nodes[i]!.distanceTo(nodes[j]!) > region.radius * 0.85) continue;
          vertices.push(nodes[i]!.x, nodes[i]!.y, nodes[i]!.z);
          vertices.push(nodes[j]!.x, nodes[j]!.y, nodes[j]!.z);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color('#9fe8ff'),
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const constellation = new THREE.LineSegments(geometry, material);
      constellation.frustumCulled = false;
      extras.push({ material, base: 0.16 });
      group.add(constellation);
      break;
    }
    case 'cloud': {
      // An island glow under each cluster, in that cluster's own colour, so
      // the archipelago reads as five lit places rather than one field.
      const last = Math.max(1, anchors.length - 1);
      anchors.forEach((anchor, index) => {
        const colour = region.palette[
          Math.min(region.palette.length - 1, Math.round((index / last) * (region.palette.length - 1)))
        ];
        const island = createHalo(colour ?? '#ffffff', region.radius * 0.8, 0.3);
        island.position.set(anchor[0], anchor[1], anchor[2]);
        addExtra(island, 0.3);
      });

      // And a figure joining them: the thing that turns a scatter of
      // clusters into a constellation. Each island is drawn to the next
      // around the ring, which is the order they were authored in.
      if (anchors.length > 2) {
        const vertices: number[] = [];
        anchors.forEach((from, index) => {
          const to = anchors[(index + 1) % anchors.length]!;
          vertices.push(from[0], from[1], from[2], to[0], to[1], to[2]);
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const material = new THREE.LineBasicMaterial({
          color: new THREE.Color('#eaf6ff'),
          transparent: true,
          opacity: 0.09,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const figure = new THREE.LineSegments(geometry, material);
        figure.frustumCulled = false;
        extras.push({ material, base: 0.09 });
        group.add(figure);
      }

      // Small surreal shapes drifting outside the ring: the visual jokes,
      // now out where they read as objects rather than as more debris.
      for (let i = 0; i < 5; i += 1) {
        const glyph = createRing({
          radius: range(r, 14, 32),
          thickness: range(r, 1.2, 2.6),
          color: region.palette[i % region.palette.length] ?? '#c8f542',
          opacity: 0.42,
          arc: range(r, 1.2, Math.PI * 2),
          rotation: new THREE.Euler(r() * 2, r() * 2, r() * 2),
        });
        const angle = r() * Math.PI * 2;
        const away = range(r, 1.35, 1.95) * region.radius;
        glyph.position.set(
          Math.cos(angle) * away,
          Math.sin(angle) * away * 0.8,
          gaussish(r) * region.radius * 0.5
        );
        addExtra(glyph, 0.42);
      }
      break;
    }
    case 'core': {
      // Physical, mental, social — three arcs, not three labels on a pie.
      for (const [i, tilt] of [
        new THREE.Euler(1.2, 0.3, 0),
        new THREE.Euler(0.4, 1.1, 1.2),
        new THREE.Euler(-0.7, 0.6, 2.4),
      ].entries()) {
        addExtra(
          createRing({
            radius: region.radius * (0.78 + i * 0.16),
            thickness: 2.6,
            color: ['#ffb992', '#ff4fc8', '#ffe9c9'][i] ?? '#ffb992',
            opacity: 0.42,
            arc: Math.PI * 1.35,
            rotation: tilt,
          }),
          0.42
        );
      }
      addExtra(createHalo('#ffd9a8', region.radius * 2.1, 0.7), 0.7);
      break;
    }
  }

  let breath = 1;
  let opacity = 1;

  return {
    id: region.id,
    group,
    centre: new THREE.Vector3(region.position[0], region.position[1], region.position[2]),
    radius: region.radius,
    setOpacity(value: number) {
      opacity = value;
      dust.material.uniforms.uOpacity!.value = value;
      for (const extra of extras) {
        const material = extra.material as THREE.Material & { opacity: number };
        const uniforms = (extra.material as THREE.ShaderMaterial).uniforms;
        if (uniforms?.uOpacity) uniforms.uOpacity.value = extra.base * value;
        else material.opacity = extra.base * value;
      }
    },
    update(time: number, pixelRatio: number) {
      if (opacity <= 0.001) {
        group.visible = false;
        return;
      }
      group.visible = true;
      // Slow breathing: a few percent, over many seconds. Any more and the
      // whole map starts to feel like it is pulsing at you.
      breath = 1 + Math.sin(time * 0.19 + region.seed) * 0.018;
      dust.material.uniforms.uTime!.value = time;
      dust.material.uniforms.uPixelRatio!.value = pixelRatio;
      dust.material.uniforms.uBreath!.value = breath;
      // A region whose structure is built on its named systems cannot turn:
      // the labels are pinned to those positions, and dust that rotated away
      // from them would pull the whole thing apart over a minute or two.
      group.rotation.z = ANCHORED.has(region.morphology)
        ? 0
        : time * 0.004 * (region.morphology === 'spiral' ? -1 : 1);
    },
  };
}
