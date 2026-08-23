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
import { mkdirSync, readFileSync } from 'node:fs';

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
  // Headless Chrome has no GPU, so WebGL is only available through the
  // software rasteriser. Forcing it also makes the universe checks render
  // the same everywhere, which is what makes their screenshots comparable.
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
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
    names.length === 4 && names.every((name) => name.length > 5),
    `hero hotspots carry accessible names (${names.length})`
  );

  await context.close();
}

// ------------------------------------------------------ the one artwork
{
  const context = await browser.newContext({
    ...CTX,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const art = await page.evaluate(() => {
    const shown = [...document.querySelectorAll('[data-art-image]')].filter((el) => !el.hidden);
    const layers = [...document.querySelectorAll('[data-art-hotspots]')].filter((el) => !el.hidden);
    return {
      images: document.querySelectorAll('[data-art-image]').length,
      shown: shown.map((el) => el.dataset.artImage),
      layers: layers.length,
      theme: document.querySelector('.hero').dataset.heroTheme,
      expectedTheme: shown[0]?.dataset.artTheme,
      choices: document.querySelectorAll('[data-art-choice]').length,
    };
  });
  note(
    art.images === 1 && art.shown[0] === 'nebula',
    `hero ships exactly one artwork (${art.shown.join(', ')})`
  );
  note(art.layers === 1, `one hotspot layer is live (${art.layers})`);
  note(art.theme === art.expectedTheme, `hero applies the artwork's theme (${art.theme})`);
  note(art.choices === 0, `no artwork comparison buttons remain (${art.choices})`);

  // The artwork's own lettering still navigates.
  await page.locator('.hero__hotspot').first().click({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  note(page.url().includes('/our-approach'), `hero hotspot navigates (${page.url().split('/eshkere')[1]})`);

  await context.close();
}

// ------------------------------------------- current-source star link
{
  // The star's label and destination must come from the generated file that
  // CI rewrites from Notion — not from anything hard-coded.
  const generated = JSON.parse(
    readFileSync(new URL('../src/data/current-source.generated.json', import.meta.url), 'utf8')
  );

  const context = await browser.newContext({
    ...CTX,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const ids = await page
    .locator('[data-art-choice]')
    .evaluateAll((els) => els.map((el) => el.dataset.artChoice));

  for (const id of ids.length ? ids : ['default']) {
    if (id !== 'default') {
      await page.click(`[data-art-choice="${id}"]`);
      await page.waitForTimeout(400);
    }
    const star = page
      .locator('[data-art-hotspots]:not([hidden]) .hero__hotspot')
      .filter({ hasText: 'Currently reading:' });

    note((await star.count()) === 1, `"${id}" has exactly one current-source star`);

    const label = (await star.first().textContent())?.trim() ?? '';
    note(
      label.startsWith(`Currently reading: ${generated.title}`),
      `"${id}" star label follows the generated title`
    );
    note(
      (await star.first().getAttribute('href')) === generated.url,
      `"${id}" star links to the generated URL`
    );
    note(
      (await star.first().getAttribute('target')) === '_blank' &&
        (await star.first().getAttribute('rel'))?.includes('noopener'),
      `"${id}" star opens safely in a new tab`
    );
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

// ------------------------------------------------- a quieter hero
{
  const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  const hero = await page.evaluate(() => {
    const support = document.querySelector('.hero__support');
    const after = getComputedStyle(support, '::after');
    return {
      line: support.textContent.trim(),
      flourish: after.content,
      switcherLabel: !!document.querySelector('.art-switcher__label'),
      options: [...document.querySelectorAll('.art-switcher__option')].map((el) =>
        el.textContent.trim()
      ),
    };
  });
  note(
    hero.line === 'Health is non-optional. Everything else is a game.',
    'the supporting line reads as written'
  );
  note(
    hero.flourish === 'none' || hero.flourish === 'normal',
    `and stands on its own, with no arrow after it (${hero.flourish})`
  );
  note(!hero.switcherLabel, 'the switcher has no category label');
  note(
    hero.options.length === 2 && hero.options.join(' / ') === 'Universe / AI Safety',
    `just its two entries (${hero.options.join(' / ')})`
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


// ------------------------------------------------------- universe map
{
  /**
   * The universe is a lazily-loaded WebGL island over the hero. These checks
   * cover the three things that could break quietly: the hero staying
   * untouched at rest, the transition actually resolving into a map, and the
   * Notion-driven Current Source surviving the trip into the wider scene.
   */
  const generated = JSON.parse(
    readFileSync(new URL('../src/data/current-source.generated.json', import.meta.url), 'utf8')
  );

  const openUniverse = async (page) => {
    await page.click('[data-universe-open]');
    await page.waitForFunction(
      () => document.documentElement.classList.contains('universe-open'),
      null,
      { timeout: 25000 }
    );
    await page.waitForTimeout(600);
  };

  // --- at rest: nothing of the universe is on screen or on the network
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    const rest = await page.evaluate(() => ({
      overlayHidden: document.querySelector('[data-universe]').hidden,
      active: document.documentElement.className,
      heroArtVisible: !!document.querySelector('[data-art-image]:not([hidden]) img'),
      indexInert: document.querySelector('.universe-index').inert,
      launcher: !!document.querySelector('[data-universe-open]'),
    }));
    note(rest.overlayHidden, 'universe overlay hidden at rest');
    note(rest.active === '', `no universe classes at rest ("${rest.active}")`);
    note(rest.heroArtVisible, 'hero artwork untouched at rest');
    note(rest.indexInert, 'text index dormant while the page is just the page');
    note(rest.launcher, 'visible zoom-out control exists');

    // The way in lives with the other views, not as a CTA of its own.
    const control = await page.evaluate(() => {
      const openers = [...document.querySelectorAll('[data-universe-open]')];
      return {
        allInSwitcher: openers.every((el) => !!el.closest('.art-switcher')),
        views: [...document.querySelectorAll('.art-switcher button')].map((b) =>
          b.textContent.trim()
        ),
        regions: openers.map((el) => el.dataset.universeRegion ?? ''),
        strayCta: document.querySelectorAll('.hero__content [data-universe-open]').length,
      };
    });
    note(control.allInSwitcher, 'the map is entered from the view switcher');
    note(
      control.views.length === 2 &&
        control.views[0] === 'Universe' &&
        control.views[1] === 'AI Safety',
      `switcher offers two entries (${control.views.join(' / ')})`
    );
    note(
      control.regions.join(',') === ',ai-safety',
      `the second entry names its galaxy (${control.regions.join(' | ')})`
    );
    note(control.strayCta === 0, 'no standalone zoom-out button in the hero CTAs');

    // The renderer is prefetched on idle, never as part of first paint.
    const html = await (await fetch(BASE + '/')).text();
    note(
      !/<script[^>]*src="[^"]*universe[^"]*\.js"/.test(html.replace(/UniverseMap[^"]*/g, '')),
      'three.js chunk is not a first-paint script'
    );
    await context.close();
  }

  // --- the transition resolves into a map
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);

    const regions = await page.$$eval('.u-label--region:not([hidden])', (els) =>
      els.map((el) => el.dataset.nodeId)
    );
    note(
      regions.length === 5 &&
        ['health', 'ai-safety', 'power', 'knowledge', 'culture'].every((id) =>
          regions.includes(id)
        ),
      `universe shows Health Core and four galaxies (${regions.join(', ')})`
    );

    const hud = await page.evaluate(() => ({
      hidden: document.querySelector('[data-universe-hud]').hidden,
      level: document.querySelector('[data-universe-level]').textContent,
      crumbs: [...document.querySelectorAll('[data-universe-crumbs] .u-crumb')].length,
    }));
    note(!hud.hidden && hud.level === 'Universe', `HUD reports the zoom level (${hud.level})`);
    await page.screenshot({ path: `${SHOT_DIR}/universe-overview.png` });

    // --- fly into a galaxy
    await page.click('.u-label[data-node-id="ai-safety"]');
    await page.waitForTimeout(1800);
    const galaxy = await page.evaluate(() => ({
      level: document.querySelector('[data-universe-level]').textContent,
      crumbs: [...document.querySelectorAll('.u-crumb')].map((el) => el.textContent),
      systems: [...document.querySelectorAll('.u-label--system:not([hidden])')].length,
      detail: document.querySelector('[data-universe-detail-title]').textContent,
    }));
    note(galaxy.level === 'Galaxy', `flying in reaches galaxy level (${galaxy.level})`);
    note(
      galaxy.crumbs.join(' / ') === 'Universe / AI Safety',
      `breadcrumb tracks the flight (${galaxy.crumbs.join(' / ')})`
    );
    note(galaxy.systems >= 5, `AI Safety reveals its star systems (${galaxy.systems})`);
    note(galaxy.detail === 'AI Safety', `detail panel names the selection (${galaxy.detail})`);
    await page.screenshot({ path: `${SHOT_DIR}/universe-galaxy.png` });

    // --- a real destination, with a real href
    await page.click('.u-label[data-node-id="ais-grantmaking"]');
    await page.waitForTimeout(1800);
    const planet = await page.evaluate(() => {
      const el = document.querySelector('.u-label[data-node-id="ais-grantmaking-os"]');
      return el
        ? { href: el.getAttribute('href'), target: el.getAttribute('target'), tag: el.tagName }
        : null;
    });
    note(
      planet?.tag === 'A' && planet.href?.includes('Grantmaking-OS') && planet.target === '_blank',
      `Grantmaking OS is a real link (${planet?.href?.slice(0, 48)})`
    );

    const pending = await page.evaluate(
      () => document.querySelector('.u-label[data-node-id="ais-rfps"]')?.tagName
    );
    note(pending !== 'A', 'destinations without a page are not links');
    await page.screenshot({ path: `${SHOT_DIR}/universe-system.png` });

    // --- Escape walks back out one semantic level at a time
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1400);
    const back1 = await page.evaluate(
      () => document.querySelector('[data-universe-level]').textContent
    );
    note(back1 === 'Galaxy', `Escape returns to the galaxy (${back1})`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1400);
    const back2 = await page.evaluate(
      () => document.querySelector('[data-universe-level]').textContent
    );
    note(back2 === 'Universe', `Escape returns to the universe (${back2})`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(3200);
    const closed = await page.evaluate(() => ({
      classes: document.documentElement.className,
      overlayHidden: document.querySelector('[data-universe]').hidden,
      headingVisible: !!document.querySelector('.hero__heading').offsetHeight,
      heroOpacity: getComputedStyle(document.querySelector('.hero__stage')).opacity,
      indexInert: document.querySelector('.universe-index').inert,
    }));
    note(closed.classes === '' && closed.overlayHidden, 'Escape at the top level returns the page');
    note(
      closed.headingVisible && closed.heroOpacity === '1',
      `hero is restored exactly (stage opacity ${closed.heroOpacity})`
    );
    note(closed.indexInert, 'text index goes dormant again on exit');

    note(errors.length === 0, `universe raises no console errors (${errors.join('; ').slice(0, 200)})`);
    await context.close();
  }

  // --- the Current Source comet is the hero star, moved
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);

    const comet = await page.evaluate(() => {
      const el = document.querySelector('.u-label--comet');
      return el
        ? {
            name: el.getAttribute('aria-label'),
            short: el.querySelector('.u-label__text--short')?.textContent,
            href: el.getAttribute('href'),
            target: el.getAttribute('target'),
            rel: el.getAttribute('rel'),
          }
        : null;
    });
    note(
      comet?.name === `Currently reading: ${generated.title}`,
      `comet carries the generated title (${comet?.name?.slice(0, 60)})`
    );
    note(comet?.href === generated.url, 'comet links to the generated URL');
    note(
      comet?.target === '_blank' && comet.rel?.includes('noopener'),
      'comet opens safely in a new tab'
    );
    note(comet?.short === 'Current source', 'comet is compact until hovered');

    // The comet is the one thing that keeps moving while the camera holds
    // still. The label layer skips its whole layout pass in a stationary
    // view, so unless it also notices a node that moved on its own, the name
    // stays where the comet used to be and drifts across the map away from
    // it — which is exactly what it did.
    await page.waitForTimeout(1200);
    const tracking = await page.evaluate(async () => {
      const el = document.querySelector('.u-label--comet');
      const region = document.querySelector('.u-label--region');
      const read = (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, on: !node.hidden };
      };
      const anchored = read(region);
      const seen = [];
      for (let i = 0; i < 180; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const at = read(el);
        if (at.on) seen.push(at);
      }
      let biggestStep = 0;
      for (let i = 1; i < seen.length; i += 1) {
        biggestStep = Math.max(
          biggestStep,
          Math.hypot(seen[i].x - seen[i - 1].x, seen[i].y - seen[i - 1].y)
        );
      }
      const first = seen[0];
      const last = seen[seen.length - 1];
      const regionAfter = read(region);
      return {
        samples: seen.length,
        travelled: first && last ? Math.hypot(last.x - first.x, last.y - first.y) : 0,
        biggestStep,
        regionMoved: Math.hypot(regionAfter.x - anchored.x, regionAfter.y - anchored.y),
      };
    });
    note(
      tracking.samples > 60 && tracking.travelled > 2,
      `the comet's name travels with it (${tracking.travelled.toFixed(1)}px over ${
        tracking.samples
      } visible frames)`
    );
    note(
      tracking.biggestStep < 16,
      `and follows it smoothly rather than jumping (worst step ${tracking.biggestStep.toFixed(1)}px)`
    );
    note(
      tracking.regionMoved === 0,
      `while the still labels stay still (${tracking.regionMoved}px)`
    );
    await context.close();
  }


  // --- the second entry lands on its galaxy
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.click('[data-universe-region="ai-safety"]');
    await page.waitForFunction(
      () => document.querySelector('[data-universe-level]')?.textContent === 'Galaxy',
      null,
      { timeout: 30000 }
    );
    await page.waitForTimeout(1400);
    const landed = await page.evaluate(() => ({
      level: document.querySelector('[data-universe-level]').textContent,
      crumbs: [...document.querySelectorAll('.u-crumb')].map((el) => el.textContent).join(' / '),
      detail: document.querySelector('[data-universe-detail-title]').textContent,
      systems: document.querySelectorAll('.u-label--system:not([hidden])').length,
    }));
    note(
      landed.level === 'Galaxy' && landed.crumbs === 'Universe / AI Safety',
      `"AI Safety" flies straight there (${landed.crumbs})`
    );
    note(
      landed.detail === 'AI Safety' && landed.systems >= 5,
      `and arrives with its systems open (${landed.systems})`
    );
    await page.screenshot({ path: `${SHOT_DIR}/universe-ai-safety-entry.png` });
    await context.close();
  }

  // --- the artwork's green smiley is a link, at every viewport
  {
    for (const [width, height] of [
      [1440, 900],
      [1440, 810],
      [1280, 720],
    ]) {
      const context = await browser.newContext({
        ...CTX,
        viewport: { width, height },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      const mark = await page.evaluate(() => {
        const spot = [
          ...document.querySelectorAll('[data-art-hotspots]:not([hidden]) .hero__hotspot'),
        ].find((el) => (el.textContent ?? '').includes('Grantmaking OS'));
        if (!spot) return null;
        const box = spot.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return {
          href: spot.getAttribute('href'),
          reachable: top === spot || spot.contains(top),
          blockedBy: top === spot ? '' : `${top?.tagName}.${top?.className}`.slice(0, 40),
        };
      });
      note(
        !!mark && mark.reachable && !!mark.href?.includes('Grantmaking-OS'),
        `[${width}x${height}] hero smiley is clickable (${mark?.blockedBy || 'reachable'})`
      );
      await context.close();
    }
  }

  // --- and the planet keeps it out in the universe
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);

    const mark = await page.evaluate(() => {
      const el = document.querySelector('.u-label--mark');
      return el
        ? {
            tag: el.tagName,
            href: el.getAttribute('href'),
            target: el.getAttribute('target'),
            text: el.textContent.trim(),
            quietAtRest: el.hidden,
          }
        : null;
    });
    note(
      mark?.tag === 'A' && !!mark.href?.includes('Grantmaking-OS') && mark.target === '_blank',
      `universe smiley is the same link (${mark?.href?.slice(0, 46)})`
    );
    note(mark?.quietAtRest === true, 'universe smiley is drawn on the world, not captioned');

    // Hovering the mark names it — the same behaviour the hero hotspot has.
    const revealed = await page.evaluate(async () => {
      const el = document.querySelector('.u-label--mark');
      el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      const box = el.getBoundingClientRect();
      return {
        hidden: el.hidden,
        text: el.textContent.trim(),
        onScreen: box.width > 0 && box.left > 0 && box.left < window.innerWidth,
      };
    });
    note(
      !revealed.hidden && revealed.onScreen,
      `hovering the universe smiley names it (${revealed.text})`
    );
    await page.screenshot({ path: `${SHOT_DIR}/universe-home-planet.png` });
    await context.close();
  }

  // --- the home world is the way back
  {
    /**
     * Both the planet and its caption do what "Back to the page" does, and
     * neither of them is a link — they run the same return transition. The
     * smiley on the planet's face keeps its own destination, which is why
     * the two hit areas had to stop being the same size.
     */
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    const caption = () => page.locator('.u-label[data-node-id="home"]');
    const home = async () =>
      page.waitForFunction(() => document.documentElement.className === '', null, {
        timeout: 30000,
      });

    // 1. Clicking the caption returns to the page.
    await openUniverse(page);
    await page.waitForTimeout(1600);
    note(
      (await caption().getAttribute('href')) === null,
      'the home caption is a control, not a link'
    );

    // Its text does not move. A caption that rewrites itself under the
    // pointer reads as noise; the longer form is the accessible name only.
    const reading = async () => (await caption().textContent()).trim();
    const atRest = await reading();
    await caption().hover();
    await page.waitForTimeout(500);
    const onHover = await reading();
    await page.evaluate(() => document.querySelector('.u-label[data-node-id="home"]').focus());
    await page.waitForTimeout(300);
    const onFocus = await reading();
    note(
      atRest === 'You were here' && onHover === atRest && onFocus === atRest,
      `the home caption holds its text (${atRest} / ${onHover} / ${onFocus})`
    );
    note(
      /back to the page/i.test((await caption().getAttribute('aria-label')) ?? ''),
      'while its accessible name still says what it does'
    );

    await caption().click();
    let returned = true;
    await home().catch(() => (returned = false));
    note(returned, 'clicking "You were here" returns to the page');

    // 2. So does pressing it from the keyboard.
    await openUniverse(page);
    await page.waitForTimeout(1600);
    const focusable = await page.evaluate(() => {
      const el = document.querySelector('.u-label[data-node-id="home"]');
      el.focus();
      return document.activeElement === el;
    });
    note(focusable, 'the home caption takes keyboard focus');
    await page.keyboard.press('Enter');
    returned = true;
    await home().catch(() => (returned = false));
    note(returned, 'and Enter on it returns to the page');

    // 3. And so does the planet itself. Its hit area is found by walking up
    //    from the caption until the canvas offers a pointer — which also
    //    checks that hovering the planet says it is interactive.
    await openUniverse(page);
    await page.waitForTimeout(1600);
    const found = await (async () => {
      const box = await caption().boundingBox();
      if (!box) return null;
      const x = Math.round(box.x + box.width / 2);
      for (let y = Math.round(box.y) - 4; y > box.y - 220; y -= 4) {
        await page.mouse.move(x, y);
        await page.waitForTimeout(40);
        const cursor = await page.evaluate(
          () => document.querySelector('[data-universe-canvas]').style.cursor
        );
        if (cursor === 'pointer') return { x, y };
      }
      return null;
    })();
    note(!!found, `hovering the home planet offers a pointer (${found ? `${found.x},${found.y}` : 'never'})`);
    if (found) {
      await page.mouse.click(found.x, found.y - 6);
      returned = true;
      await home().catch(() => (returned = false));
      note(returned, 'clicking the home planet returns to the page');
    } else {
      note(false, 'clicking the home planet returns to the page (planet not found)');
    }

    // 4. Including the middle of it, where the smiley sits. The two used to
    //    share a hit area, so the click that looks most like "press the
    //    planet" is the one most at risk of opening a link instead.
    await openUniverse(page);
    await page.waitForTimeout(1600);
    if (found) {
      const stray = await page.waitForEvent('popup', { timeout: 4000 }).catch(() => null);
      await page.mouse.click(found.x, found.y - 40);
      returned = true;
      await home().catch(() => (returned = false));
      note(returned, 'so does clicking the middle of it, where the smiley is');
      note(!stray, 'and it opens nothing');
    } else {
      note(false, 'so does clicking the middle of it (planet not found)');
      note(false, 'and it opens nothing (planet not found)');
    }

    // 5. The smiley is still its own destination, and pressing it does not
    //    leave the map. It is drawn on the world rather than captioned, so
    //    it has to be reached for before it can be pressed.
    await openUniverse(page);
    await page.waitForTimeout(1600);
    await page.evaluate(async () => {
      const el = document.querySelector('.u-label--mark');
      el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 15000 }).catch(() => null),
      page.locator('.u-label--mark').click(),
    ]);
    // The destination is the anchor's own href — this container has no route
    // to Notion, so what is checked is that pressing it opens a tab and that
    // the tab is aimed at the right place.
    const smileHref = (await page.locator('.u-label--mark').getAttribute('href')) ?? '';
    note(
      !!popup && /Grantmaking-OS/.test(smileHref),
      `the smiley still opens Grantmaking OS in a new tab (${
        popup ? 'opened' : 'no tab'
      }, ${smileHref.slice(0, 40)})`
    );
    await popup?.close();
    await page.waitForTimeout(600);
    note(
      (await page.evaluate(() => document.documentElement.className)).includes('universe-open'),
      'and pressing it does not leave the map'
    );
    await context.close();
  }

  // --- there is no gesture zoom any more
  {
    /**
     * The reveal used to be scrubbable with a trackpad, which made entering
     * the map feel like operating a slider and left visitors parked inside a
     * transition that only reads as cinematic when it plays. Entry and exit
     * are discrete now, and the wheel belongs to the page again.
     */
    const context = await browser.newContext({ ...CTX, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);

    const progress = () =>
      page.evaluate(
        () =>
          Number(
            getComputedStyle(document.querySelector('.hero')).getPropertyValue(
              '--universe-progress'
            )
          ) || 0
      );

    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(900);
    const afterWheel = await progress();
    note(afterWheel === 0, `wheeling on the hero opens nothing (progress ${afterWheel})`);
    note(
      (await page.evaluate(() => document.documentElement.className)) === '',
      'and leaves the page a page'
    );

    // A two-finger pinch is a browser zoom again, not a map control.
    await page.evaluate(() => {
      for (let i = 0; i < 8; i += 1) {
        window.dispatchEvent(
          new WheelEvent('wheel', { deltaY: 40, ctrlKey: true, cancelable: true, bubbles: true })
        );
      }
    });
    await page.waitForTimeout(700);
    note((await progress()) === 0, 'pinching on the hero opens nothing either');

    // The switcher does, in one move.
    await openUniverse(page);
    await page.waitForTimeout(1200);
    note((await progress()) > 0.99, 'the switcher goes all the way in, in one step');

    // And in the map the wheel changes no levels.
    await page.evaluate(() => {
      window.__levels = [];
      const el = document.querySelector('[data-universe-level]');
      new MutationObserver(() => window.__levels.push(el.textContent)).observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      for (let i = 0; i < 12; i += 1) {
        window.dispatchEvent(
          new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true })
        );
      }
    });
    await page.waitForTimeout(1200);
    const levels = await page.evaluate(() => window.__levels);
    note(levels.length === 0, `the wheel changes no levels in the map (${levels.length} changes)`);
    note(
      (await page.evaluate(() => document.querySelector('[data-universe-level]').textContent)) ===
        'Universe',
      'and the map stays where it was put'
    );
    await page.screenshot({ path: `${SHOT_DIR}/universe-held.png` });
    await context.close();
  }

  // --- entering and leaving is all controls and keys now
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);

    // Click a galaxy to fly in.
    await page.evaluate(() => document.querySelector('.u-label[data-node-id="power"]')?.click());
    await page.waitForFunction(
      () => document.querySelector('[data-universe-level]')?.textContent === 'Galaxy',
      null,
      { timeout: 30000 }
    );
    note(true, 'clicking a galaxy flies into it');

    // The Universe crumb takes you back out to the overview.
    await page.click('.u-crumb:first-child');
    await page.waitForFunction(
      () => document.querySelector('[data-universe-level]')?.textContent === 'Universe',
      null,
      { timeout: 30000 }
    );
    note(true, 'UNIVERSE returns to the overview');

    // Back to the page returns the hero.
    await page.click('[data-universe-action="exit"]');
    await page.waitForFunction(() => document.documentElement.className === '', null, {
      timeout: 30000,
    });
    note(true, 'Back to the page returns the hero');
    await context.close();
  }

  // --- labels must not flicker
  {
    /**
     * The regression this exists for: label widths were read from the DOM
     * every frame, and a hidden element measures zero — so a label that had
     * just been hidden for colliding measured narrow, stopped colliding,
     * came back, measured wide, collided, and went again. A clean two-frame
     * oscillation, every frame, for as long as you looked at it.
     *
     * Sampled at the sizes where it actually happened. 1440x900 never showed
     * it; 1280x720 and below did.
     */
    for (const [width, height] of [
      [1440, 900],
      [1280, 720],
      [1024, 640],
    ]) {
      const context = await browser.newContext({ ...CTX, viewport: { width, height } });
      const page = await context.newPage();
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await page.click('[data-universe-region="ai-safety"]');
      await page.waitForFunction(
        () => document.querySelector('[data-universe-level]')?.textContent === 'Galaxy',
        null,
        { timeout: 40000 }
      );
      // Let the flight land, so the camera is genuinely stationary.
      await page.waitForTimeout(3000);

      const result = await page.evaluate(async () => {
        const labels = [...document.querySelectorAll('.u-label--system')];
        const frames = [];
        for (let i = 0; i < 90; i += 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          frames.push(labels.map((el) => (el.hidden ? 0 : 1)));
        }
        const worst = { id: '', flips: 0 };
        let visible = 0;
        labels.forEach((el, index) => {
          const series = frames.map((frame) => frame[index]);
          let flips = 0;
          for (let f = 1; f < series.length; f += 1) if (series[f] !== series[f - 1]) flips += 1;
          if (flips > worst.flips) {
            worst.flips = flips;
            worst.id = el.dataset.nodeId;
          }
          if (series[series.length - 1]) visible += 1;
        });
        return { worst, visible, total: labels.length, frames: frames.length };
      });

      note(
        result.worst.flips === 0,
        `[${width}x${height}] system labels hold still over ${result.frames} frames` +
          (result.worst.flips ? ` (${result.worst.id} flipped ${result.worst.flips}x)` : '')
      );
      note(
        result.visible >= 6,
        `[${width}x${height}] and stay readable (${result.visible} labels up)`
      );
      await context.close();
    }
  }


  // --- labels are attached to their systems, in the densest region there is
  {
    /**
     * Culture & Play is the region where this went wrong: its dust used to
     * be generated with no knowledge of where its systems were, so the
     * bright clumps and the labelled stars were two independent scatterings.
     * Every label was correctly attached to a star sitting in a gap, and one
     * of the five could not be placed at all.
     */
    const context = await browser.newContext({ ...CTX, viewport: { width: 1919, height: 1010 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);
    await page.evaluate(() => document.querySelector('.u-label[data-node-id="culture"]')?.click());
    await page.waitForFunction(
      () => document.querySelector('[data-universe-level]')?.textContent === 'Galaxy',
      null,
      { timeout: 40000 }
    );
    await page.waitForTimeout(2600);

    const placement = await page.evaluate(() => {
      const systems = [...document.querySelectorAll('.u-label--system:not([hidden])')];
      const boxes = systems.map((el) => ({
        id: el.dataset.nodeId,
        rect: el.getBoundingClientRect(),
      }));
      let overlaps = 0;
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i].rect;
          const b = boxes[j].rect;
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
            overlaps += 1;
          }
        }
      }
      return { ids: boxes.map((b) => b.id), overlaps };
    });

    const wanted = [
      'culture-games',
      'culture-fiction',
      'culture-music',
      'culture-art',
      'culture-exploration',
    ];
    note(
      wanted.every((id) => placement.ids.includes(id)),
      `every Culture & Play system is named (${placement.ids.length}/5: ${placement.ids
        .map((id) => id.replace('culture-', ''))
        .join(', ')})`
    );
    note(placement.overlaps === 0, `and none of them collide (${placement.overlaps} overlaps)`);

    // Placement holds still in the dense region too, not only in AI Safety.
    const stable = await page.evaluate(async () => {
      const labels = [...document.querySelectorAll('.u-label--system')];
      const frames = [];
      for (let i = 0; i < 90; i += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        frames.push(labels.map((el) => (el.hidden ? 0 : 1)));
      }
      let worst = 0;
      labels.forEach((_, index) => {
        const series = frames.map((frame) => frame[index]);
        let flips = 0;
        for (let f = 1; f < series.length; f += 1) if (series[f] !== series[f - 1]) flips += 1;
        worst = Math.max(worst, flips);
      });
      return worst;
    });
    note(stable === 0, `Culture & Play labels hold still over 90 frames (${stable} flips)`);
    await page.screenshot({ path: `${SHOT_DIR}/universe-culture.png` });
    await context.close();
  }

  // --- the stationary map does no label work at all
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);
    await page.waitForTimeout(1500);

    // Writing to a label's style is the observable half of the layout pass.
    const writes = await page.evaluate(async () => {
      const el = document.querySelector('.u-label--region');
      let count = 0;
      const observer = new MutationObserver((records) => {
        count += records.length;
      });
      observer.observe(el, { attributes: true, attributeFilter: ['style', 'hidden'] });
      await new Promise((resolve) => setTimeout(resolve, 1200));
      observer.disconnect();
      return count;
    });
    note(writes === 0, `a stationary map stops touching label DOM (${writes} writes in 1.2s)`);
    await context.close();
  }

  // --- Escape during the galaxy hand-off must not leave a flight queued
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.click('[data-universe-region="ai-safety"]');
    await page.waitForFunction(
      () => document.documentElement.classList.contains('universe-open'),
      null,
      { timeout: 40000 }
    );
    // Straight into the beat the map holds before flying on.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3600);
    const after = await page.evaluate(() => document.documentElement.className);
    note(after === '', `Escape during the hand-off wins and stays won ("${after}")`);
    await context.close();
  }

  // --- resizing an open map, including across the portrait boundary
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);

    await page.setViewportSize({ width: 900, height: 1000 });
    await page.waitForTimeout(1400);
    const portrait = await page.evaluate(() => ({
      regions: document.querySelectorAll('.u-label--region:not([hidden])').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    note(
      portrait.regions >= 4 && portrait.overflow <= 1,
      `resizing into portrait keeps the map whole (${portrait.regions} regions)`
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1400);
    const back = await page.evaluate(
      () => document.querySelectorAll('.u-label--region:not([hidden])').length
    );
    note(back === 5, `and resizing back restores all five (${back})`);
    note(errors.length === 0, `resizing raises no errors (${errors.join('; ').slice(0, 120)})`);
    await context.close();
  }

  // --- the two entries are interchangeable at any depth
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.click('[data-universe-region="ai-safety"]');
    await page.waitForFunction(
      () => document.querySelector('[data-universe-level]')?.textContent === 'Galaxy',
      null,
      { timeout: 40000 }
    );
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3200);
    await page.click('[data-universe-open]:not([data-universe-region])');
    await page.waitForFunction(
      () => document.documentElement.classList.contains('universe-open'),
      null,
      { timeout: 40000 }
    );
    await page.waitForTimeout(900);
    const level = await page.evaluate(
      () => document.querySelector('[data-universe-level]').textContent
    );
    note(level === 'Universe', `leaving a galaxy and re-entering by Universe lands there (${level})`);
    await context.close();
  }

  // --- every program is compiled before the transition, not during it
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__gl = { link: 0, query: 0, phase: 'boot', during: 0 };
      const proto = WebGL2RenderingContext.prototype;
      const link = proto.linkProgram;
      proto.linkProgram = function (...args) {
        window.__gl.link += 1;
        if (window.__gl.phase === 'open') window.__gl.during += 1;
        return link.apply(this, args);
      };
      const query = proto.getProgramParameter;
      proto.getProgramParameter = function (...args) {
        window.__gl.query += 1;
        if (window.__gl.phase === 'open') window.__gl.during += 1;
        return query.apply(this, args);
      };
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.hover('[data-universe-open]:not([data-universe-region])');
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      window.__gl.phase = 'open';
    });
    await openUniverse(page);
    await page.waitForTimeout(1500);
    const gl = await page.evaluate(() => window.__gl);
    note(
      gl.link > 0 && gl.during === 0,
      `shaders link before the transition, not during it (${gl.link} linked, ${gl.during} during)`
    );
    await context.close();
  }

  // --- keyboard-only operation
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);

    await page.keyboard.press('+');
    await page.waitForTimeout(1500);
    const zoomed = await page.evaluate(
      () => document.querySelector('[data-universe-level]').textContent
    );
    note(zoomed === 'Galaxy', `"+" zooms in one level (${zoomed})`);

    await page.keyboard.press('-');
    await page.waitForTimeout(1500);
    const out = await page.evaluate(
      () => document.querySelector('[data-universe-level]').textContent
    );
    note(out === 'Universe', `"-" zooms out one level (${out})`);

    const reachable = await page.evaluate(
      () => [...document.querySelectorAll('.u-label')].filter((el) => el.tabIndex === 0).length
    );
    note(reachable >= 5, `map labels are in the tab order (${reachable})`);
    await context.close();
  }

  // --- reduced motion: no flight, no streaks, still a map
  {
    const context = await browser.newContext({
      ...CTX,
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);
    const regions = await page.$$eval('.u-label--region:not([hidden])', (els) => els.length);
    note(regions === 5, `reduced motion still resolves the map (${regions} regions)`);
    await page.screenshot({ path: `${SHOT_DIR}/universe-reduced-motion.png` });
    await context.close();
  }

  // --- phone
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await openUniverse(page);
    const phone = await page.evaluate(() => ({
      regions: document.querySelectorAll('.u-label--region:not([hidden])').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls: document.querySelectorAll('[data-universe-action]').length,
    }));
    note(phone.regions >= 4, `phone shows the composition (${phone.regions} regions)`);
    note(phone.overflow <= 1, `phone has no horizontal overflow (${phone.overflow}px)`);
    note(phone.controls === 4, `phone keeps visible zoom controls (${phone.controls})`);

    // Every label is measured before it is placed, and the renderer is built
    // ahead of time inside a hidden overlay where nothing has a size — so a
    // first measurement there reads zero for everything, and a fallback
    // width is what then decides both collisions and this nudge.
    const spill = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.u-label:not([hidden])')) {
        const rect = el.getBoundingClientRect();
        if (rect.left < -1 || rect.right > window.innerWidth + 1) {
          out.push(`${el.dataset.nodeId} ${Math.round(rect.left)}..${Math.round(rect.right)}`);
        }
      }
      return out;
    });
    note(spill.length === 0, `and keeps every label on screen (${spill.join(', ') || 'all inside'})`);
    await page.screenshot({ path: `${SHOT_DIR}/universe-phone.png` });
    await context.close();
  }

  // --- no WebGL: the map becomes a document
  {
    const context = await browser.newContext({ ...CTX, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (typeof type === 'string' && type.startsWith('webgl')) return null;
        return original.call(this, type, ...rest);
      };
      delete window.WebGLRenderingContext;
    });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    // No click: the renderer module is prefetched on idle, finds no WebGL,
    // and switches the page over on its own — including hiding the control
    // that would otherwise promise something it cannot deliver.
    await page.waitForFunction(
      () => document.documentElement.classList.contains('universe-unsupported'),
      null,
      { timeout: 30000 }
    );
    const fallback = await page.evaluate(() => {
      const index = document.querySelector('.universe-index');
      return {
        inert: index.inert,
        visible: index.getBoundingClientRect().height > 200,
        destinations: index.querySelectorAll('a').length,
        launcherHidden: getComputedStyle(document.querySelector('.art-switcher')).display,
        heroIntact: getComputedStyle(document.querySelector('.hero__stage')).opacity,
      };
    });
    note(!fallback.inert && fallback.visible, 'without WebGL the text index becomes the map');
    note(fallback.destinations >= 1, `fallback keeps real destinations (${fallback.destinations})`);
    note(
      fallback.launcherHidden === 'none',
      'fallback hides entries that cannot be entered'
    );
    note(fallback.heroIntact === '1', 'fallback leaves the hero alone');
    await page.screenshot({ path: `${SHOT_DIR}/universe-no-webgl.png`, fullPage: true });
    await context.close();
  }
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
