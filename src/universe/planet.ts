import * as THREE from 'three';
import { clamp } from './util';

/**
 * The home world.
 *
 * The hero artwork is a single painted view of a globe that runs off the
 * bottom of its own canvas, so scaling it backwards can only ever produce a
 * cropped disc. Instead the artwork hands over to a real sphere, early —
 * while the camera is still accelerating and the streaks are at their peak.
 *
 * The hand-over has nothing to notice because it is not a cross-fade between
 * two different pictures. At the moment of the swap this sphere renders the
 * artwork itself, projected orthographically onto its own front hemisphere,
 * which reproduces the masked disc pixel for pixel. `uMorph` then dissolves
 * that projection into a procedural planet: continents, coastlines, city
 * lights on the night side, an atmosphere rim. The silhouette never changes;
 * only the surface resolves.
 */

const VERTEX = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vPos = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  varying vec3 vPos;
  varying vec3 vNormal;

  uniform sampler2D uMap;
  uniform vec2 uMaskCentre;
  uniform float uMaskRadius;
  uniform float uImageAspect;
  uniform float uMorph;
  uniform float uSpin;
  uniform float uOpacity;
  uniform float uRadius;
  /** xy = position on the visible face in unit-disc coords, z = radius. */
  uniform vec3 uSmiley;
  uniform float uSmileyGlow;

  float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x),
          mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
          mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float amplitude = 0.5;
    float sum = 0.0;
    for (int i = 0; i < 4; i += 1) {
      sum += amplitude * noise3(p);
      p = p * 2.07 + vec3(11.3, 5.7, 19.1);
      amplitude *= 0.5;
    }
    return sum;
  }

  vec3 spin(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  }

  void main() {
    vec3 n = normalize(vNormal);
    // The sphere is billboarded, so object space is view space: +z is
    // towards the camera and xy is the screen plane.
    vec2 face = vPos.xy / uRadius;

    /* ---------------------------------------------- the artwork, projected */
    vec2 uv = uMaskCentre + vec2(face.x * uMaskRadius / uImageAspect, face.y * uMaskRadius);
    vec3 painted = texture2D(uMap, uv).rgb;

    /* ------------------------------------------------- the procedural world
       Built the way the artist built the globe: an almost black world with
       everything interesting drawn on it in neon that keeps glowing straight
       through the terminator. Shading the surface bright would have produced
       a completely different object from the one that just handed over. */
    vec3 sp = spin(normalize(vPos), uSpin);

    float continent = fbm(sp * 1.7);
    float land = smoothstep(0.50, 0.56, continent);

    vec3 ocean = mix(vec3(0.006, 0.012, 0.055), vec3(0.02, 0.05, 0.17), fbm(sp * 3.1));
    vec3 ground = mix(vec3(0.03, 0.02, 0.10), vec3(0.11, 0.03, 0.17), fbm(sp * 5.2));
    vec3 base = mix(ocean, ground, land);

    vec3 sun = normalize(vec3(0.52, 0.58, 0.62));
    float day = smoothstep(-0.22, 0.45, dot(n, sun));
    vec3 lit = base * mix(0.05, 0.9, day);

    // Coastline — a thin bright edge exactly where land meets water.
    float coast = smoothstep(0.487, 0.501, continent) - smoothstep(0.501, 0.516, continent);
    lit += vec3(0.25, 1.0, 0.95) * coast * 1.45;

    // The broad magenta continental wash the artwork is built on.
    float wash = smoothstep(0.555, 0.68, continent);
    lit += vec3(1.0, 0.16, 0.72) * wash * 0.5;

    // Filaments across the land: the glowing networks drawn on the original.
    float ridged = 1.0 - abs(fbm(sp * 6.5) * 2.0 - 1.0);
    float veins = smoothstep(0.885, 0.99, ridged) * land;
    lit += mix(vec3(1.0, 0.35, 0.85), vec3(0.45, 0.95, 1.0), fbm(sp * 2.0)) * veins * 0.85;

    // City lights, on land, only where the sun is not.
    float cities = smoothstep(0.76, 0.92, noise3(sp * 34.0)) * land * (1.0 - day);
    lit += vec3(1.0, 0.58, 0.18) * cities * 1.7;

    // Atmosphere. Tight on the limb, brightest where the sun catches it.
    float fresnel = pow(1.0 - abs(n.z), 3.6);
    lit += vec3(0.28, 0.76, 1.0) * fresnel * (0.5 + 1.05 * day);

    vec3 colour = mix(painted, lit, uMorph);

    /* -------------------------------------------------------- the smiley */
    // Pinned to the visible face rather than the surface, so it is always
    // where the artwork drew it and always clickable.
    vec2 local = (face - uSmiley.xy) / max(uSmiley.z, 0.0001);
    float dist = length(local);
    if (dist < 1.6 && uMorph > 0.01) {
      // Fades in with the surface — until then the artwork is still painting
      // its own smiley, and two of them would be one too many.
      float disc = smoothstep(1.0, 0.86, dist) * smoothstep(0.0, 0.55, uMorph);
      vec3 smiley = vec3(0.70, 0.96, 0.16);
      float eyes = smoothstep(0.20, 0.13, length(local - vec2(-0.32, 0.28)))
                 + smoothstep(0.20, 0.13, length(local - vec2(0.32, 0.28)));
      float mouth = smoothstep(0.15, 0.08, abs(length(local - vec2(0.0, 0.18)) - 0.60))
                  * step(local.y, 0.05);
      vec3 marked = mix(smiley, vec3(0.03, 0.06, 0.02), clamp(eyes + mouth, 0.0, 1.0));
      colour = mix(colour, marked, disc);
      // A halo that only shows on hover.
      colour += vec3(0.70, 0.96, 0.16) * smoothstep(1.6, 1.0, dist) * uSmileyGlow * 0.7
              * smoothstep(0.0, 0.55, uMorph);
    }

    gl_FragColor = vec4(colour, uOpacity);
  }
