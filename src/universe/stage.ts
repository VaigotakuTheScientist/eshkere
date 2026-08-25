import * as THREE from 'three';
import {
  CONTENT_TYPE_BY_KIND,
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
import { createPlanet, type Planet } from './planet';
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
/**
 * Half-extents the overview composition needs to show, in world units.
 *
 * Wider than it is tall, and deliberately so: a 16:9 frame has roughly
 * twice as much room across as down, and the composition used to leave the
 * outer third of both sides empty while nearly touching the top and bottom.
 */
const FIT_HALF_WIDTH = 1100;
const FIT_HALF_HEIGHT = 600;
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
  /** Where the artwork's smiley sits on that globe's face. */
  heroMark: { x: number; y: number; r: number };
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
  // Three checks every shader's compile log by default, and each check is a
  // synchronous round trip to the driver. Profiling put those calls at 46%
  // of all JS during the transition — a ~600ms stall at the exact moment
  // the camera starts moving. The shaders here are fixed and known good.
  renderer.debug.checkShaderErrors = false;
  renderer.setClearColor(0x050508, 1);
  /**
   * Rendering resolution, adapted at runtime.
   *
   * Everything crisp on screen — labels, HUD, breadcrumbs — is DOM and
   * renders at native resolution whatever this is set to. The canvas holds
   * starfields, glows and a planet, none of which have a hard edge to lose,
   * so this is the cheapest lever in the whole scene: fill cost falls with
   * the square of it and almost nothing looks different.
   */
  const RATIO_STEPS = [0.75, 1, 1.25, 1.5, 1.75];
  const maxRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1);
  const ratioCeiling = RATIO_STEPS.filter((step) => step <= maxRatio).length - 1;
  let ratioIndex = Math.max(0, Math.min(ratioCeiling, RATIO_STEPS.indexOf(1.5)));
  if (ratioIndex < 0) ratioIndex = ratioCeiling;
  let pixelRatio = RATIO_STEPS[ratioIndex] ?? maxRatio;
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
  const sky: Sky = createSky(renderer, quality);
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
  heroPlane.mesh.renderOrder = 1;
  scene.add(heroPlane.mesh);

  // The artwork's replacement. It renders the artwork itself until the
  // camera is moving fast enough for the surface to resolve unnoticed.
  const planet: Planet = createPlanet({
    texture: heroPlane.texture,
    planet: dom.heroPlanet,
    imageAspect: heroPlane.imageAspect,
    closedRadius: heroPlane.closedRadius,
    mark: dom.heroMark,
    quality,
  });
  scene.add(planet.group);

  let headlineDust: HeadlineDust | null = null;

  /**
   * The headline particles are sampled from where the headline actually is,
   * so a viewport change invalidates them. The stage is built on intent —
   * a hover — which can be a long time before the transition runs, so this
   * has to be redone rather than measured once and trusted.
   */
  function buildHeadlineDust() {
    if (!dom.heroHeadline) return;
    if (headlineDust) {
      scene.remove(headlineDust.object);
      headlineDust.dispose();
      headlineDust = null;
    }
    headlineDust = createHeadlineDust({
      element: dom.heroHeadline,
      camera,
      viewport,
      z: 120,
      maxParticles: quality === 'high' ? 6000 : 2600,
    });
    if (headlineDust) scene.add(headlineDust.object);
  }
  buildHeadlineDust();

  /* ------------------------------------------------------------- labels */
  const labelNodes = nodeIndex.filter((node) => node.kind !== 'region' || true);
  const cometNode: NodeRecord | null = currentSourceComet
    ? {
        id: 'current-source',
        label: `Currently reading: ${currentSourceComet.title}`,
        shortLabel: 'Current source',
        // The one label worth expanding: what it is pointing at is the point
        // of it, and the title is far too long to sit on the map at rest.
        expands: true,
        blurb: 'The source the Eshkere hero star is pointing at right now.',
        position: [0, 0, 0],
        // Rewritten every frame to the galaxy the comet is passing, so the
        // name is always on the outward side of it. See `render`.
        origin: [0, 0, 0],
        // Enough to clear the head's own glow.
        labelPad: 18,
        kind: 'comet',
        contentType: CONTENT_TYPE_BY_KIND.comet,
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

  const PLANET_AT = new THREE.Vector3();
  const ESCAPE_FROM = new THREE.Vector3();
  const ESCAPE_CONTROL = new THREE.Vector3();
  const SMILEY_AT = new THREE.Vector3();
  const cometPeelStart = new THREE.Vector3();
  const cometBearing = new THREE.Vector3();
  /**
   * Softening for the comet's bearing, in world units squared — roughly a
   * galaxy radius. Nearer than this and one galaxy takes the weighting over;
   * further out and the bearing settles back towards the middle of the map.
   */
  const BEARING_SOFTEN = 320 * 320;
  const cometScratch = new THREE.Vector3();
  let hasPeelOrigin = false;

  /* ------------------------------------------------------------- layout */
  let laidOutFor = { width: 0, height: 0 };

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Opening the map calls this right after the stage was built for the
    // same viewport. Re-laying everything out then — new plane geometry, a
    // re-measure of every label, a fresh sampling of the headline — is a
    // long frame at precisely the wrong moment.
    if (width === laidOutFor.width && height === laidOutFor.height) return;
    laidOutFor = { width, height };

    viewport.width = width;
    viewport.height = height;
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
    // Intrinsic label sizes change with the viewport: the phone breakpoint
    // gives them a smaller font.
    labels.remeasure();
    // Only worth rebuilding while the headline still has a part to play.
    if (progress < 0.6) buildHeadlineDust();
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

  const OVERVIEW: View = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  function universeView(): View {
    OVERVIEW.position.set(pan.x, 40 * compositionScale + pan.y, UNIVERSE_DISTANCE);
    OVERVIEW.target.set(pan.x, pan.y, 0);
    return OVERVIEW;
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
    ESCAPE_FROM.set(0, 0, HERO_DISTANCE);
    const escape = ESCAPE_FROM;
    // A control point off the axis turns the retreat into a curve rather
    // than a dolly straight back.
    ESCAPE_CONTROL.set(
      130 * compositionScale,
      -70 * compositionScale,
      HERO_DISTANCE + (UNIVERSE_DISTANCE - HERO_DISTANCE) * 0.42
    );
    const control = ESCAPE_CONTROL;
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

    // --- Phase B: the rectangle becomes a planet, and then a real one.
    // The mask closes first, while the artwork still fills the frame, so the
    // black rectangle around it dissolves into the real star field instead
    // of its corners popping away from the edge of the screen.
    heroPlane.setMask(reduced ? phase(progress, 0.0, 0.42) : phase(progress, 0.04, 0.34));

    // Until the plane detaches it is scaled to keep exactly covering the
    // viewport as the camera retreats — there is never a gap to notice.
    const cover = (view.position.z / HERO_DISTANCE) * (1 + 0.025 * clamp(progress * 12));
    const homeScale = heroPlane.scaleForRadius(homeWorld.radius * compositionScale);
    const detach = phase(progress, 0.18, 0.86);
    const planeScale = lerp(cover, homeScale, detach);
    heroPlane.mesh.scale.setScalar(planeScale);

    // Slide the plane so the *drawn planet* — not the rectangle's centre —
    // lands where the home world belongs.
    const offset = heroPlane.planetOffset();
    const geometry = heroPlane.mesh.geometry as THREE.PlaneGeometry;
    const planeWidth = geometry.parameters.width;
    const planeHeight = geometry.parameters.height;
    const rest = homeTarget();
    const slide = phase(progress, 0.18, 0.88);
    heroPlane.mesh.position.set(
      lerp(0, rest.x - offset.x * planeWidth * planeScale, slide),
      lerp(0, rest.y - offset.y * planeHeight * planeScale, slide),
      lerp(0, rest.z, slide)
    );

    // The sphere takes the plane's own arithmetic, so the two occupy exactly
    // the same disc on screen for as long as both are visible.
    PLANET_AT.set(
      heroPlane.mesh.position.x + offset.x * planeWidth * planeScale,
      heroPlane.mesh.position.y + offset.y * planeHeight * planeScale,
      heroPlane.mesh.position.z
    );
    // Track the mask as it closes rather than its final size, so the sphere
    // and the plane are the same disc at every frame of the hand-over.
    planet.setProjection(heroPlane.liveMaskRadius());
    planet.place(PLANET_AT, heroPlane.liveDiscRadius());

    // Hand over early and under cover: the sphere rises first, still painted
    // with the artwork, the plane leaves underneath it, and only then does
    // the surface resolve into a world — by which point the camera is at
    // full speed and the streaks are at their peak.
    const takeover = reduced ? phase(progress, 0.08, 0.28) : phase(progress, 0.1, 0.2);
    planet.setOpacity(takeover);
    planet.setMorph(reduced ? phase(progress, 0.18, 0.55) : phase(progress, 0.22, 0.48));
    heroPlane.setOpacity(1 - phase(progress, 0.14, 0.24));

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
      else if (node.kind === 'mark') {
        // A faint pinpoint over the smiley the planet's shader draws, so the
        // mark is findable at long range where the face is sub-pixel.
        value = base * 0.45;
      } else if (node.kind === 'system') {
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
      else if (node.kind === 'mark')
        // Exactly as on the hero: the mark is drawn on the world, not
        // captioned. Naming it at the overview would put a caption across
        // the home planet for no gain.
        value = hoveredId === node.id || selectedId === node.id ? base : 0;
      else if (node.kind === 'system')
        value = level >= 2 && node.regionId === focusRegionId ? base : 0;
      else if (node.kind === 'planet')
        value = level >= 3 && parentSystemOf(node.id) === focusSystemId ? base : 0;
      labels.setTarget(handle.id, value);
    }
  }

  /**
   * Which system a planet belongs to. Resolved once into a map — it used to
   * be a scan of every region, system and planet, run for every planet
   * marker, on every frame of the transition.
   */
  const parentSystem = new Map<string, string>();
  for (const region of regions) {
    for (const system of region.systems) {
      for (const planet of system.planets ?? []) parentSystem.set(planet.id, system.id);
    }
  }
  function parentSystemOf(planetId: string): string | undefined {
    return parentSystem.get(planetId);
  }

  function setHover(node: NodeRecord | null) {
    hoveredId = node?.id ?? null;
    callbacks.onHover(node);
    refreshFilaments();
    // Emphasis and hover-only labels both read `hoveredId`, so they have to
    // be recomputed here — nothing else does it once the map has settled.
    if (mode === 'universe') {
      updateMarkerVisibility(1);
      applyLabelTargets(1);
    }
  }

  function refreshFilaments() {
    const active = selectedId ?? hoveredId;
    for (const filament of filaments) {
      const touches =
        active !== null && (filament.link.from === active || filament.link.to === active);
      // Health's own threads stay lit at all times. In the overview they are
      // the composition's connective tissue — four slow pulses running from
      // the core out to the galaxies, which is what makes five bodies read
      // as one system rather than five things placed in a frame.
      const ambient = filament.link.from === 'health' && level === 1 ? 0.6 : 0;
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

  /**
   * Play the reveal, or play it backwards. The only way the transition is
   * ever driven: it runs on its own clock from wherever it is to the end it
   * was asked for, so it always reads as one cinematic move.
   */
  function runTo(target: number) {
    progressTarget = clamp(target);
    timedTransition = true;
    // Only entering flips the mode up front. Leaving stays 'universe' until
    // the reveal has finished playing backwards, so the camera does not snap
    // out of a galaxy the instant the exit is pressed.
    if (mode === 'hero' && target > 0) setMode('transition');
    start();
  }

  function activate(node: NodeRecord) {
    if (node.kind === 'region') focusRegion(node.id);
    else if (node.kind === 'system') focusSystem(node.id);
    else if (node.kind === 'planet' || node.kind === 'comet') {
      selectedId = node.id;
      callbacks.onSelect(node);
      refreshFilaments();
    } else if (node.kind === 'home') {
      // The home world is the way back. It is the page you came from, so
      // activating it does what "Back to the page" does — the same call, so
      // there is only ever one way out of the map.
      runTo(0);
    } else if (node.kind === 'mark' && node.href) {
      // Except the smiley on its face, which is its own destination.
      window.open(node.href, '_blank', 'noopener,noreferrer');
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

  /**
   * Screen-space picking, allocation-free.
   *
   * This runs on pointer movement, which during a trackpad drag means many
   * times a second — so it walks the live objects directly instead of
   * building a candidate list and cloning a vector for each of them.
   */
  function pick(clientX: number, clientY: number): NodeRecord | null {
    let best: NodeRecord | null = null;
    let bestDistance = Infinity;

    const consider = (node: NodeRecord, position: THREE.Vector3, reach: number) => {
      pickVector.copy(position).applyMatrix4(universeRoot.matrixWorld).project(camera);
      if (pickVector.z > 1) return;
      const x = (pickVector.x * 0.5 + 0.5) * viewport.width;
      const y = (0.5 - pickVector.y * 0.5) * viewport.height;
      const distance = Math.hypot(x - clientX, y - clientY);
      if (distance > reach || distance >= bestDistance) return;
      best = node;
      bestDistance = distance;
    };

    for (const region of regions) {
      const object = regionObjects.get(region.id);
      const record = nodeById.get(region.id);
      if (!object?.group.visible || !record) continue;
      consider(record, object.centre, 150);
    }
    for (const marker of markers.values()) {
      if (!marker.group.visible) continue;
      // The smiley is a small thing drawn on a much larger one, and the two
      // now do different things. It gets a hit area the size of the drawing
      // rather than the size every other marker uses, so a click lands on
      // whichever of them was actually aimed at.
      consider(marker.node, marker.position, marker.node.kind === 'mark' ? 20 : 44);
    }
    if (cometNode && comet.group.visible) consider(cometNode, comet.head, 44);

    return best;
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

  function render(dt: number) {
    const time = elapsed * (reducedMotion ? 0.15 : 1);
    sky.update(time, pixelRatio);
    for (const object of regionObjects.values()) object.update(time, pixelRatio);
    for (const marker of markers.values()) marker.update(time, camera);
    for (const filament of filaments) filament.update(dt);
    comet.update(time, camera);
    planet.update(time, camera);

    // The planet's face is billboarded, so where it draws the smiley moves
    // with the camera. Keep the node, its marker and its label on it.
    const markNode = nodeById.get('home-mark');
    if (markNode && planet.group.visible) {
      planet.smileyWorld(SMILEY_AT);
      universeRoot.worldToLocal(SMILEY_AT);
      // Written in place: a fresh array here is one allocation per frame,
      // for the whole life of the map.
      const at = markNode.position;
      at[0] = SMILEY_AT.x;
      at[1] = SMILEY_AT.y;
      at[2] = SMILEY_AT.z;
      const marker = markers.get('home-mark');
      if (marker) marker.group.position.copy(SMILEY_AT);
    }
    planet.setSmileyGlow(hoveredId === 'home-mark' || selectedId === 'home-mark' ? 1 : 0);

    if (cometNode && comet.group.visible) {
      // The label layer applies the universe root's matrix itself, so the
      // comet's local position is what it wants.
      const at = cometNode.position;
      at[0] = comet.head.x;
      at[1] = comet.head.y;
      at[2] = comet.head.z;

      // The comet belongs to nothing, so it takes its bearing from whatever
      // it is passing — a distance-weighted centre of gravity of the
      // galaxies. Whichever one it is nearest dominates, so its name is
      // written on the far side of that galaxy rather than laid across the
      // particles; and because the weighting shifts continuously, the label
      // never swings around the head the way picking a nearest neighbour
      // makes it (5px worst per-frame step, against 18px).
      const origin = cometNode.origin;
      if (origin) {
        cometBearing.set(0, 0, 0);
        let total = 0;
        for (const region of regions) {
          const dx = region.position[0] - comet.head.x;
          const dy = region.position[1] - comet.head.y;
          const dz = region.position[2] - comet.head.z;
          const weight = 1 / (dx * dx + dy * dy + dz * dz + BEARING_SOFTEN);
          total += weight;
          cometBearing.x += region.position[0] * weight;
          cometBearing.y += region.position[1] * weight;
          cometBearing.z += region.position[2] * weight;
        }
        cometBearing.divideScalar(total || 1);
        origin[0] = cometBearing.x;
        origin[1] = cometBearing.y;
        origin[2] = cometBearing.z;
      }
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

    adapt(dt);

    render(dt);
  }

  /**
   * Adaptive quality, walked one rung at a time and — unlike before —
   * walked back up when the machine can afford it. A device that struggles
   * for one second while a galaxy flies past should not spend the rest of
   * the session at three quarters resolution.
   *
   * Resolution moves first because it is the cheapest thing to lose. Only
   * if that is not enough do the nebulae and then the streaks go; the
   * composition, the labels and the navigation are never traded away.
   */
  const SLOW_FRAME = 0.032;
  const FAST_FRAME = 0.019;
  let slowFrames = 0;
  let fastFrames = 0;
  let effectsDropped = 0;
  let lastAdaptAt = 0;

  function setRatio(index: number) {
    const next = Math.max(0, Math.min(ratioCeiling, index));
    if (next === ratioIndex) return false;
    ratioIndex = next;
    pixelRatio = RATIO_STEPS[ratioIndex]!;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
    return true;
  }

  function adapt(dt: number) {
    if (dt > SLOW_FRAME) {
      slowFrames += 1;
      fastFrames = 0;
    } else if (dt < FAST_FRAME) {
      fastFrames += 1;
      slowFrames = Math.max(0, slowFrames - 1);
    }

    const now = performance.now();
    // A settling period after any change, so a step never chases its own
    // cost and the two directions cannot oscillate against each other.
    if (now - lastAdaptAt < 2500) return;

    if (slowFrames > 45) {
      slowFrames = 0;
      lastAdaptAt = now;
      if (setRatio(ratioIndex - 1)) return;
      if (effectsDropped === 0) {
        effectsDropped = 1;
        sky.setNebulae(false);
        return;
      }
      if (effectsDropped === 1) {
        effectsDropped = 2;
        sky.streaks.object.visible = false;
      }
      return;
    }

    if (fastFrames > 180) {
      fastFrames = 0;
      lastAdaptAt = now;
      if (effectsDropped === 2) {
        effectsDropped = 1;
        sky.streaks.object.visible = true;
        return;
      }
      if (effectsDropped === 1) {
        effectsDropped = 0;
        sky.setNebulae(true);
        return;
      }
      setRatio(ratioIndex + 1);
    }
  }

  function settleMode() {
    if (progress >= 0.999) setMode('universe');
    else if (progress <= 0.001) setMode('hero');
  }

  function setMode(next: Mode) {
    if (mode === next) return;
    const previous = mode;
    mode = next;
    // Leaving the map, in either direction, forgets where you were in it.
    if (previous === 'universe' && next !== 'universe') {
      focusRegionId = null;
      focusSystemId = null;
      selectedId = null;
      level = 1;
      pan.set(0, 0);
      flight = null;
      refreshFilaments();
      callbacks.onFocusChange(breadcrumb());
      callbacks.onSelect(null);
    }
    if (next === 'universe') {
      const target = universeView();
      wanted.position.copy(target.position);
      wanted.target.copy(target.target);
      applyLabelTargets(1);
      // Arriving is a change of level too. Without this the core's ambient
      // threads stayed dark until the first hover — which is to say they
      // were never seen, since nothing else asks for them.
      refreshFilaments();
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

  /**
   * Get every shader compiled, linked *and* bound now, while the visitor is
   * only considering the universe.
   *
   * `renderer.compile` covers compilation, but a program's uniforms are not
   * queried until the first frame that actually draws it — and querying
   * them is what blocks until the driver has finished linking. At this
   * point almost nothing is drawn: the galaxies, the planet and the comet
   * are all at zero opacity waiting for the transition, so their programs
   * were being linked in the middle of it. Profiling put a quarter of all
   * JS during the open inside `getProgramParameter`, which is that wait.
   *
   * So: make everything visible, draw one frame into a 4x4 target — every
   * program bound, no meaningful fill — and put the scene back.
   */
  {
    const wasVisible = new Map<THREE.Object3D, boolean>();
    scene.traverse((object) => {
      wasVisible.set(object, object.visible);
      object.visible = true;
    });
    scene.updateMatrixWorld(true);
    renderer.compile(scene, camera);

    // Into the canvas itself, at full size. A tiny off-screen target left
    // some programs unbound, and the point is to pay for every one of them
    // here rather than during the flight. The overlay is still hidden, so
    // this frame is never seen.
    renderer.render(scene, camera);

    for (const [object, visible] of wasVisible) object.visible = visible;
    wasVisible.clear();
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
    runTo,
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
      if (mode === 'universe') {
        updateMarkerVisibility(1);
        applyLabelTargets(1);
      }
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
      sky.dispose();
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
    if (!window.WebGLRenderingContext) return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    // Hand the context straight back. Browsers cap how many a page may hold,
    // and a probe has no business keeping one of them.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
