import * as THREE from 'three';
import {
  currentSourceComet,
  galaxies,
  homeWorld,
  links,
  nodeById,
  nodeIndex,
  regions,
  type NodeRecord,
  type Vec3,
} from './data';
import { createComet, createFilament, createMarker, type Filament, type Marker } from './markers';
import { createHeadlineDust, createHeroPlane, type HeadlineDust, type HeroPlane } from './hero';
import { buildRegion, type RegionObject } from './regions';
import { createLabelLayer, type LabelLayer } from './labels';
import { createSky, type Sky } from './sky';
import { clamp, damp, easeInOutCubic, lerp, phase } from './util';

/**
 * The universe stage: one WebGL scene, one camera on rails, and a single
 * `progress` value that carries the whole hero → universe transition.
 *
 * The camera is never free. Every view is an authored position and target,
 * reached along a curve, which is what keeps a map this dense readable — and
 * what stops the "escape" beat from ever framing an empty corner of space.
 */

const FOV = 50;
/** Camera distance in the hero state. Sets the hero plane's world size. */
const HERO_DISTANCE = 420;
/** Camera distance in the universe overview. */
const UNIVERSE_DISTANCE = 1450;
/** Half-extents the overview composition needs to show, in world units. */
const FIT_HALF_WIDTH = 900;
const FIT_HALF_HEIGHT = 620;
/**
 * The composition is wide and a phone is tall. Rather than shrink the whole
 * universe to a postage stamp in the middle of the screen, portrait
 * viewports turn it a quarter turn: the arrangement is preserved exactly,
 * the galaxies are radially symmetric so they do not care, and the labels
 * are DOM so they stay level. It buys about 45% more apparent size.
 */
const PORTRAIT_TURN = Math.PI / 2;
const PORTRAIT_ASPECT = 0.82;

export type Quality = 'high' | 'low';
export type Mode = 'hero' | 'transition' | 'universe';

export interface StageDom {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  /** The hero `<img>` currently on screen — becomes the plane's texture. */
  heroImage: HTMLImageElement;
  /** Where the artist drew the globe, as fractions of the source image. */
  heroPlanet: { cx: number; cy: number; r: number };
  heroFocus: { x: number; y: number };
  heroHeadline: HTMLElement | null;
  /** Screen rect of the hero's Current Source star, if it has one. */
  currentSourceRect: DOMRect | null;
}

export interface StageCallbacks {
  onModeChange(mode: Mode): void;
  onProgress(progress: number): void;
  onFocusChange(path: NodeRecord[]): void;
  onHover(node: NodeRecord | null): void;
  onSelect(node: NodeRecord | null): void;
}

