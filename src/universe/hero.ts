import * as THREE from 'three';
import { clamp, range, rng } from './util';

/**
 * The bridge between the existing homepage and the universe.
 *
 * The hero artwork is not replaced by a 3D reconstruction of itself. The
 * very same `<img>` the browser already decoded becomes a texture on a plane
 * framed to match the DOM pixel for pixel, so the swap from page to canvas
 * has nothing to give away. From there the plane recedes and a radial mask
 * eats the black rectangle around the artwork, leaving the drawn planet as a
 * real object in the wider scene — the artwork *is* the home world.
 */

export interface HeroPlaneOptions {
  image: HTMLImageElement;
  /** Where the artist drew the globe, as fractions of the source image. */
  planet: { cx: number; cy: number; r: number };
  /** CSS object-position of the DOM image, as fractions. */
  focus: { x: number; y: number };
}

export interface HeroPlane {
  mesh: THREE.Mesh;
  /** Re-frame for a new viewport. Keeps the crop identical to the DOM. */
  layout(viewport: { width: number; height: number }, cameraDistance: number, fov: number): void;
  /** 0 = the full rectangle, 1 = a clean disc around the drawn planet. */
  setMask(t: number): void;
  setOpacity(value: number): void;
  /** World radius the masked disc currently occupies. */
  discRadius(): number;
  /** Scale that would make the masked disc exactly `radius` world units. */
  scaleForRadius(radius: number): number;
  /** Where the drawn planet's centre sits in the plane's local space. */
  planetOffset(): THREE.Vector2;
  dispose(): void;
}

