import * as THREE from 'three';
import { bakeTexture } from './bake';
import { gaussish, hexToRgb, range, rng } from './util';

/**
 * The sky the universe hangs in: three parallax star layers, a faint dust
 * haze, two soft nebulae, and the radial streak field that only shows up at
 * peak escape velocity.
 *
 * Every luminous thing here is drawn additively on black, which is what
 * gives the bloom without a post-processing pass. A round sprite is
 * generated in the fragment shader rather than loaded, so the universe adds
 * no image requests.
 */

/** Soft round sprite with a hot core — the look of every point in the map. */
const POINT_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uOpacity;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    // Two-term falloff: a wide halo plus a tight core. Cheap fake bloom.
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.22, 0.0, d);
    float a = (halo * halo * 0.55 + core) * vAlpha * uOpacity;
    gl_FragColor = vec4(vColor, a);
  }
`;

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    // Slow, out-of-phase twinkle. Never fast enough to read as flicker.
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.25 + aSeed * 0.5) + aSeed * 43.0);
    vAlpha = twinkle;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * (1100.0 / max(-mv.z, 1.0)), 1.0, 34.0);
    gl_Position = projectionMatrix * mv;
  }
`;

export interface SkyLayer {
  object: THREE.Points;
  material: THREE.ShaderMaterial;
}

function pointsMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 1 },
    },
    vertexShader: STAR_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * One parallax shell of stars. `depth` pushes the layer further from the
 * camera's resting position, so the near layers slide past faster during the
 * escape and the far ones barely move — the whole point of the effect.
 */
export function createStarLayer(options: {
  count: number;
  seed: number;
  spread: number;
  depth: [number, number];
  size: [number, number];
  colors: string[];
}): SkyLayer {
  const r = rng(options.seed);
  const positions = new Float32Array(options.count * 3);
  const colors = new Float32Array(options.count * 3);
  const sizes = new Float32Array(options.count);
  const seeds = new Float32Array(options.count);
  const palette = options.colors.map(hexToRgb);

  for (let i = 0; i < options.count; i += 1) {
    positions[i * 3] = gaussish(r) * options.spread * 2;
    positions[i * 3 + 1] = gaussish(r) * options.spread * 1.25;
    positions[i * 3 + 2] = range(r, options.depth[0], options.depth[1]);

    const tint = palette[Math.floor(r() * palette.length)] ?? [1, 1, 1];
    // Most stars stay near-white; the palette only tints the minority, which
    // is what keeps a saturated sky from turning into confetti.
    const saturation = r() < 0.72 ? 0.12 : 0.85;
    colors[i * 3] = 1 - (1 - tint[0]) * saturation;
    colors[i * 3 + 1] = 1 - (1 - tint[1]) * saturation;
    colors[i * 3 + 2] = 1 - (1 - tint[2]) * saturation;

    sizes[i] = range(r, options.size[0], options.size[1]);
    seeds[i] = r();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = pointsMaterial();
  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;
  return { object, material };
}

/** The noise field a nebula is made of — evaluated once, into a texture. */
const NEBULA_BAKE = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y);
  }

  void main() {
    // Three octaves here rather than two: this runs once, so detail is free.
    float n = noise(vUv * 4.0) * 0.58
            + noise(vUv * 9.0) * 0.28
            + noise(vUv * 19.0) * 0.14;
    gl_FragColor = vec4(vec3(n), 1.0);
  }