interface View {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export function createStage(dom: StageDom, callbacks: StageCallbacks, reducedMotion: boolean) {
  /* ------------------------------------------------------------ renderer */
  const quality: Quality = detectQuality();
  const renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: quality === 'high',
    alpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
  });
  renderer.setClearColor(0x050508, 1);
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const camera = new THREE.PerspectiveCamera(
    FOV,
    viewport.width / Math.max(viewport.height, 1),
    1,
    8000
  );
  camera.position.set(0, 0, HERO_DISTANCE);
  // The headline dust maps screen pixels to world units through this camera
  // while the scene is being assembled, so its aspect has to be right from
  // the first line rather than from the first resize.
  camera.updateProjectionMatrix();

  /* --------------------------------------------------------------- sky */
  const sky: Sky = createSky(quality);
  scene.add(sky.group);

  /* ---------------------------------------------------------- universe */
  // Everything authored lives under one root so the whole composition can be
  // scaled to fit a narrow viewport without re-authoring a single position.
  const universeRoot = new THREE.Group();
  universeRoot.visible = false;
  scene.add(universeRoot);

  const regionObjects = new Map<string, RegionObject>();
  for (const region of regions) {
    const object = buildRegion(region, quality);
    object.setOpacity(0);
    regionObjects.set(region.id, object);
    universeRoot.add(object.group);
  }

  const markers = new Map<string, Marker>();
  for (const node of nodeIndex) {
    if (node.kind === 'region') continue;
    const marker = createMarker(node);
    markers.set(node.id, marker);
    universeRoot.add(marker.group);
  }

  const filaments: Filament[] = [];
  for (const link of links) {
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    if (!from || !to) continue;
    const filament = createFilament(link, toVector(from.position), toVector(to.position));
    filaments.push(filament);
    universeRoot.add(filament.object);
  }

  const comet = createComet();
  comet.setOpacity(0);
  universeRoot.add(comet.group);

  /* -------------------------------------------------------- hero bridge */
  const heroPlane: HeroPlane = createHeroPlane({
    image: dom.heroImage,
    planet: dom.heroPlanet,
    focus: dom.heroFocus,
  });
  scene.add(heroPlane.mesh);

  let headlineDust: HeadlineDust | null = null;
  if (dom.heroHeadline) {
    headlineDust = createHeadlineDust({
      element: dom.heroHeadline,
      camera,
      viewport,
      z: 120,
      maxParticles: quality === 'high' ? 6000 : 2600,
    });
    if (headlineDust) scene.add(headlineDust.object);
  }

  /* ------------------------------------------------------------- labels */
  const labelNodes = nodeIndex.filter((node) => node.kind !== 'region' || true);
  const cometNode: NodeRecord | null = currentSourceComet
    ? {
        id: 'current-source',
        label: `Currently reading: ${currentSourceComet.title}`,
        shortLabel: 'Current source',
        blurb: 'The source the Eshkere hero star is pointing at right now.',
        position: [0, 0, 0],
        kind: 'comet',
        regionId: 'health',
        href: currentSourceComet.href,
      }
    : null;

  const labels: LabelLayer = createLabelLayer({
    container: dom.labels,
    nodes: cometNode ? [...labelNodes, cometNode] : labelNodes,
    onActivate: (node) => activate(node),
    onHover: (node) => setHover(node),
  });

  /* -------------------------------------------------------------- state */
  let mode: Mode = 'hero';
  let progress = 0;
  /** Where progress is heading when a timed transition is running. */
  let progressTarget = 0;
  let timedTransition = false;
  let level: 1 | 2 | 3 = 1;
  let focusRegionId: string | null = null;
  let focusSystemId: string | null = null;
  let hoveredId: string | null = null;
  let selectedId: string | null = null;
  let compositionScale = 1;
  let pan = new THREE.Vector2(0, 0);
  /**
   * Cross-fade weight for the hand-over from DOM to canvas. The dust and the
   * canvas rise together over the same ~140ms while nothing is moving yet,
   * which is what hides the small differences between CSS text metrics and
   * canvas text metrics.
   */
  let introFade = 0;

  const view: View = {
    position: camera.position.clone(),
    target: new THREE.Vector3(0, 0, 0),
  };
  const wanted: View = {
    position: camera.position.clone(),
    target: new THREE.Vector3(0, 0, 0),
  };

  /** Curved flight, used whenever the camera changes semantic level. */
  let flight: {
    from: View;
    to: View;
    control: THREE.Vector3;
    elapsed: number;
    duration: number;
  } | null = null;

  const cometPeelStart = new THREE.Vector3();
  const cometScratch = new THREE.Vector3();
  let hasPeelOrigin = false;

  /* ------------------------------------------------------------- layout */
  function resize() {
    viewport.width = window.innerWidth;
    viewport.height = window.innerHeight;
    const aspect = viewport.width / Math.max(viewport.height, 1);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);

    const tanHalf = Math.tan((FOV * Math.PI) / 360);
    const turn = aspect < PORTRAIT_ASPECT ? PORTRAIT_TURN : 0;
    universeRoot.rotation.z = turn;

    // Fit the composition's *rotated* bounding box, then shrink the whole
    // thing rather than pushing the camera miles back — a phone sees the
    // same picture, just smaller in world units.
    const spanX =
      Math.abs(FIT_HALF_WIDTH * Math.cos(turn)) + Math.abs(FIT_HALF_HEIGHT * Math.sin(turn));
    const spanY =
      Math.abs(FIT_HALF_WIDTH * Math.sin(turn)) + Math.abs(FIT_HALF_HEIGHT * Math.cos(turn));
    compositionScale = Math.min(
      1,
      (UNIVERSE_DISTANCE * tanHalf * aspect) / spanX,
      (UNIVERSE_DISTANCE * tanHalf) / spanY
    );
    universeRoot.scale.setScalar(compositionScale);
    universeRoot.updateMatrixWorld(true);

    heroPlane.layout(viewport, HERO_DISTANCE, FOV);
    applyProgress(progress, true);
  }

  /* ---------------------------------------------------------- transition */
  const HOME_TARGET = new THREE.Vector3();
  /**
   * Where the hero plane comes to rest, in world space. The plane is not a
   * child of the universe root — it belongs to the old scene — so it has to
   * be told where the root's own scale and rotation have put the home world.
   */
  function homeTarget(): THREE.Vector3 {
    return universeRoot.localToWorld(
      HOME_TARGET.set(homeWorld.position[0], homeWorld.position[1], homeWorld.position[2])
    );
  }

  function universeView(): View {
    return {
      position: new THREE.Vector3(pan.x, 40 * compositionScale + pan.y, UNIVERSE_DISTANCE),
      target: new THREE.Vector3(pan.x, pan.y, 0),
    };
  }

  /**
   * Map transition progress onto everything that moves. One function, called
   * from both the gesture path and the timed path, so a pinch and a button
   * press cannot drift out of sync.
   */
  function applyProgress(p: number, immediate = false) {
    progress = clamp(p);
    const reduced = reducedMotion;

    // --- camera: slow, then fast, then settling.
    const travel = reduced
      ? progress
      : 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(progress, 1.35));
    const end = universeView();
    const escape = new THREE.Vector3(0, 0, HERO_DISTANCE);
    // A control point off the axis turns the retreat into a curve rather
    // than a dolly straight back.
    const control = new THREE.Vector3(
      130 * compositionScale,
      -70 * compositionScale,
      HERO_DISTANCE + (UNIVERSE_DISTANCE - HERO_DISTANCE) * 0.42
    );
    if (!flight) {
      quadratic(escape, control, end.position, travel, view.position);
      view.target.set(0, 0, 0).lerp(end.target, travel);
      wanted.position.copy(view.position);
      wanted.target.copy(view.target);
    }

    // --- Phase A: the page comes apart.
    const dust = phase(progress, 0.06, 0.5);
    headlineDust?.setScatter(dust);
    headlineDust?.setOpacity(introFade * (1 - phase(progress, 0.34, 0.5)));

    // --- Phase B: the rectangle becomes a planet.
    // The mask closes first, while the artwork still fills the frame, so the
    // black rectangle around it dissolves into the real star field instead
    // of its corners popping away from the edge of the screen.
    heroPlane.setMask(reduced ? phase(progress, 0.0, 0.6) : phase(progress, 0.06, 0.46));

    // Until the plane detaches it is scaled to keep exactly covering the
    // viewport as the camera retreats — there is never a gap to notice.
    const cover = (view.position.z / HERO_DISTANCE) * (1 + 0.025 * clamp(progress * 12));
    const homeScale = heroPlane.scaleForRadius(homeWorld.radius * compositionScale);
    const detach = phase(progress, 0.2, 0.88);
    const planeScale = lerp(cover, homeScale, detach);
    heroPlane.mesh.scale.setScalar(planeScale);

    // Slide the plane so the *drawn planet* — not the rectangle's centre —
    // lands where the home world belongs.
    const offset = heroPlane.planetOffset();
    const geometry = heroPlane.mesh.geometry as THREE.PlaneGeometry;
    const planeWidth = geometry.parameters.width;
    const planeHeight = geometry.parameters.height;
    const rest = homeTarget();
    const slide = phase(progress, 0.2, 0.9);
    heroPlane.mesh.position.set(
      lerp(0, rest.x - offset.x * planeWidth * planeScale, slide),
      lerp(0, rest.y - offset.y * planeHeight * planeScale, slide),
      lerp(0, rest.z, slide)
    );
    heroPlane.setOpacity(1);

    // --- streaks: a single bell around peak acceleration.
    const streak = reduced ? 0 : Math.exp(-Math.pow((progress - 0.34) / 0.15, 2));
    sky.streaks.material.uniforms.uStreak!.value = streak * 0.9;

    // --- Phase C/D: the map resolves, nearest structure first.
    universeRoot.visible = progress > 0.02;
    const coreIn = phase(progress, 0.4, 0.72);
    const galaxyIn = phase(progress, 0.58, 0.95);
    for (const region of regions) {
      const object = regionObjects.get(region.id);
      if (!object) continue;
      const base = region.id === 'health' ? coreIn : galaxyIn;
      object.setOpacity(base * regionDim(region.id));
    }

    const markerIn = phase(progress, 0.66, 0.98);
    updateMarkerVisibility(markerIn);

    comet.setOpacity(phase(progress, 0.3, 0.8));
    // The hero's Current Source star peels off the artwork and becomes the
    // comet — the one object that crosses from the old scene into the new.
    if (hasPeelOrigin) {
      const peel = phase(progress, 0.18, 0.66);
      if (peel < 1) {
        comet.overrideHead(cometScratch.copy(cometPeelStart).lerp(cometOrbitEntry(), peel));
      } else {
        comet.overrideHead(null);
      }
    }

    const labelIn = phase(progress, 0.86, 1);
    applyLabelTargets(labelIn);

    callbacks.onProgress(progress);
    if (immediate) render(0);
  }

  /**
   * Where the comet's own orbit picks it up once the peel completes. Local
   * to the universe root, like everything else the comet touches — only the
   * hero plane works in world units.
   */
  const ORBIT_ENTRY = new THREE.Vector3(560, 30, 270);
  function cometOrbitEntry(): THREE.Vector3 {
    return ORBIT_ENTRY;
  }

  /* --------------------------------------------------- focus and dimming */
  function regionDim(regionId: string): number {
    if (mode !== 'universe' || level === 1) return 1;
    if (regionId === focusRegionId) return 1;
    // Context, not absence: other galaxies stay in the frame, just quieter.
    return 0.2;
  }

  function updateMarkerVisibility(base: number) {
    for (const marker of markers.values()) {
      const node = marker.node;
      let value = 0;
      if (node.kind === 'home') value = base;
      else if (node.kind === 'system') {
        value = level >= 2 && node.regionId === focusRegionId ? base : base * 0.14;
        if (node.regionId === 'health') value = Math.max(value, base * 0.5);
      } else if (node.kind === 'planet') {
        value =
          level >= 3 && parentSystemOf(node.id) === focusSystemId
            ? base
            : level >= 2 && node.regionId === focusRegionId
              ? base * 0.35
              : 0;
      }
      if (hoveredId === node.id || selectedId === node.id) value = Math.max(value, base);
      marker.setOpacity(value);
      marker.setEmphasis(hoveredId === node.id || selectedId === node.id ? 1 : 0);
    }
  }

  function applyLabelTargets(base: number) {
    for (const handle of labels.handles) {
      const node = handle.node;
      let value = 0;
      if (node.kind === 'region') value = base;
      else if (node.kind === 'comet') value = hoveredId === 'current-source' ? base : base * 0.75;
      else if (node.kind === 'home') value = base * 0.8;
      else if (node.kind === 'system')
        value = level >= 2 && node.regionId === focusRegionId ? base : 0;
      else if (node.kind === 'planet')
        value = level >= 3 && parentSystemOf(node.id) === focusSystemId ? base : 0;
      labels.setTarget(handle.id, value);
    }
  }

  function parentSystemOf(planetId: string): string | null {
    for (const region of regions) {
      for (const system of region.systems) {
        if ((system.planets ?? []).some((planet) => planet.id === planetId)) return system.id;
      }
    }
    return null;
  }

  function setHover(node: NodeRecord | null) {
    hoveredId = node?.id ?? null;
    callbacks.onHover(node);
    refreshFilaments();
  }

  function refreshFilaments() {
    const active = selectedId ?? hoveredId;
    for (const filament of filaments) {
      const touches =
        active !== null && (filament.link.from === active || filament.link.to === active);
      // Health's own threads stay faintly lit at all times: the substrate is
      // supposed to look connected to everything.
      const ambient = filament.link.from === 'health' && level === 1 ? 0.16 : 0;
      filament.setOpacity(touches ? 1 : ambient);
    }
  }

  /* ------------------------------------------------------------- flights */
  function flyTo(next: View, duration = 1.15) {
    if (reducedMotion) {
      view.position.copy(next.position);
      view.target.copy(next.target);
      wanted.position.copy(next.position);
      wanted.target.copy(next.target);
      flight = null;
      return;
    }
    const from: View = { position: view.position.clone(), target: view.target.clone() };
    const mid = from.position.clone().lerp(next.position, 0.5);
    // Bow the path sideways so arriving at a galaxy feels like flying to it
    // rather than zooming at it.
    const away = next.position.clone().sub(from.position);
    const bow = new THREE.Vector3(-away.y, away.x, 0).normalize().multiplyScalar(
      Math.min(320, away.length() * 0.26)
    );
    flight = {
      from,
      to: { position: next.position.clone(), target: next.target.clone() },
      control: mid.add(bow),
      elapsed: 0,
      duration,
    };
  }

  function galaxyView(regionId: string): View {
    const region = regions.find((entry) => entry.id === regionId);
    const object = regionObjects.get(regionId);
    if (!region || !object) return universeView();
    const centre = universeRoot.localToWorld(object.centre.clone());
    const aspect = camera.aspect;
    const tanHalf = Math.tan((FOV * Math.PI) / 360);
    const distance =
      (region.radius * compositionScale * 1.65) / (tanHalf * Math.min(1, aspect * 0.9));
    return {
      position: centre.clone().add(new THREE.Vector3(0, region.radius * 0.12, distance)),
      target: centre,
    };
  }

  function systemView(systemId: string): View {
    const node = nodeById.get(systemId);
    if (!node) return universeView();
    const centre = universeRoot.localToWorld(toVector(node.position));
    const aspect = camera.aspect;
    const tanHalf = Math.tan((FOV * Math.PI) / 360);
    const distance = (170 * compositionScale) / (tanHalf * Math.min(1, aspect * 0.9));
    return {
      position: centre.clone().add(new THREE.Vector3(0, 0, distance)),
      target: centre,
    };
  }

  function breadcrumb(): NodeRecord[] {
    const path: NodeRecord[] = [];
    if (focusRegionId) {
      const region = nodeById.get(focusRegionId);
      if (region) path.push(region);
    }
    if (focusSystemId) {
      const system = nodeById.get(focusSystemId);
      if (system) path.push(system);
    }
    return path;
  }

  /* ------------------------------------------------------ public actions */
  function focusRegion(regionId: string) {
    focusRegionId = regionId;
    focusSystemId = null;
    level = 2;
    selectedId = regionId;
    flyTo(galaxyView(regionId));
    applyLabelTargets(1);
    updateMarkerVisibility(1);
    refreshFilaments();
    callbacks.onFocusChange(breadcrumb());
    callbacks.onSelect(nodeById.get(regionId) ?? null);
  }

  function focusSystem(systemId: string) {
    const node = nodeById.get(systemId);
    if (!node) return;
    focusRegionId = node.regionId;
    focusSystemId = systemId;
    level = 3;
    selectedId = systemId;
    flyTo(systemView(systemId));
    applyLabelTargets(1);
    updateMarkerVisibility(1);
    refreshFilaments();
    callbacks.onFocusChange(breadcrumb());
    callbacks.onSelect(node);
  }

  function activate(node: NodeRecord) {
    if (node.kind === 'region') focusRegion(node.id);
    else if (node.kind === 'system') focusSystem(node.id);
    else if (node.kind === 'planet' || node.kind === 'comet') {
      selectedId = node.id;
      callbacks.onSelect(node);
      refreshFilaments();
    } else if (node.kind === 'home') {
      selectedId = node.id;
      callbacks.onSelect(node);
    }
  }

  function zoomOutOneLevel(): boolean {
    if (level === 3) {
      const regionId = focusRegionId;
      focusSystemId = null;
      level = 2;
      selectedId = regionId;
      if (regionId) flyTo(galaxyView(regionId));
      applyLabelTargets(1);
      updateMarkerVisibility(1);
      callbacks.onFocusChange(breadcrumb());
      callbacks.onSelect(regionId ? (nodeById.get(regionId) ?? null) : null);
      return true;
    }
    if (level === 2) {
      focusRegionId = null;
      focusSystemId = null;
      selectedId = null;
      level = 1;
      flyTo(universeView());
      applyLabelTargets(1);
      updateMarkerVisibility(1);
      refreshFilaments();
      callbacks.onFocusChange(breadcrumb());
      callbacks.onSelect(null);
      return true;
    }
    return false;
  }

  function zoomInOneLevel(): boolean {
    if (level === 1) {
      const candidate = hoveredId ?? galaxies[0]?.id;
      if (candidate && regionObjects.has(candidate)) {
        focusRegion(candidate);
        return true;
      }
      const galaxy = galaxies[0];
      if (galaxy) {
        focusRegion(galaxy.id);
        return true;
      }
    }
    if (level === 2 && focusRegionId) {
      const region = regions.find((entry) => entry.id === focusRegionId);
      const system = region?.systems[0];
      if (system) {
        focusSystem(system.id);
        return true;
      }
    }
    return false;
  }

  function recentre() {
    pan.set(0, 0);
    focusRegionId = null;
    focusSystemId = null;
    selectedId = null;
    level = 1;
    flyTo(universeView());
    applyLabelTargets(1);
    updateMarkerVisibility(1);
    refreshFilaments();
    callbacks.onFocusChange(breadcrumb());
    callbacks.onSelect(null);
  }

  function panBy(dx: number, dy: number) {
    if (level !== 1) return;
    const limit = 420 * compositionScale;
    pan.x = clamp(pan.x - dx, -limit, limit);
    pan.y = clamp(pan.y + dy, -limit, limit);
    flight = null;
    const next = universeView();
    wanted.position.copy(next.position);
    wanted.target.copy(next.target);
  }

  /* ------------------------------------------------------------ picking */
  const pickVector = new THREE.Vector3();
  function pick(clientX: number, clientY: number): NodeRecord | null {
    let best: { node: NodeRecord; distance: number } | null = null;
    const candidates: { node: NodeRecord; position: THREE.Vector3 }[] = [];

    for (const region of regions) {
      const object = regionObjects.get(region.id);
      const record = nodeById.get(region.id);
      if (!object || !record) continue;
      if (object.group.visible) {
        candidates.push({ node: record, position: object.centre.clone() });
      }
    }
    for (const marker of markers.values()) {
      if (!marker.group.visible) continue;
      candidates.push({ node: marker.node, position: marker.position.clone() });
    }
    if (cometNode && comet.group.visible) {
      candidates.push({
        node: cometNode,
        position: comet.head.clone(),
      });
    }

    for (const candidate of candidates) {
      pickVector.copy(candidate.position).applyMatrix4(universeRoot.matrixWorld).project(camera);
      if (pickVector.z > 1) continue;
      const x = (pickVector.x * 0.5 + 0.5) * viewport.width;
      const y = (0.5 - pickVector.y * 0.5) * viewport.height;
      const distance = Math.hypot(x - clientX, y - clientY);
      const reach = candidate.node.kind === 'region' ? 150 : 44;
      if (distance > reach) continue;
      if (!best || distance < best.distance) best = { node: candidate.node, distance };
    }
    return best?.node ?? null;
  }

  /* -------------------------------------------------------------- render */
  // A hand-rolled clock: THREE.Clock is deprecated, and this is two lines.
  let lastFrame = performance.now();
  let elapsed = 0;
  const nextDelta = () => {
    const now = performance.now();
    const delta = (now - lastFrame) / 1000;
    lastFrame = now;
    elapsed += delta;
    return delta;
  };
  let running = false;
  let frameHandle = 0;
  let slowFrames = 0;

  function render(dt: number) {
    const time = elapsed * (reducedMotion ? 0.15 : 1);
    sky.update(time, pixelRatio);
    for (const object of regionObjects.values()) object.update(time, pixelRatio);
    for (const marker of markers.values()) marker.update(time, camera);
    for (const filament of filaments) filament.update(dt);
    comet.update(time, camera);

    if (cometNode) {
      // The label layer applies the universe root's matrix itself, so the
      // comet's local position is what it wants.
      cometNode.position = [comet.head.x, comet.head.y, comet.head.z] as Vec3;
    }

    camera.position.copy(view.position);
    camera.lookAt(view.target);
    camera.updateMatrixWorld();

    labels.update(camera, universeRoot, viewport, dt);
    renderer.render(scene, camera);
  }

  function tick() {
    frameHandle = requestAnimationFrame(tick);
    const dt = Math.min(nextDelta(), 0.05);

    if (timedTransition) {
      const speed = reducedMotion ? 2.6 : 0.55;
      const next =
        progressTarget > progress
          ? Math.min(progressTarget, progress + dt * speed)
          : Math.max(progressTarget, progress - dt * speed * 1.4);
      applyProgress(next);
      if (Math.abs(progress - progressTarget) < 0.001) {
        timedTransition = false;
        settleMode();
      }
    }

    if (flight) {
      flight.elapsed += dt;
      const t = easeInOutCubic(clamp(flight.elapsed / flight.duration));
      quadratic(flight.from.position, flight.control, flight.to.position, t, view.position);
      view.target.copy(flight.from.target).lerp(flight.to.target, t);
      if (flight.elapsed >= flight.duration) {
        wanted.position.copy(flight.to.position);
        wanted.target.copy(flight.to.target);
        flight = null;
      }
    } else if (mode === 'universe') {
      view.position.set(
        damp(view.position.x, wanted.position.x, 3.4, dt),
        damp(view.position.y, wanted.position.y, 3.4, dt),
        damp(view.position.z, wanted.position.z, 3.4, dt)
      );
      view.target.set(
        damp(view.target.x, wanted.target.x, 3.4, dt),
        damp(view.target.y, wanted.target.y, 3.4, dt),
        damp(view.target.z, wanted.target.z, 3.4, dt)
      );
    }

    // Adaptive quality, in the order a viewer would least miss it.
    if (dt > 0.032) slowFrames += 1;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 45) {
      degrade();
      slowFrames = 0;
    }

    render(dt);
  }

  /**
   * A ladder, walked one rung per sustained slow patch: resolution first,
   * then the nebulae, then the streak field. Composition, labels and
   * navigation are never traded away — a map that is legible at 30fps beats
   * a prettier one nobody can read.
   */
  let degradeStep = 0;
  function degrade() {
    degradeStep += 1;
    if (degradeStep === 1 && pixelRatio > 0.75) {
      pixelRatio = Math.max(0.75, pixelRatio * 0.72);
      renderer.setPixelRatio(pixelRatio);
      return;
    }
    if (degradeStep <= 2) {
      sky.setNebulae(false);
      return;
    }
    if (degradeStep <= 3) {
      sky.streaks.object.visible = false;
    }
  }

  function settleMode() {
    if (progress >= 0.999) setMode('universe');
    else if (progress <= 0.001) setMode('hero');
  }

  function setMode(next: Mode) {
    if (mode === next) return;
    mode = next;
    if (next === 'universe') {
      const target = universeView();
      wanted.position.copy(target.position);
      wanted.target.copy(target.target);
      applyLabelTargets(1);
    }
    if (next === 'hero') {
      labels.setAll(0);
      stop();
    }
    callbacks.onModeChange(mode);
  }

  function start() {
    if (running) return;
    running = true;
    lastFrame = performance.now();
    frameHandle = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameHandle);
  }

  /* ------------------------------------------------------- external API */
  resize();

  // Compile every shader now, while the visitor is only *considering* the
  // universe. Left to the renderer, the galaxy programs would be compiled
  // the first frame they are drawn — which is the middle of the transition,
  // exactly where a stall is least forgivable.
  universeRoot.visible = true;
  renderer.compile(scene, camera);
  universeRoot.visible = false;

  if (dom.currentSourceRect) {
    const rect = dom.currentSourceRect;
    // Exactly where the hero's Current Source star is drawn, converted from
    // screen pixels into the universe's own local units.
    screenToWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      0,
      camera,
      viewport,
      cometPeelStart
    );
    universeRoot.worldToLocal(cometPeelStart);
    hasPeelOrigin = true;
    comet.overrideHead(cometPeelStart);
  }
  applyProgress(0, true);

  return {
    get mode() {
      return mode;
    },
    get level() {
      return level;
    },
    get progress() {
      return progress;
    },
    get quality() {
      return quality;
    },
    canvas: dom.canvas,
    start,
    stop,
    resize,
    /** Weight of the DOM → canvas hand-over, 0 to 1. */
    setIntro(value: number) {
      introFade = clamp(value);
      applyProgress(progress, true);
    },
    /** Drive the transition directly — used by continuous gestures. */
    setProgress(value: number) {
      timedTransition = false;
      if (mode === 'hero' && value > 0) setMode('transition');
      applyProgress(value);
      if (value >= 1) settleMode();
    },
    /** Run to the end (or the start) on a timer. */
    runTo(target: number) {
      progressTarget = clamp(target);
      timedTransition = true;
      if (mode === 'hero' && target > 0) setMode('transition');
      start();
    },
    focusRegion,
    focusSystem,
    activate,
    zoomInOneLevel,
    zoomOutOneLevel,
    recentre,
    panBy,
    pick,
    setHover,
    select(node: NodeRecord | null) {
      selectedId = node?.id ?? null;
      callbacks.onSelect(node);
      refreshFilaments();
    },
    hoverById(id: string | null) {
      setHover(id ? (nodeById.get(id) ?? null) : null);
    },
    breadcrumb,
    setPaused(paused: boolean) {
      if (paused) stop();
      else if (mode !== 'hero') start();
    },
    destroy() {
      stop();
      labels.destroy();
      heroPlane.dispose();
      headlineDust?.dispose();
      renderer.dispose();
    },
  };
}