export function createHeroPlane(options: HeroPlaneOptions): HeroPlane {
  const naturalWidth = options.image.naturalWidth || 1;
  const naturalHeight = options.image.naturalHeight || 1;

  // Copy the decoded pixels into a canvas of exactly their own size before
  // handing them to WebGL. An <img> carries Astro's width/height attributes
  // for the *source* image while the browser may well have chosen a smaller
  // srcset variant, and uploading that mismatch makes the GL driver
  // complain. One draw, once, removes the whole class of problem.
  const source = document.createElement('canvas');
  source.width = naturalWidth;
  source.height = naturalHeight;
  source.getContext('2d')?.drawImage(options.image, 0, 0);

  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const imageAspect = naturalWidth / naturalHeight;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uUvOffset: { value: new THREE.Vector2(0, 0) },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uMaskCentre: { value: new THREE.Vector2(options.planet.cx, 1 - options.planet.cy) },
      uMaskRadius: { value: 4 },
      uImageAspect: { value: imageAspect },
      uOpacity: { value: 1 },
      uRim: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uMap;
      uniform vec2 uUvOffset;
      uniform vec2 uUvScale;
      uniform vec2 uMaskCentre;
      uniform float uMaskRadius;
      uniform float uImageAspect;
      uniform float uOpacity;
      uniform float uRim;

      void main() {
        vec2 uv = uUvOffset + vUv * uUvScale;
        vec4 texel = texture2D(uMap, uv);

        // Distance from the drawn planet's centre, in image-height units.
        // The crop maps uniformly onto the plane, so a circle stays a circle.
        float d = length(vec2((uv.x - uMaskCentre.x) * uImageAspect, uv.y - uMaskCentre.y));
        float mask = smoothstep(uMaskRadius, uMaskRadius * 0.86, d);

        // The artwork is a rectangle and the universe is not. Feather its
        // own border so the frame never shows a straight edge against
        // space — including along the bottom, where the artist's globe runs
        // off the canvas and the circular mask alone cannot close it.
        vec2 border = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.055, min(border.x, border.y));
        mask *= edge;

        // A cyan limb that grows as the frame closes in, standing in for the
        // rim light the artwork already has and keeping the edge from
        // reading as a cut-out.
        float rim = smoothstep(uMaskRadius * 0.86, uMaskRadius * 0.99, d)
                  * smoothstep(uMaskRadius * 1.02, uMaskRadius * 0.9, d);
        vec3 colour = texel.rgb + vec3(0.15, 0.72, 1.0) * rim * uRim;

        float a = texel.a * mask * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(colour, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;

  let planeHeight = 1;
  // Radius of the fully-closed mask, in image-height units. A little larger
  // than the globe so its own rim glow survives the crop.
  const closedRadius = options.planet.r * 1.06;
  const openRadius = 4;

  const layout: HeroPlane['layout'] = (viewport, cameraDistance, fov) => {
    const height = 2 * cameraDistance * Math.tan((fov * Math.PI) / 360);
    const width = height * (viewport.width / viewport.height);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(width, height);
    planeHeight = height;

    // The identical arithmetic the hero's own hotspot code runs, so the
    // canvas shows precisely the crop the DOM was showing.
    const scale = Math.max(viewport.width / naturalWidth, viewport.height / naturalHeight);
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const offsetX = (viewport.width - renderedWidth) * options.focus.x;
    const offsetY = (viewport.height - renderedHeight) * options.focus.y;

    const uSize = viewport.width / renderedWidth;
    const vSize = viewport.height / renderedHeight;
    const u0 = -offsetX / renderedWidth;
    const vTop = -offsetY / renderedHeight;

    material.uniforms.uUvOffset!.value.set(u0, 1 - (vTop + vSize));
    material.uniforms.uUvScale!.value.set(uSize, vSize);
  };

  return {
    mesh,
    layout,
    setMask(t: number) {
      const eased = clamp(t) ** 0.55;
      material.uniforms.uMaskRadius!.value = openRadius + (closedRadius - openRadius) * eased;
      material.uniforms.uRim!.value = clamp(t * 1.4 - 0.2);
    },
    setOpacity(value: number) {
      material.uniforms.uOpacity!.value = value;
    },
    discRadius() {
      const vScale = material.uniforms.uUvScale!.value as THREE.Vector2;
      return (closedRadius * planeHeight * mesh.scale.y) / Math.max(vScale.y, 0.0001);
    },
    scaleForRadius(radius: number) {
      const vScale = material.uniforms.uUvScale!.value as THREE.Vector2;
      return (radius * Math.max(vScale.y, 0.0001)) / (closedRadius * planeHeight);
    },
    planetOffset() {
      const vScale = material.uniforms.uUvScale!.value as THREE.Vector2;
      const vOffset = material.uniforms.uUvOffset!.value as THREE.Vector2;
      // Planet centre expressed in the plane's own [-0.5, 0.5] coordinates.
      const u = (options.planet.cx - vOffset.x) / Math.max(vScale.x, 0.0001) - 0.5;
      const v = (1 - options.planet.cy - vOffset.y) / Math.max(vScale.y, 0.0001) - 0.5;
      return new THREE.Vector2(u, v);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

/* -------------------------------------------------------- headline dust */

export interface HeadlineDust {
  object: THREE.Points;
  /** 0 = letters intact, 1 = fully dispersed. */
  setScatter(t: number): void;
  setOpacity(value: number): void;
  dispose(): void;
}

/**
 * Turns the hero headline into luminous dust.
 *
 * The text is re-drawn to an offscreen canvas using the element's own
 * computed font, sampled for ink, and each surviving pixel becomes a
 * particle at the world position of the pixel it came from. The DOM
 * headline cross-fades out over the same 180ms the dust fades in, which
 * covers the small differences canvas text metrics have from CSS text.
 */
export function createHeadlineDust(options: {
  element: HTMLElement;
  camera: THREE.PerspectiveCamera;
  viewport: { width: number; height: number };
  /** World z the letters should sit on — in front of the hero plane. */
  z: number;
  maxParticles: number;
}): HeadlineDust | null {
  const rect = options.element.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return null;

  const style = getComputedStyle(options.element);
  const canvas = document.createElement('canvas');
  const drawScale = Math.min(1, 1100 / rect.width);
  canvas.width = Math.max(2, Math.round(rect.width * drawScale));
  canvas.height = Math.max(2, Math.round(rect.height * drawScale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const fontSize = parseFloat(style.fontSize) * drawScale;
  const lineHeight = parseFloat(style.lineHeight) * drawScale || fontSize * 1.06;
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${parseFloat(style.letterSpacing) * drawScale || 0}px`;
  }
  // The silver theme paints the headline with `background-clip: text`, so
  // its computed colour is transparent. Re-create the gradient here rather
  // than sampling a colour that does not exist, and read every particle's
  // colour back out of the canvas so the dust carries the real treatment.
  const declared = new THREE.Color();
  const transparentInk = /rgba\(.*0\)$/.test(style.color);
  if (transparentInk) {
    declared.set('#eceafb');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.55, '#eceafb');
    gradient.addColorStop(1, '#b0adcc');
    ctx.fillStyle = gradient;
  } else {
    declared.set(style.color);
    ctx.fillStyle = style.color;
  }

  const lines = [...options.element.querySelectorAll('span')].map((span) =>
    style.textTransform === 'uppercase'
      ? (span.textContent ?? '').toUpperCase()
      : (span.textContent ?? '')
  );
  const drawn = lines.length ? lines : [options.element.textContent ?? ''];
  drawn.forEach((line, index) => {
    // Roughly where CSS puts the baseline inside each line box.
    ctx.fillText(line, 0, lineHeight * index + fontSize * 0.82);
  });

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const ink: number[] = [];
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3]! > 140) ink.push(x, y);
    }
  }
  const total = ink.length / 2;
  if (total === 0) return null;

  const stride = Math.max(1, Math.ceil(total / options.maxParticles));
  const count = Math.floor(total / stride);
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const distance = options.camera.position.z - options.z;
  const worldHeight = 2 * distance * Math.tan((options.camera.fov * Math.PI) / 360);
  const worldWidth = worldHeight * options.camera.aspect;
  const r = rng(4242);

  const warm = new THREE.Color('#ff8fd8');
  const cool = new THREE.Color('#8fe6ff');
  const sampled = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const px = ink[i * stride * 2]!;
    const py = ink[i * stride * 2 + 1]!;
    const screenX = rect.left + (px / canvas.width) * rect.width;
    const screenY = rect.top + (py / canvas.height) * rect.height;

    const wx = (screenX / options.viewport.width - 0.5) * worldWidth;
    const wy = (0.5 - screenY / options.viewport.height) * worldHeight;
    positions[i * 3] = wx;
    positions[i * 3 + 1] = wy;
    positions[i * 3 + 2] = options.z;

    // Dust drifts up and outward from where the letter stood, never in a
    // single direction — an explosion would read as a transition effect
    // rather than the words coming apart.
    const angle = Math.atan2(wy, wx) + range(r, -0.9, 0.9);
    const speed = range(r, 0.35, 1.4);
    directions[i * 3] = Math.cos(angle) * speed;
    directions[i * 3 + 1] = Math.sin(angle) * speed * 0.65 + range(r, 0.1, 0.5);
    directions[i * 3 + 2] = range(r, -0.35, 0.9);

    delays[i] = r() * 0.45;
    sizes[i] = range(r, 1.1, 3.2);

    // The pixel's own colour, straight off the canvas.
    const source = (py * canvas.width + px) * 4;
    sampled.setRGB(data[source]! / 255, data[source + 1]! / 255, data[source + 2]! / 255);
    if (sampled.r + sampled.g + sampled.b < 0.05) sampled.copy(declared);

    const tint = r();
    const colour =
      tint < 0.62
        ? sampled.clone()
        : tint < 0.81
          ? sampled.clone().lerp(warm, 0.7)
          : sampled.clone().lerp(cool, 0.7);
    colors[i * 3] = colour.r;
    colors[i * 3 + 1] = colour.g;
    colors[i * 3 + 2] = colour.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aDir', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uScatter: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
      uSpread: { value: worldHeight * 0.9 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aDir;
      attribute float aDelay;
      attribute float aSize;
      attribute vec3 aColor;
      uniform float uScatter;
      uniform float uPixelRatio;
      uniform float uSpread;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = aColor;
        float t = clamp((uScatter - aDelay) / (1.0 - aDelay), 0.0, 1.0);
        float eased = t * t;
        vec3 p = position + aDir * eased * uSpread;
        // Letters hold, then go: full brightness for the first third.
        vAlpha = 1.0 - smoothstep(0.25, 1.0, t);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * uPixelRatio * (1.0 + eased * 2.0) *
                             (300.0 / max(-mv.z, 1.0)), 1.0, 24.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uOpacity;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float a = smoothstep(0.5, 0.05, d) * vAlpha * uOpacity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;

  return {
    object,
    setScatter(t: number) {
      material.uniforms.uScatter!.value = clamp(t);
      material.uniforms.uPixelRatio!.value = Math.min(window.devicePixelRatio || 1, 2);
    },
    setOpacity(value: number) {
      material.uniforms.uOpacity!.value = value;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
