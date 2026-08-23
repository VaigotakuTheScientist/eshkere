import * as THREE from 'three';
import type { Link, NodeRecord } from './data';
import { createHalo } from './regions';
import { clamp, hexToRgb } from './util';

/**
 * Addressable objects and the filaments between them.
 *
 * Star systems, planets, the home world and the Current Source comet are all
 * drawn as billboarded halos so they read as light sources rather than
 * geometry, and so they stay legible whatever angle the camera arrives from.
 */

const KIND_STYLE: Record<NodeRecord['kind'], { color: string; size: number }> = {
  region: { color: '#ffffff', size: 0 },
  system: { color: '#dff3ff', size: 30 },
  planet: { color: '#c8f542', size: 20 },
  home: { color: '#8fe6ff', size: 46 },
  comet: { color: '#fff6d0', size: 34 },
  // The smiley is drawn by the planet's own shader, so its marker is only a
  // hit target and a hover halo — it must not paint a second light source.
  mark: { color: '#c8f542', size: 13 },
};

export interface Marker {
  id: string;
  node: NodeRecord;
  group: THREE.Group;
  position: THREE.Vector3;
  setOpacity(value: number): void;
  setEmphasis(value: number): void;
  update(time: number, camera: THREE.Camera): void;
}

export function createMarker(node: NodeRecord): Marker {
  const style = KIND_STYLE[node.kind];
  const group = new THREE.Group();
  group.position.set(node.position[0], node.position[1], node.position[2]);

  const halo = createHalo(style.color, style.size * 4.2, 0.34);
  const core = createHalo('#ffffff', style.size * 1.5, 0.9);
  group.add(halo, core);

  const haloUniforms = (halo.material as THREE.ShaderMaterial).uniforms;
  const coreUniforms = (core.material as THREE.ShaderMaterial).uniforms;

  let opacity = 0;
  let emphasis = 0;
  const seed = node.id.length * 0.7 + node.position[0] * 0.01;

  return {
    id: node.id,
    node,
    group,
    position: group.position,
    setOpacity(value: number) {
      opacity = clamp(value);
    },
    setEmphasis(value: number) {
      emphasis = clamp(value);
    },
    update(time: number, camera: THREE.Camera) {
      group.visible = opacity > 0.004;
      if (!group.visible) return;
      // Billboard: a light source has no orientation of its own.
      halo.quaternion.copy(camera.quaternion);
      core.quaternion.copy(camera.quaternion);
      const pulse = 1 + Math.sin(time * 0.9 + seed) * 0.06;
      const scale = (1 + emphasis * 0.55) * pulse;
      halo.scale.setScalar(scale);
      core.scale.setScalar(scale);
      haloUniforms.uOpacity!.value = opacity * (0.34 + emphasis * 0.5);
      coreUniforms.uOpacity!.value = opacity * (0.9 + emphasis * 0.6);
    },
  };
}

/* ------------------------------------------------------------ filaments */

const LINK_VERTEX = /* glsl */ `
  attribute float aT;
  uniform float uPulse;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINK_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float vT;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPulse;
  void main() {
    // A single travelling highlight, so a filament reads as a direction
    // rather than a wire.
    float head = exp(-pow((vT - uPulse) * 7.0, 2.0));
    float body = 0.22 + 0.78 * head;
    gl_FragColor = vec4(uColor, body * uOpacity);
  }
`;

export interface Filament {
  link: Link;
  object: THREE.Line;
  setOpacity(value: number): void;
  update(dt: number): void;
}

/**
 * A curved thread between two nodes. The lift is perpendicular-ish to the
 * pair and scales with distance, so cross-galaxy links arc over the void
 * instead of cutting through whatever sits between them.
 */
export function createFilament(link: Link, from: THREE.Vector3, to: THREE.Vector3): Filament {
  const mid = from.clone().lerp(to, 0.5);
  const span = from.distanceTo(to);
  const lift = new THREE.Vector3(0, 0, 1)
    .cross(to.clone().sub(from).normalize())
    .normalize()
    .multiplyScalar(span * 0.17);
  lift.z += span * 0.1;
  const curve = new THREE.QuadraticBezierCurve3(from.clone(), mid.add(lift), to.clone());
  const samples = curve.getPoints(48);

  const geometry = new THREE.BufferGeometry().setFromPoints(samples);
  geometry.setAttribute(
    'aT',
    new THREE.Float32BufferAttribute(
      samples.map((_, i) => i / (samples.length - 1)),
      1
    )
  );

  const [r, g, b] = hexToRgb('#9fd8ff');
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Vector3(r, g, b) },
      uOpacity: { value: 0 },
      uPulse: { value: 0 },
    },
    vertexShader: LINK_VERTEX,
    fragmentShader: LINK_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const object = new THREE.Line(geometry, material);
  object.frustumCulled = false;
  object.visible = false;

  let opacity = 0;
  let pulse = 0;

  return {
    link,
    object,
    setOpacity(value: number) {
      opacity = clamp(value);
    },
    update(dt: number) {
      object.visible = opacity > 0.004;
      if (!object.visible) return;
      pulse = (pulse + dt * 0.55) % 1.6;
      material.uniforms.uOpacity!.value = opacity * 0.75;
      material.uniforms.uPulse!.value = pulse;
    },
  };
}

