/** Focused camera/input regression suite. Requires `npm run dev`.
 * The intercepted dev module exposes read-only camera observations to the test;
 * no test API or instrumentation is shipped in the application.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4321/eshkere';
const shots = process.env.SCREENSHOT_DIR ?? './screenshots';
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const sub = (a, b) => a.map((v, i) => v - b[i]);
const length = (a) => Math.hypot(...a);
const unit = (a) => a.map(v => v / length(a));
const close = (a, b, tolerance = 0.01) => assert.ok(length(sub(a, b)) < tolerance, `${a} != ${b}`);
const offset = s => sub(s.position, s.target);
const state = page => page.evaluate(() => window.__orbitState());
const settled = page => page.waitForFunction(() => {
  const s = window.__orbitState?.();
  return s && !s.flight && !s.transition && Math.hypot(...s.position.map((v, i) => v - s.view[i])) < 0.05;
}, null, { timeout: 30000 });
const label = (page, id) => page.locator(`.u-label[data-node-id="${id}"]`);

async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/src/universe/stage.ts*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(source.includes('function resize() {'), 'use the Astro dev server for camera observations');
    await route.fulfill({ response, body: source.replace('function resize() {', `function resize() {
      window.__orbitState = () => ({
        position: wanted.position.toArray(), target: wanted.target.toArray(),
        view: view.position.toArray(), level, selectedId, mode,
        flight: !!flight, transition: timedTransition,
        streak: sky.streaks.material.uniforms.uStreak.value,
        nodes: nodeIndex.map(node => {
          const world = universeRoot.localToWorld(toVector(node.position));
          const screen = world.clone().project(camera);
          return { id: node.id, world: world.toArray(),
            x: (screen.x * .5 + .5) * viewport.width,
            y: (.5 - screen.y * .5) * viewport.height };
        })
      });`) });
  });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('[data-universe-open]:not([data-universe-region])');
  await page.waitForFunction(() => window.__orbitState?.().mode === 'universe', null, { timeout: 30000 });
  await settled(page);
  return { page, context, errors };
}

// Start on bare canvas so a label or HUD cannot take the pointer.
async function drag(page, button, dx, dy, steps = 12) {
  const start = await page.evaluate(() => {
    for (let y = 120; y < innerHeight - 100; y += 50) {
      for (let x = 120; x < innerWidth - 450; x += 50) {
        if (document.elementFromPoint(x, y)?.matches('[data-universe-canvas]')) return { x, y };
      }
    }
    return { x: 35, y: 150 };
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button });
  await page.mouse.move(start.x + dx, start.y + dy, { steps });
  if (await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const immediate = await state(page);
    close(immediate.view, immediate.position, .01);
  }
  await page.mouse.up({ button });
  await settled(page);
}

try {
  for (const reducedMotion of (process.env.ORBIT_MOBILE_ONLY ? [] : ['no-preference', 'reduce'])) {
    const { page, context, errors } = await setup({ reducedMotion });
    const home = await state(page);
    for (const [level, id] of [[1, null], [2, 'ai-safety'], [3, 'ais-grantmaking']]) {
      if (id) {
        // DOM controls remain the accessible path even when orbit hides a label.
        await label(page, id).evaluate(el => el.click());
        await settled(page);
      }
      const before = await state(page);
      assert.equal(before.level, level);
      await drag(page, 'right', 110, 35);
      const after = await state(page);
      close(after.target, before.target);
      assert.ok(Math.abs(length(offset(after)) - length(offset(before))) < .01);
      assert.ok(length(sub(unit(offset(after)), unit(offset(before)))) > .2);
      assert.equal(after.selectedId, before.selectedId, 'RMB must not select');
      if (reducedMotion === 'reduce') {
        close(after.view, after.position);
        assert.equal(after.streak, 0);
      }
      // Portrait relayout moves semantic targets; preserve angle and refit distance.
      await page.setViewportSize({ width: 390, height: 844 });
      await settled(page);
      const resized = await state(page);
      close(unit(offset(resized)), unit(offset(after)));
      if (id) close(resized.target, resized.nodes.find(n => n.id === id).world);
      await page.setViewportSize({ width: 1280, height: 720 });
      await settled(page);
      close((await state(page)).target, after.target);
      if (reducedMotion === 'no-preference') {
        await page.screenshot({ path: `${shots}/universe-orbit-level-${level}.png` });
      }
      console.log(`ok ${reducedMotion}: orbit and responsive focus at level ${level}`);
    }
    await page.keyboard.press('Home');
    await settled(page);
    close((await state(page)).position, home.position);
    // A drag that returns to its start still must not become a click.
    const pick = (await state(page)).nodes.find(n => n.id === 'ai-safety');
    await page.mouse.move(pick.x, pick.y);
    await page.mouse.down();
    await page.mouse.move(pick.x + 35, pick.y + 25, { steps: 8 });
    await page.mouse.move(pick.x, pick.y, { steps: 8 });
    await page.mouse.up();
    await settled(page);
    assert.equal((await state(page)).level, 1, 'round-trip drag is not a click');
    await page.keyboard.press('Home');
    await settled(page);
    if (reducedMotion === 'no-preference') {
      await label(page, 'ai-safety').evaluate(el => el.click());
      assert.equal((await state(page)).flight, true);
      await drag(page, 'right', 70, 20);
      assert.equal((await state(page)).flight, false, 'RMB takes control from a flight');
      await label(page, 'ai-safety').evaluate(el => el.click());
      await page.setViewportSize({ width: 390, height: 844 });
      await settled(page);
      const arrival = await state(page);
      close(arrival.target, arrival.nodes.find(n => n.id === 'ai-safety').world);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.keyboard.press('Home');
      await settled(page);
    }
    await drag(page, 'right', 320, 0); // quarter turn exposes world-axis pan regressions
    const beforePan = await state(page);
    await drag(page, 'left', 60, 0);
    const afterPan = await state(page);
    close(offset(afterPan), offset(beforePan));
    const forward = unit(offset(beforePan));
    const right = unit([forward[2], 0, -forward[0]]);
    const shift = sub(afterPan.target, beforePan.target);
    assert.ok(shift.reduce((n, v, i) => n + v * right[i], 0) < -20, 'LMB pans along screen right');
    assert.equal(afterPan.level, 1, 'drag does not activate a galaxy');
    await page.keyboard.press('Home');
    await settled(page);
    // Real canvas picking, then orbiting in the focused view.
    const node = (await state(page)).nodes.find(n => n.id === 'ai-safety');
    await page.mouse.click(node.x, node.y);
    await settled(page);
    assert.equal((await state(page)).level, 2, 'canvas click activates galaxy');
    await page.keyboard.press('Escape');
    await settled(page);
    assert.equal((await state(page)).level, 1);
    const menu = await page.evaluate(() => {
      const canvas = document.querySelector('[data-universe-canvas]');
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      canvas.dispatchEvent(event);
      const outside = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(outside);
      const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true });
      canvas.dispatchEvent(wheel);
      return { canvas: event.defaultPrevented, outside: outside.defaultPrevented, wheel: wheel.defaultPrevented };
    });
    assert.deepEqual(menu, { canvas: true, outside: false, wheel: false });
    // Cancellation must release the controller for the next real gesture.
    await page.mouse.move(35, 150);
    await page.mouse.down({ button: 'right' });
    await page.locator('canvas[data-universe-canvas]').dispatchEvent('pointercancel', { pointerId: 1 });
    await page.mouse.up({ button: 'right' });
    const cancelled = await state(page);
    await drag(page, 'right', 100, 0);
    assert.ok(length(sub((await state(page)).position, cancelled.position)) > 50);
    await page.click('[data-universe-action="exit"]');
    await page.waitForFunction(() => window.__orbitState().mode === 'hero', null, { timeout: 30000 });
    await page.click('[data-universe-open]:not([data-universe-region])');
    await page.waitForFunction(() => window.__orbitState().mode === 'universe', null, { timeout: 30000 });
    await settled(page);
    close((await state(page)).position, home.position);
    assert.deepEqual(errors, []);
    console.log(`ok ${reducedMotion}: pan, picking, Home, Escape, context menu, cancellation, exit/re-entry`);
    await context.close();
  }

  const { page, context, errors } = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cdp = await context.newCDPSession(page);
  const touch = async params => {
    let timer;
    try {
      await Promise.race([
        cdp.send('Input.dispatchTouchEvent', params),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Touch dispatch timed out: ' + params.type)), 15000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const before = await state(page);
  await touch({ type: 'touchStart', touchPoints: [{ x: 35, y: 300 }] });
  for (let i = 1; i <= 12; i++) {
    await touch({ type: 'touchMove', touchPoints: [{ x: 35 + i * 5, y: 300 }] });
  }
  await touch({ type: 'touchEnd', touchPoints: [] });
  await settled(page);
  const after = await state(page);
  assert.ok(length(sub(after.target, before.target)) > 80, 'touch drag survives browser gesture arbitration');
  close(offset(after), offset(before));
  assert.equal(after.level, 1);
  assert.deepEqual(errors, []);
  console.log('ok mobile: real touch pan, no accidental selection, unchanged angle');
  await context.close();
} finally {
  await browser.close();
}