`;

/**
 * A soft coloured cloud. Two of these keep the void from reading as an empty
 * black rectangle without competing with the galaxies for attention.
 *
 * The noise is baked once and shared by both; each still drifts across its
 * own texture, so they keep the slow life they had when every fragment
 * recomputed the field from scratch. Between them these two quads cover most
 * of the screen, which made them one of the most expensive things drawn.
 */
export function createNebula(
  noise: THREE.Texture,
  options: {
    position: THREE.Vector3Like;
    size: number;
    color: string;
    opacity: number;
    rotation?: number;
    drift?: number;
  }
): THREE.Mesh {
  const [r, g, b] = hexToRgb(options.color);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Vector3(r, g, b) },
      uOpacity: { value: options.opacity },
      uTime: { value: 0 },
      uNoise: { value: noise },
      uDrift: { value: options.drift ?? 0.004 },
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
      uniform float uTime;
      uniform float uDrift;
      uniform sampler2D uNoise;

      void main() {
        vec2 p = vUv - 0.5;
        float falloff = smoothstep(0.5, 0.05, length(p));
        if (falloff <= 0.0) discard;
        float n = texture2D(uNoise, vUv + vec2(uTime * uDrift, uTime * uDrift * 0.6)).r;
        gl_FragColor = vec4(uColor, falloff * falloff * n * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // A disc, not a square. The cloud's falloff reaches zero at half the
  // quad's width, so the corners were being rasterised and then thrown away
  // — a fifth of the most expensive surface in the scene, for nothing.
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(options.size / 2, 48), material);
  mesh.position.set(options.position.x, options.position.y, options.position.z);
  mesh.rotation.z = options.rotation ?? 0;
  mesh.frustumCulled = false;
  return mesh;
}

export interface StreakField {
  object: THREE.LineSegments;
  material: THREE.ShaderMaterial;
}

/**
 * The hyperspace beat. Each streak is a segment lying along the travel axis;
 * `uStreak` stretches it from nothing to its full length. Under perspective
 * that reads as stars smearing radially out of the screen centre, which is
 * what escape velocity is supposed to look like — and it costs one draw
 * call that is invisible whenever `uStreak` is zero.
 */
export function createStreaks(count = 900, seed = 5150): StreakField {
  const r = rng(seed);
  const positions = new Float32Array(count * 6);
  const lengths = new Float32Array(count * 2);
  const ends = new Float32Array(count * 2);
  const alphas = new Float32Array(count * 2);
  const colors = new Float32Array(count * 6);
  const tints: [number, number, number][] = [
    [1, 1, 1],
    hexToRgb('#4de3ff'),
    hexToRgb('#ff4fc8'),
    hexToRgb('#9d6bff'),
  ];

  for (let i = 0; i < count; i += 1) {
    const angle = r() * Math.PI * 2;
    // Hollow cylinder: nothing directly on the camera axis, where a streak
    // would just sit as a dot in the middle of the frame.
    const radius = range(r, 90, 780);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.75;
    const z = range(r, -260, 1240);
    const len = range(r, 70, 300);
    const tint = tints[Math.floor(r() * tints.length)] ?? [1, 1, 1];
    const alpha = range(r, 0.35, 1);

    for (const [v, endFlag] of [
      [0, 0],
      [1, 1],
    ]) {
      positions[i * 6 + v * 3] = x;
      positions[i * 6 + v * 3 + 1] = y;
      positions[i * 6 + v * 3 + 2] = z;
      colors[i * 6 + v * 3] = tint[0];
      colors[i * 6 + v * 3 + 1] = tint[1];
      colors[i * 6 + v * 3 + 2] = tint[2];
      lengths[i * 2 + v] = len;
      ends[i * 2 + v] = endFlag;
      alphas[i * 2 + v] = alpha;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aLength', new THREE.BufferAttribute(lengths, 1));
  geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uStreak: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aLength;
      attribute float aEnd;
      attribute float aAlpha;
      uniform float uStreak;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = aColor;
        // The tail end fades out along its own length.
        vAlpha = aAlpha * uStreak * mix(1.0, 0.15, aEnd);
        vec3 p = position;
        p.z += aEnd * aLength * uStreak;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying vec3 vColor;
      varying float vAlpha;
      void main() { gl_FragColor = vec4(vColor, vAlpha); }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const object = new THREE.LineSegments(geometry, material);
  object.frustumCulled = false;
  return { object, material };
}

/** Assemble the whole backdrop as one group, plus handles for animation. */
export function createSky(renderer: THREE.WebGLRenderer, quality: 'high' | 'low') {
  const group = new THREE.Group();
  const scale = quality === 'high' ? 1 : 0.45;

  const layers: SkyLayer[] = [
    createStarLayer({
      count: Math.round(2600 * scale),
      seed: 101,
      spread: 1700,
      depth: [-2600, -1500],
      size: [0.7, 2.0],
      colors: ['#9d6bff', '#4de3ff'],
    }),
    createStarLayer({
      count: Math.round(1800 * scale),
      seed: 202,
      spread: 1150,
      depth: [-1300, -420],
      size: [1.1, 3.0],
      colors: ['#4de3ff', '#ff4fc8', '#eaf6ff'],
    }),
    createStarLayer({
      count: Math.round(900 * scale),
      seed: 303,
      spread: 800,
      depth: [-300, 620],
      size: [1.6, 4.4],
      colors: ['#eaf6ff', '#ffb992', '#ff4fc8'],
    }),
  ];
  for (const layer of layers) group.add(layer.object);

  // One noise field, baked once and shared by both clouds.
  const nebulaNoise = bakeTexture(renderer, NEBULA_BAKE, {}, 512);
  nebulaNoise.texture.wrapS = THREE.RepeatWrapping;
  nebulaNoise.texture.wrapT = THREE.RepeatWrapping;

  const nebulae = [
    createNebula(nebulaNoise.texture, {
      position: { x: -760, y: 300, z: -1900 },
      size: 2900,
      color: '#5a2bd0',
      opacity: 0.16,
      drift: 0.004,
    }),
    createNebula(nebulaNoise.texture, {
      position: { x: 820, y: -420, z: -2100 },
      size: 3200,
      color: '#0f3f9a',
      opacity: 0.14,
      rotation: 1.1,
      drift: -0.0032,
    }),
  ];
  for (const nebula of nebulae) group.add(nebula);

  const streaks = createStreaks(Math.round(900 * scale));
  group.add(streaks.object);

  return {
    group,
    layers,
    nebulae,
    streaks,
    /** First thing to go when a device cannot keep up: it is atmosphere. */
    setNebulae(visible: boolean) {
      for (const nebula of nebulae) nebula.visible = visible;
    },
    dispose() {
      nebulaNoise.dispose();
      for (const layer of layers) {
        layer.object.geometry.dispose();
        layer.material.dispose();
      }
      for (const nebula of nebulae) {
        nebula.geometry.dispose();
        (nebula.material as THREE.Material).dispose();
      }
      streaks.object.geometry.dispose();
      streaks.material.dispose();
    },
    update(time: number, pixelRatio: number) {
      for (const layer of layers) {
        layer.material.uniforms.uTime!.value = time;
        layer.material.uniforms.uPixelRatio!.value = pixelRatio;
      }
      for (const nebula of nebulae) {
        (nebula.material as THREE.ShaderMaterial).uniforms.uTime!.value = time;
      }
    },
  };
}

export type Sky = ReturnType<typeof createSky>;
