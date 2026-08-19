/**
 * UI verification harness. Assumes a server (dev or preview) is running.
 *
 *   BASE_URL=http://localhost:4321/eshkere node scripts/ui-check.mjs
 *
 * Checks every route at desktop/tablet/mobile widths for horizontal
 * overflow and console errors, exercises navigation, search and filters,
 * and saves screenshots to SCREENSHOT_DIR (default ./screenshots).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = (process.env.BASE_URL ?? 'http://localhost:4321/eshkere').replace(/\/$/, '');
const SHOT_DIR = process.env.SCREENSHOT_DIR ?? './screenshots';
mkdirSync(SHOT_DIR, { recursive: true });

const routes = [
  '/',
  '/portfolio',
  '/research-and-news',
  '/research-and-news/blog',
  '/research-and-news/staff-publications-and-projects',
  '/research-and-news/a-first-version-of-eshkere-org',
  '/research-and-news/blog/sample-health-debt',
  '/research-and-news/staff-publications-and-projects/eshkere-website',
  '/our-approach',
  '/about-us',
  '/about-us/history',
  '/about-us/partner-with-us',
  '/about-us/team',
  '/about-us/careers',
  '/about-us/media-center',
  '/search',
  '/definitely-not-a-page',
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-min', width: 360, height: 780 },
];

const failures = [];
const note = (ok, message) => {
  console.log(`${ok ? '  ok ' : 'FAIL '} ${message}`);
  if (!ok) failures.push(message);
};

// When checking a remote deployment from behind an intercepting egress
// proxy, route the browser through it and accept its CA.
const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
const remoteTarget = !/localhost|127\.0\.0\.1/.test(BASE);
const CTX = remoteTarget && proxyServer ? { ignoreHTTPSErrors: true } : {};

const browser = await chromium.launch({
  // Use a system chromium when provided (e.g. CI images with preinstalled browsers).
  executablePath: process.env.CHROMIUM_PATH || undefined,
  proxy: remoteTarget && proxyServer ? { server: proxyServer } : undefined,
});

// ---------------------------------------------------------- route sweep
for (const viewport of viewports) {
  const context = await browser.newContext({ ...CTX,
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    // The intentional 404 route logs a resource error by design.
    if (msg.type() === 'error' && !page.url().includes('definitely-not-a-page')) {
      consoleErrors.push(`${page.url()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(`${page.url()}: ${err.message}`));

  for (const route of routes) {
    const response = await page.goto(BASE + route, { waitUntil: 'networkidle' });
    const expectedStatus = route === '/definitely-not-a-page' ? 404 : 200;
    note(
      response.status() === expectedStatus,
      `[${viewport.name}] ${route} → HTTP ${response.status()}`
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    note(overflow <= 1, `[${viewport.name}] ${route} no horizontal overflow (delta ${overflow}px)`);

    const h1Count = await page.locator('h1').count();
    note(h1Count === 1, `[${viewport.name}] ${route} exactly one h1 (${h1Count})`);

    const hasMain = await page.locator('main#main').count();
    note(hasMain === 1, `[${viewport.name}] ${route} has main landmark`);
  }

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT_DIR}/home-${viewport.name}.png`, fullPage: true });
  await page.goto(BASE + '/research-and-news', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT_DIR}/research-${viewport.name}.png`, fullPage: true });
  await page.goto(BASE + '/our-approach', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT_DIR}/approach-${viewport.name}.png`, fullPage: true });

  note(consoleErrors.length === 0, `[${viewport.name}] no console errors (${consoleErrors.join('; ').slice(0, 300)})`);
  await context.close();
}

// ---------------------------------------------- menu navigation (desktop)
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const openMenu = async () => {
    await page.click('.menu-toggle');
    await page.waitForSelector('#site-menu:not([hidden])');
  };

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await openMenu();
  const menuLinks = await page.locator('#site-menu a').count();
  // 4 primary + 3 research children + 6 about children = 13 (search lives in the header icon)
  note(menuLinks === 13, `menu exposes complete hierarchy (${menuLinks} links)`);

  // Primary destinations via the menu
  for (const [label, path] of [
    ['Portfolio', '/portfolio'],
    ['Our Approach', '/our-approach'],
    ['About Us', '/about-us'],
  ]) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openMenu();
    await page.click(`.site-menu__primary:has-text("${label}")`);
    await page.waitForLoadState('networkidle');
    note(page.url().startsWith(BASE + path), `menu primary "${label}" → ${page.url()}`);
  }

  // Section children via the menu
  for (const [label, path] of [
    ['Research & News', '/research-and-news'],
    ['Blog', '/research-and-news/blog'],
    ['Staff Publications & Projects', '/research-and-news/staff-publications-and-projects'],
    ['Who We Are', '/about-us'],
    ['Our History', '/about-us/history'],
    ['Partner With Us', '/about-us/partner-with-us'],
    ['Team', '/about-us/team'],
    ['Careers', '/about-us/careers'],
    ['Media Center', '/about-us/media-center'],
  ]) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openMenu();
    await page.click(`.site-menu__children a:has-text("${label}")`);
    await page.waitForLoadState('networkidle');
    note(page.url().startsWith(BASE + path), `menu child "${label}" → ${page.url()}`);
  }

  // Current page is marked inside the menu
  await page.goto(BASE + '/research-and-news/blog', { waitUntil: 'networkidle' });
  await openMenu();
  const current = await page.locator('#site-menu a[aria-current="page"]').textContent();
  note(current?.trim() === 'Blog', `menu marks current page (${current?.trim()})`);

  // Header follows on scroll, with no shading of its own
  await page.keyboard.press('Escape');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  const headerState = await page.evaluate(() => {
    const header = document.querySelector('.site-header');
    const { top } = header.getBoundingClientRect();
    return { top, background: getComputedStyle(header).backgroundColor };
  });
  note(
    headerState.top === 0 && /rgba\(0, 0, 0, 0\)|transparent/.test(headerState.background),
    `header follows unshaded (top=${headerState.top}, bg=${headerState.background})`
  );

  // Logo links home; search icon reaches /search
  await page.goto(BASE + '/about-us', { waitUntil: 'networkidle' });
  await page.click('.logo');
  await page.waitForLoadState('networkidle');
  note(page.url().replace(/\/$/, '') === BASE, `logo → home (${page.url()})`);
  await page.click('.search-link');
  await page.waitForLoadState('networkidle');
  note(page.url().startsWith(BASE + '/search'), `header search icon → ${page.url()}`);

  await context.close();
}

// --------------------------------------------------- mobile navigation
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  await page.click('.menu-toggle');
  const menuVisible = await page.locator('#site-menu').isVisible();
  note(menuVisible, 'mobile menu opens');

  const menuLinks = await page.locator('#site-menu a').count();
  // 4 primary + 3 research children + 6 about children = 13 (search lives in the header icon)
  note(menuLinks === 13, `mobile menu exposes complete hierarchy (${menuLinks} links)`);

  await page.click('#site-menu a:has-text("Media Center")');
  await page.waitForLoadState('networkidle');
  note(page.url().startsWith(BASE + '/about-us/media-center'), `mobile menu deep link → ${page.url()}`);

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('.menu-toggle');
  await page.keyboard.press('Escape');
  const menuHidden = await page.locator('#site-menu').isHidden();
  note(menuHidden, 'mobile menu closes on Escape');
  await page.screenshot({ path: `${SHOT_DIR}/mobile-menu.png` });

  await context.close();
}

// ------------------------------------------------------------- search
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + '/search', { waitUntil: 'networkidle' });

  await page.fill('#search-input', 'health');
  await page.waitForTimeout(600);
  const resultCount = await page.locator('.search__result').count();
  note(resultCount > 3, `search "health" returns results (${resultCount})`);

  await page.fill('#search-input', 'xyzzyqwerty');
  await page.waitForTimeout(600);
  const noResults = await page.locator('[data-search-status]').textContent();
  note(/Nothing found/.test(noResults ?? ''), `search no-results message: "${noResults?.trim()}"`);

  // Section filter narrows results
  await page.fill('#search-input', 'game');
  await page.waitForTimeout(600);
  const allCount = await page.locator('.search__result').count();
  await page.click('.filter-toggle[data-section="Blog"]');
  await page.waitForTimeout(400);
  const blogCount = await page.locator('.search__result').count();
  const blogSections = await page.locator('.search__result-section').allTextContents();
  note(
    blogCount > 0 && blogCount <= allCount && blogSections.every((s) => s.startsWith('Blog')),
    `search section filter works (all=${allCount}, blog=${blogCount})`
  );

  // Deep link ?q=
  await page.goto(BASE + '/search?q=health', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const deepCount = await page.locator('.search__result').count();
  note(deepCount > 0, `search deep link ?q=health returns results (${deepCount})`);
  await page.screenshot({ path: `${SHOT_DIR}/search.png`, fullPage: true });

  await context.close();
}

// ------------------------------------------------------------ filters
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Research filters
  await page.goto(BASE + '/research-and-news', { waitUntil: 'networkidle' });
  const totalCards = await page.locator('[data-rn-grid] .content-card:visible').count();
  await page.selectOption('#rn-type', 'announcement');
  await page.waitForTimeout(300);
  const announcementCards = await page.locator('[data-rn-grid] .content-card:visible').count();
  note(
    announcementCards > 0 && announcementCards < totalCards,
    `research type filter (all=${totalCards}, announcement=${announcementCards})`
  );

  await page.selectOption('#rn-type', '');
  await page.fill('#rn-q', 'floor');
  await page.waitForTimeout(300);
  const keywordCards = await page.locator('[data-rn-grid] .content-card:visible').count();
  note(keywordCards >= 1 && keywordCards < totalCards, `research keyword filter (floor=${keywordCards})`);

  await page.fill('#rn-q', '');
  await page.selectOption('#rn-sort', 'oldest');
  await page.waitForTimeout(300);
  const dates = await page
    .locator('[data-rn-grid] .content-card:visible time')
    .evaluateAll((els) => els.map((el) => el.getAttribute('datetime')));
  const sorted = [...dates].sort();
  note(JSON.stringify(dates) === JSON.stringify(sorted), `research oldest-first sort (${dates.join(', ')})`);

  // Blog topic filter
  await page.goto(BASE + '/research-and-news/blog', { waitUntil: 'networkidle' });
  const allPosts = await page.locator('.blog-list__item:visible').count();
  await page.click('.filter-toggle[data-topic="metaphors"]');
  await page.waitForTimeout(300);
  const topicPosts = await page.locator('.blog-list__item:visible').count();
  note(topicPosts === 1 && allPosts > topicPosts, `blog topic filter (all=${allPosts}, metaphors=${topicPosts})`);

  // Staff work kind filter
  await page.goto(BASE + '/research-and-news/staff-publications-and-projects', { waitUntil: 'networkidle' });
  const allWorks = await page.locator('.work-item:visible').count();
  await page.click('.filter-toggle[data-kind="tool"]');
  await page.waitForTimeout(300);
  const toolWorks = await page.locator('.work-item:visible').count();
  note(toolWorks === 1 && allWorks > toolWorks, `staff work kind filter (all=${allWorks}, tools=${toolWorks})`);

  await context.close();
}

// --------------------------------------------- hero artwork hotspots
{
  // Reduced motion pins the drifting stage, so the targets hold still.
  const context = await browser.newContext({
    ...CTX,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  for (const [index, anchorId] of [
    [0, '#health-heading'],
    [1, '#games-heading'],
  ]) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.locator('.hero__hotspot').nth(index).click({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    note(
      page.url().includes('/our-approach' + anchorId),
      `hero hotspot ${index} → ${page.url()}`
    );
  }

  // The hero content block must not swallow clicks meant for the artwork.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.hero__ctas a').first().click({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  note(page.url().includes('/our-approach'), `hero CTA still clickable → ${page.url()}`);

  // The hover lighting must trace the mark the artist drew: a circle for
  // the round badge, a tilted rounded rectangle for the plaque.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const shapes = await page
    .locator('[data-art-hotspots]:not([hidden]) .hero__hotspot')
    .evaluateAll((els) =>
      els.map((el) => {
        const style = getComputedStyle(el);
        return {
          shape: el.dataset.shape,
          radius: style.borderRadius,
          rotated: style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)',
        };
      })
    );
  const circle = shapes.find((s) => s.shape === 'circle');
  const plaque = shapes.find((s) => s.shape === 'plaque');
  note(!!circle && circle.radius.startsWith('50%'), `badge hotspot is round (${circle?.radius})`);
  note(!!plaque && plaque.rotated, `plaque hotspot is tilted (${plaque?.rotated})`);

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  // Only the selected artwork's layer is live; the others stay hidden.
  const names = await page
    .locator('[data-art-hotspots]:not([hidden]) .hero__hotspot')
    .evaluateAll((els) => els.map((el) => el.textContent.trim()));
  note(
    names.length === 2 && names.every((name) => name.length > 10),
    `hero hotspots carry accessible names (${names.length})`
  );

  await context.close();
}

// ------------------------------------------------- artwork switcher
{
  const context = await browser.newContext({
    ...CTX,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const choices = await page.locator('[data-art-choice]').count();
  note(choices >= 2, `artwork switcher offers ${choices} artworks`);

  if (choices >= 2) {
    const ids = await page
      .locator('[data-art-choice]')
      .evaluateAll((els) => els.map((el) => el.dataset.artChoice));

    for (const id of ids) {
      await page.click(`[data-art-choice="${id}"]`);
      await page.waitForTimeout(400);
      const state = await page.evaluate((artId) => {
        const shown = [...document.querySelectorAll('[data-art-image]')].filter((el) => !el.hidden);
        const spots = [...document.querySelectorAll('[data-art-hotspots]')].filter((el) => !el.hidden);
        return {
          visible: shown.length === 1 && shown[0].dataset.artImage === artId,
          hotspotLayers: spots.length,
          theme: document.querySelector('.hero').dataset.heroTheme,
          expectedTheme: shown[0]?.dataset.artTheme,
        };
      }, id);
      note(state.visible, `switcher shows only "${id}"`);
      note(state.hotspotLayers === 1, `"${id}" exposes one hotspot layer (${state.hotspotLayers})`);
      note(state.theme === state.expectedTheme, `"${id}" applies its theme (${state.theme})`);

      // Hotspots of the selected artwork still reach their sections.
      await page.locator('.hero__hotspot:visible').first().click({ timeout: 15000 });
      await page.waitForLoadState('networkidle');
      note(page.url().includes('/our-approach'), `"${id}" hotspot navigates (${page.url().split('/eshkere')[1]})`);
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);
    }

    // The choice survives a reload.
    await page.click(`[data-art-choice="${ids[1]}"]`);
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const remembered = await page.evaluate(
      () => [...document.querySelectorAll('[data-art-image]')].find((el) => !el.hidden)?.dataset.artImage
    );
    note(remembered === ids[1], `switcher remembers the choice (${remembered})`);
  }

  await context.close();
}

// ------------------------------------------------ search appears once
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const path of ['/', '/portfolio', '/about-us', '/research-and-news']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const stray = await page.evaluate(() => {
      const found = [];
      document.querySelectorAll('footer a, #site-menu a').forEach((link) => {
        if (/^search$/i.test(link.textContent.trim())) found.push(link.getAttribute('href'));
      });
      return found;
    });
    note(stray.length === 0, `no duplicate Search link on ${path} (${JSON.stringify(stray)})`);
  }

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  note(await page.locator('.search-link').isVisible(), 'header search icon present');

  await context.close();
}

// ------------------------------------------------ arrow-link hover
{
  const context = await browser.newContext({
    ...CTX,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const measure = () =>
    page.evaluate(() => {
      const links = document.querySelectorAll('.hero__ctas a');
      return {
        neighbour: Math.round(links[1].getBoundingClientRect().x),
        arrow: parseFloat(getComputedStyle(links[0], '::after').width),
      };
    });

  const rest = await measure();
  await page.hover('.hero__ctas a:first-child');
  await page.waitForTimeout(450);
  const hovered = await measure();

  note(hovered.arrow > rest.arrow, `arrow grows on hover (${rest.arrow} → ${hovered.arrow}px)`);
  note(
    hovered.neighbour === rest.neighbour,
    `neighbouring link holds still (${rest.neighbour} → ${hovered.neighbour}px)`
  );

  await context.close();
}

// ---------------------------------------------------- page titles
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const home = await page.title();
  note(home === 'Eshkere', `homepage title is just the name ("${home}")`);

  await page.goto(BASE + '/portfolio', { waitUntil: 'networkidle' });
  const inner = await page.title();
  note(inner === 'Portfolio — Eshkere', `inner page names itself first ("${inner}")`);

  await context.close();
}

// ---------------------------------------------------- hero headline
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const lines = await page.evaluate(() => {
    const el = document.querySelector('.hero__heading');
    return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
  });
  note(lines === 2, `desktop headline holds two lines (${lines})`);
  await context.close();

  for (const width of [360, 390]) {
    const phone = await browser.newContext({ ...CTX, viewport: { width, height: 800 } });
    const view = await phone.newPage();
    await view.goto(BASE + '/', { waitUntil: 'networkidle' });
    const size = await view.evaluate(
      () => parseFloat(getComputedStyle(document.querySelector('.hero__heading')).fontSize)
    );
    note(size >= 44, `${width}px headline stays large (${size}px)`);
    await phone.close();
  }
}

// ----------------------------------------------------- reduced motion
{
  const context = await browser.newContext({ ...CTX,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const heading = await page.locator('#hero-heading').isVisible();
  note(heading, 'homepage readable with reduced motion');
  await page.screenshot({ path: `${SHOT_DIR}/home-reduced-motion.png` });
  await context.close();
}

await browser.close();

console.log('\n————————————————————————————');
if (failures.length === 0) {
  console.log('All UI checks passed.');
} else {
  console.log(`${failures.length} check(s) failed:`);
  for (const failure of failures) console.log(` - ${failure}`);
  process.exitCode = 1;
}
