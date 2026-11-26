/** Run against a dev or preview server. Set SCREENSHOT_DIR to capture review images. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = (process.env.BASE_URL ?? 'http://localhost:4321/eshkere').replace(/\/$/, '');
const careUrl = `${base}/care/`;
const key = 'eshkere.care.v0';
const screenshots = process.env.SCREENSHOT_DIR;
if (screenshots) await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const capture = async (page, name, fullPage = false) => {
  if (screenshots) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(screenshots, `${name}.jpg`), quality: 87, fullPage });
  }
};

async function carePage(options = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  return { context, page };
}

try {
  const { context, page } = await carePage({ viewport: { width: 1440, height: 1130 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  assert.equal((await page.goto(careUrl)).status(), 200);
  await page.locator('[data-enhanced]').waitFor();
  const nav = page.getByRole('navigation', { name: 'Care modules' });
  const hair = page.getByRole('region', { name: 'Hair routine map' });
  const nails = page.getByRole('region', { name: 'Nails routine map' });
  const face = page.getByRole('region', { name: 'Face routine map' });
  const hairCheck = hair.getByRole('checkbox', { name: /Complete Check texture/ });
  const hairComb = hair.getByRole('combobox', { name: 'Status for Wide-tooth comb' });
  assert.equal(await nav.getByRole('link', { name: 'Hair' }).getAttribute('aria-current'), 'true');
  assert.equal(await hair.count(), 1);
  assert.equal(await nails.count(), 0);
  assert.equal(await hair.getByRole('heading', { level: 3 }).count(), 6);

  await hairCheck.focus();
  await page.keyboard.press('Space');
  assert.equal(await hairCheck.isChecked(), true);
  await page.keyboard.press('Tab');
  const why = hair.getByText('Why this step?', { exact: false }).first();
  assert.equal(await why.evaluate((node) => node === document.activeElement), true);
  await page.keyboard.press('Enter');
  assert.equal(await hair.getByText(/A quick check helps/).isVisible(), true);
  await hairComb.selectOption('owned');
  await capture(page, 'hair-desktop');

  await nav.getByRole('link', { name: 'Nails' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(`${careUrl}#nails`);
  await nails.getByRole('heading', { name: 'Inventory' }).waitFor();
  assert.equal(await nav.getByRole('link', { name: 'Nails' }).getAttribute('aria-current'), 'true');
  const polish = nails.getByRole('combobox', { name: 'Status for Regular polish and coats' });
  await polish.selectOption('planned');
  const template = nails.getByText('Edit template', { exact: true });
  await template.click();
  await nails.getByLabel('Qualitative observations').fill('Example draft text');
  await nails.getByLabel('Evaluation date').fill('2026-12-03');
  assert.deepEqual(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key), {
    completed: { 'hair/inspect': true },
    inventory: { 'hair/comb': 'owned', 'nails/polish': 'planned' },
  });

  await nav.getByRole('link', { name: 'Face' }).click();
  await face.getByText(/no additional scheduled steps/).waitFor();
  await page.goBack();
  assert.equal(await nails.getByLabel('Qualitative observations').inputValue(), 'Example draft text');
  await page.reload();
  await template.click();
  assert.equal(await nails.getByLabel('Qualitative observations').inputValue(), '');
  assert.equal(await nails.getByLabel('Evaluation date').inputValue(), '');
  assert.equal(await polish.inputValue(), 'planned');
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, 'nails-template', true);

  await nav.getByRole('link', { name: 'Hair' }).click();
  assert.equal(await hairCheck.isChecked(), true);
  assert.equal(await hairComb.inputValue(), 'owned');
  const evening = hair.getByRole('checkbox', { name: /Complete Loosen a tight style/ });
  await evening.check();
  await hair.getByRole('button', { name: 'Clear morning checks' }).click();
  assert.equal(await hairCheck.isChecked(), false);
  assert.equal(await evening.isChecked(), true);
  assert.equal(await hairComb.inputValue(), 'owned');
  assert.equal(await hairCheck.evaluate((node) => node === document.activeElement), true);
  page.once('dialog', (dialog) => dialog.dismiss());
  const reset = page.getByRole('button', { name: 'Reset saved Care data' });
  await reset.click();
  assert.equal(await evening.isChecked(), true);
  page.once('dialog', (dialog) => dialog.accept());
  await reset.click();
  await page.getByRole('status').filter({ hasText: 'Care data reset.' }).waitFor();
  await page.reload();
  await hairCheck.waitFor();
  assert.equal(await evening.isChecked(), false);
  assert.equal(await hairComb.inputValue(), '');
  await nav.getByRole('link', { name: 'Nails' }).click();
  assert.equal(await polish.inputValue(), '');
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Care keyboard navigation, details, experiment privacy, persistence and reset passed.');

  const mobile = await carePage({ viewport: { width: 360, height: 900 }, isMobile: true, hasTouch: true });
  await mobile.page.goto(`${careUrl}#face`);
  await mobile.page.locator('[data-enhanced]').waitFor();
  const sunscreen = mobile.page.getByText('Why this step? Apply sunscreen', { exact: true });
  await sunscreen.tap();
  await mobile.page.getByRole('link', { name: 'AAD · Applying sunscreen' }).waitFor();
  for (const module of ['Face', 'Hair', 'Nails']) {
    await mobile.page.getByRole('navigation', { name: 'Care modules' }).getByRole('link', { name: module }).tap();
    await mobile.page.getByRole('heading', { name: `${module} routine map` }).waitFor();
    assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  if (screenshots) {
    await mobile.page.getByRole('link', { name: 'Face', exact: true }).tap();
    await mobile.page.setViewportSize({ width: 360, height: 1250 });
    await mobile.page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await capture(mobile.page, 'face-mobile');
  }
  await mobile.context.close();

  const plain = await carePage({ javaScriptEnabled: false });
  await plain.page.goto(careUrl);
  await plain.page.getByRole('navigation', { name: 'Care modules' }).getByRole('link', { name: 'Nails' }).click();
  await plain.page.waitForURL(`${careUrl}#nails`);
  assert.equal(await plain.page.getByRole('heading', { name: 'Face routine map' }).count(), 1);
  assert.equal(await plain.page.getByRole('checkbox').count(), 0);
  await plain.context.close();

  const blocked = await carePage();
  await blocked.page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await blocked.page.goto(careUrl);
  await blocked.page.getByRole('status').filter({ hasText: 'Browser storage is unavailable' }).waitFor();
  const blockedCheck = blocked.page.getByRole('checkbox').first();
  await blockedCheck.check();
  assert.equal(await blockedCheck.isChecked(), true);
  await blocked.context.close();
  console.log('Care mobile layout, no-JS reading and blocked storage passed.');

  const fallback = await carePage();
  await fallback.page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await fallback.page.goto(`${base}/`);
  const textMap = fallback.page.getByRole('navigation', { name: 'Eshkere universe map' });
  const careLink = textMap.getByRole('link', { name: 'ESHKERE Care', exact: true });
  await careLink.waitFor({ timeout: 30000 });
  assert.equal(await careLink.evaluate((link) => link.href), careUrl);
  await careLink.click();
  await fallback.page.waitForURL(careUrl);
  await fallback.page.getByRole('link', { name: /Universe home/ }).click();
  await fallback.page.waitForURL(`${base}/`);
  await fallback.context.close();

  const cosmic = await carePage({ viewport: { width: 1440, height: 900 } });
  await cosmic.page.goto(`${base}/`);
  await cosmic.page.locator('[data-universe-open]:not([data-universe-region])').click();
  for (const id of ['health', 'health-physical']) {
    const label = cosmic.page.locator(`.u-label[data-node-id="${id}"]`);
    await label.click({ timeout: 40000 });
  }

  const destinationSelector = '.u-label[data-node-id="health-care"]';
  const destination = cosmic.page.locator(destinationSelector);
  await destination.click({ trial: true, timeout: 40000 });
  const crumbs = cosmic.page.locator('[data-universe-crumbs] .u-crumb');
  const physicalPath = ['Universe', 'Health Core', 'Physical'];
  assert.deepEqual(await crumbs.allTextContents(), physicalPath);

  const canvasPoint = await cosmic.page.evaluate(() => {
    for (let x = 80; x < 320; x += 40) {
      for (let y = 130; y < 330; y += 40) {
        if (document.elementFromPoint(x, y)?.matches('[data-universe-canvas]')) return { x, y };
      }
    }
    return null;
  });
  assert.ok(canvasPoint, 'a drag can start on the map canvas');
  const { x, y } = canvasPoint;

  for (const gesture of ['orbit', 'pan', 'dolly']) {
    const before = await destination.boundingBox();
    assert.ok(before, `Care is visible before ${gesture}`);
    await cosmic.page.mouse.move(x, y);
    if (gesture === 'dolly') {
      await cosmic.page.mouse.wheel(0, -110);
    } else {
      const button = gesture === 'orbit' ? 'right' : 'left';
      await cosmic.page.mouse.down({ button });
      await cosmic.page.mouse.move(x + 48, y + 20, { steps: 8 });
      await cosmic.page.mouse.up({ button });
    }
    await cosmic.page.waitForFunction(({ selector, before }) => {
      const label = document.querySelector(selector)?.getBoundingClientRect();
      return label && label.width > 0 && Math.hypot(label.x - before.x, label.y - before.y) > 1;
    }, { selector: destinationSelector, before });
    assert.deepEqual(await crumbs.allTextContents(), physicalPath, `${gesture} keeps Physical selected`);
  }

  await destination.click({ timeout: 40000 });
  await cosmic.page.waitForURL(careUrl);
  const arrivingCheck = cosmic.page.getByRole('checkbox', { name: /Complete Check texture/ });
  await arrivingCheck.check();
  await cosmic.page.reload();
  await arrivingCheck.waitFor();
  assert.equal(await arrivingCheck.isChecked(), true);
  await cosmic.page.getByRole('link', { name: /Universe home/ }).click();
  await cosmic.page.waitForURL(`${base}/`);
  await cosmic.context.close();
  console.log('Care works from the text map and after orbiting, panning and dollying in WebGL Health Core → Physical.');
} finally {
  await browser.close();
}