/* --------------------------------------------------------------- comet */

export interface Comet {
  group: THREE.Group;
  head: THREE.Vector3;
  setOpacity(value: number): void;
  setEmphasis(value: number): void;
  /** Force the head to a world position — used while it peels off the hero. */
  overrideHead(position: THREE.Vector3 | null): void;
  update(time: number, camera: THREE.Camera): void;
}

/**
 * The Current Source comet. It is the only object in the map that is
 * expected to change between deployments, so it is drawn as a transient:
 * warm, moving, and unlike every permanent node around it.
 */
export function createComet(): Comet {
  const group = new THREE.Group();
  const head = createHalo('#fff3c4', 150, 0.9);
  const glow = createHalo('#ffd98a', 340, 0.4);
  group.add(glow, head);

  const TAIL = 26;
  const tailPositions = new Float32Array(TAIL * 3);
  const tailAlpha = new Float32Array(TAIL);
  const tailGeometry = new THREE.BufferGeometry();
  tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailPositions, 3));
  tailGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(tailAlpha, 1));
  const tailMaterial = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aAlpha * 26.0 * uPixelRatio * (460.0 / max(-mv.z, 1.0)), 1.0, 40.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying float vAlpha;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
        gl_FragColor = vec4(1.0, 0.95, 0.78, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const tail = new THREE.Points(tailGeometry, tailMaterial);
  tail.frustumCulled = false;
  group.add(tail);

  const headUniforms = (head.material as THREE.ShaderMaterial).uniforms;
  const glowUniforms = (glow.material as THREE.ShaderMaterial).uniforms;

  /**
   * A long, tilted ellipse that passes near the core and swings out past the
   * game galaxies — a visitor, not a resident.
   */
  const orbit = (t: number, out: THREE.Vector3) => {
    const a = t * Math.PI * 2;
    out.set(
      Math.cos(a) * 620 - 60,
      Math.sin(a) * 300 + Math.sin(a * 2) * 90,
      Math.sin(a + 1.1) * 260 + 40
    );
    return out;
  };

  const headPosition = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  /** Fixed direction the tail streams along while the comet is being placed. */
  const PEEL_TAIL = new THREE.Vector3(1, 0.35, 0.6);
  let opacity = 0;
  let emphasis = 0;
  let override: THREE.Vector3 | null = null;

  return {
    group,
    head: headPosition,
    setOpacity(value: number) {
      opacity = clamp(value);
    },
    setEmphasis(value: number) {
      emphasis = clamp(value);
    },
    overrideHead(position: THREE.Vector3 | null) {
      override = position;
    },
    update(time: number, camera: THREE.Camera) {
      group.visible = opacity > 0.004;
      if (!group.visible) return;

      const t = (time * 0.012) % 1;
      if (override) headPosition.copy(override);
      else orbit(t, headPosition);

      head.position.copy(headPosition);
      glow.position.copy(headPosition);
      head.quaternion.copy(camera.quaternion);
      glow.quaternion.copy(camera.quaternion);
      const scale = 0.18 + emphasis * 0.12;
      head.scale.setScalar(scale);
      glow.scale.setScalar(scale * (1 + Math.sin(time * 1.7) * 0.06));
      headUniforms.uOpacity!.value = opacity * (0.9 + emphasis * 0.5);
      glowUniforms.uOpacity!.value = opacity * (0.4 + emphasis * 0.4);

      for (let i = 0; i < TAIL; i += 1) {
        const back = (i + 1) / TAIL;
        if (override) {
          // While peeling off the hero the comet has no orbit yet, so the
          // tail simply streams behind the forced position.
          scratch.copy(headPosition).addScaledVector(PEEL_TAIL, back * 90);
        } else {
          orbit(t - back * 0.02, scratch);
        }
        tailPositions[i * 3] = scratch.x;
        tailPositions[i * 3 + 1] = scratch.y;
        tailPositions[i * 3 + 2] = scratch.z;
        tailAlpha[i] = (1 - back) ** 1.7;
      }
      tailGeometry.attributes.position!.needsUpdate = true;
      tailGeometry.attributes.aAlpha!.needsUpdate = true;
      tailMaterial.uniforms.uOpacity!.value = opacity * 0.85;
    },
  };
}