`;

export interface PlanetOptions {
  texture: THREE.Texture;
  /** Where the artist drew the globe, as fractions of the source image. */
  planet: { cx: number; cy: number; r: number };
  imageAspect: number;
  /** Radius of the mask that closes around the globe, in image heights. */
  closedRadius: number;
  /** Where the artwork's smiley sits on the face, in unit-disc coords. */
  mark: { x: number; y: number; r: number };
  quality: 'high' | 'low';
}

export interface Planet {
  group: THREE.Group;
  /** Place and size the planet. Radius is in world units. */
  place(position: THREE.Vector3, radius: number): void;
  /** 0 = the painted artwork, 1 = the procedural world. */
  setMorph(value: number): void;
  /**
   * Match the plane's mask as it closes, so the two are the same disc at
   * every moment of the hand-over rather than only at the end of it.
   */
  setProjection(maskRadius: number): void;
  setOpacity(value: number): void;
  setSmileyGlow(value: number): void;
  /** World position of the smiley, for picking and labelling. */
  smileyWorld(out: THREE.Vector3): THREE.Vector3;
  update(time: number, camera: THREE.Camera): void;
  dispose(): void;
}

export function createPlanet(options: PlanetOptions): Planet {
  const group = new THREE.Group();
  const markFace = new THREE.Vector2(options.mark.x, options.mark.y);
  // The artist's smiley is small. Enlarge it just enough to stay a legible
  // mark and a fair click target once the planet is far away.
  const markSize = Math.max(options.mark.r * 1.9, 0.05);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: options.texture },
      uMaskCentre: { value: new THREE.Vector2(options.planet.cx, 1 - options.planet.cy) },
      uMaskRadius: { value: options.closedRadius },
      uImageAspect: { value: options.imageAspect },
      uMorph: { value: 0 },
      uSpin: { value: 0 },
      uOpacity: { value: 0 },
      uRadius: { value: 1 },
      uSmiley: { value: new THREE.Vector3(markFace.x, markFace.y, markSize) },
      uSmileyGlow: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  });

  const segments = options.quality === 'high' ? 96 : 48;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, segments, segments / 2), material);
  sphere.frustumCulled = false;
  // Draws after the hero plane it replaces, so the hand-over is a clean
  // stack rather than two coplanar surfaces fighting over the same pixels.
  sphere.renderOrder = 2;
  group.add(sphere);

  /* ------------------------------------------------------------- orbits */
  // The artwork draws neon rings looping the globe; without them the planet
  // reads as a different object at long range.
  const rings: THREE.Mesh[] = [];
  for (const [index, spec] of [
    { radius: 1.28, tilt: new THREE.Euler(1.33, 0.2, 0.3), colour: '#4de3ff', width: 0.005 },
    { radius: 1.5, tilt: new THREE.Euler(1.46, -0.32, 1.05), colour: '#ff4fc8', width: 0.004 },
    { radius: 1.74, tilt: new THREE.Euler(1.24, 0.55, 2.0), colour: '#9d6bff', width: 0.0035 },
  ].entries()) {
    const geometry = new THREE.RingGeometry(
      spec.radius - spec.width,
      spec.radius + spec.width,
      128
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(spec.colour),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(geometry, ringMaterial);
    ring.rotation.copy(spec.tilt);
    ring.frustumCulled = false;
    ring.renderOrder = 1 + index * 0.01;
    rings.push(ring);
    group.add(ring);
  }

  /* --------------------------------------------------------------- glow */
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
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
      uniform float uOpacity;
      void main() {
        float d = length(vUv - vec2(0.5)) * 2.0;
        float halo = pow(max(0.0, 1.0 - d), 3.0);
        gl_FragColor = vec4(vec3(0.25, 0.66, 1.0), halo * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), glowMaterial);
  glow.frustumCulled = false;
  glow.renderOrder = 0;
  group.add(glow);

  let radius = 1;
  let opacity = 0;
  let morph = 0;

  return {
    group,
    place(position: THREE.Vector3, value: number) {
      radius = Math.max(value, 0.0001);
      group.position.copy(position);
      group.scale.setScalar(radius);
      material.uniforms.uRadius!.value = 1;
    },
    setMorph(value: number) {
      morph = clamp(value);
      material.uniforms.uMorph!.value = morph;
    },
    setProjection(maskRadius: number) {
      material.uniforms.uMaskRadius!.value = maskRadius;
    },
    setOpacity(value: number) {
      opacity = clamp(value);
      material.uniforms.uOpacity!.value = opacity;
      group.visible = opacity > 0.003;
      for (const ring of rings) {
        (ring.material as THREE.MeshBasicMaterial).opacity = opacity * morph * 0.4;
      }
      glowMaterial.uniforms.uOpacity!.value = opacity * morph * 0.5;
    },
    setSmileyGlow(value: number) {
      material.uniforms.uSmileyGlow!.value = clamp(value);
    },
    smileyWorld(out: THREE.Vector3) {
      // The face is billboarded, so the smiley's world position follows the
      // camera's own right/up axes.
      return out
        .set(markFace.x, markFace.y, Math.sqrt(Math.max(0, 1 - markFace.lengthSq())))
        .applyQuaternion(group.quaternion)
        .multiplyScalar(radius)
        .add(group.position);
    },
    update(time: number, camera: THREE.Camera) {
      if (!group.visible) return;
      // Billboarding keeps object space aligned to the screen, which is what
      // lets the projected artwork stay locked while the camera flies.
      group.quaternion.copy(camera.quaternion);
      material.uniforms.uSpin!.value = time * 0.05 * morph;
      for (const [index, ring] of rings.entries()) {
        ring.rotation.z += (0.0016 + index * 0.0007) * morph;
      }
      glow.quaternion.copy(camera.quaternion);
      // Keep the rings and glow correct while the group is uniformly scaled.
      for (const ring of rings) ring.scale.setScalar(1);
    },
    dispose() {
      sphere.geometry.dispose();
      material.dispose();
      glow.geometry.dispose();
      glowMaterial.dispose();
      for (const ring of rings) {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
    },
  };
}