export type Stage = ReturnType<typeof createStage>;

/* ------------------------------------------------------------- helpers */

function toVector(position: Vec3): THREE.Vector3 {
  return new THREE.Vector3(position[0], position[1], position[2]);
}

function quadratic(
  a: THREE.Vector3,
  control: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const inv = 1 - t;
  out.set(
    inv * inv * a.x + 2 * inv * t * control.x + t * t * b.x,
    inv * inv * a.y + 2 * inv * t * control.y + t * t * b.y,
    inv * inv * a.z + 2 * inv * t * control.z + t * t * b.z
  );
  return out;
}

/** Screen pixel → world position on the plane at `worldZ`. */
function screenToWorld(
  x: number,
  y: number,
  worldZ: number,
  camera: THREE.PerspectiveCamera,
  viewport: { width: number; height: number },
  out: THREE.Vector3
): THREE.Vector3 {
  const distance = camera.position.z - worldZ;
  const height = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
  const width = height * camera.aspect;
  out.set((x / viewport.width - 0.5) * width, (0.5 - y / viewport.height) * height, worldZ);
  return out;
}

/**
 * Quality tiering. Deliberately conservative: the cost of running the low
 * tier on a capable machine is a slightly thinner star field, while the cost
 * of the reverse is a phone that drops frames during the one moment the
 * whole feature exists for.
 */
function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 620;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (cores <= 4 || memory <= 4) return 'low';
  if (small && coarse) return 'low';
  return 'high';
}

/** True when this browser can actually give us a WebGL context. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}
