// The offline test below runs a throwaway HTTP proxy, and the Word-export test
// reads a zip. Both use the Node standard library, whose declarations arrive
// with the @types/node devDependency; before it was declared these imports were
// suppressed and the shapes they touch were hand-written here.
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';

// A .docx is a zip, and the assertion worth making about one is what its
// document part says. Reading it takes a zip reader, and adding a dependency to
// get one would be a heavier change than the twenty lines the central directory
// needs: find the end-of-central-directory record, walk the entries, and
// inflate the one asked for. Stored (method 0) and deflated (method 8) are the
// only methods a docx uses.
function readZipEntry(zip: Buffer, name: string): string {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const compressedSize = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const entryName = zip.toString('utf8', p + 46, p + 46 + nameLen);
    if (entryName === name) {
      const lNameLen = zip.readUInt16LE(localOffset + 26);
      const lExtraLen = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const body = zip.subarray(start, start + compressedSize);
      return (method === 0 ? body : inflateRawSync(body)).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`no ${name} in the archive`);
}

type OfflineProxy = {
  /** Point the browser here, not at baseURL. */
  origin: string;
  /** Destroy every socket from now on: real network death for page and worker. */
  cut: () => void;
  /** Destroy only requests for the wasm binary. */
  blockWasm: () => void;
  /** Paths the proxy has received since the last forget(). */
  seen: () => string[];
  forget: () => void;
  close: () => Promise<void>;
};

// Measured 2026-08-14: context.setOffline(true) does not cut a service worker's
// own network, so requests the worker forwards still reach the server and an
// "offline" test built on it proves nothing. Front the preview server with a
// throwaway proxy instead, which this process can kill under both page and
// worker. It also logs what it forwards, which is how the online control proves
// a navigation actually reached the server rather than the cache.
async function startOfflineProxy(baseURL: string): Promise<OfflineProxy> {
  let cut = false;
  let blockWasm = false;
  let seen: string[] = [];
  const proxy = createServer((req: IncomingMessage, res: ServerResponse) => {
    seen.push(req.url ?? '/');
    if (cut || (blockWasm && req.url?.endsWith('.wasm'))) return req.socket?.destroy();
    const upstream = request(
      baseURL + (req.url ?? '/'),
      { method: req.method, headers: req.headers },
      (response: IncomingMessage) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      }
    );
    upstream.on('error', () => res.socket?.destroy());
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => proxy.listen(0, resolve));
  return {
    origin: `http://localhost:${(proxy.address() as { port: number }).port}`,
    cut: () => {
      cut = true;
    },
    blockWasm: () => {
      blockWasm = true;
    },
    seen: () => seen,
    forget: () => {
      seen = [];
    },
    close: () => new Promise<void>((resolve) => proxy.close(() => resolve()))
  };
}

// The worker precaches every route by explicit fetch on install, so this is how
// a test waits for that to finish rather than guessing with a timeout.
async function waitForPrecachedRoute(page: Page, pathname: string) {
  await expect
    .poll(
      () =>
        page.evaluate(async (path) => {
          for (const key of await caches.keys()) {
            const cache = await caches.open(key);
            for (const req of await cache.keys()) if (new URL(req.url).pathname === path) return true;
          }
          return false;
        }, pathname),
      { timeout: 30_000 }
    )
    .toBe(true);
}

// Defense in depth for the phantom-user incident: even if the app-level
// hostname gate ever regresses, no test traffic may reach third-party
// analytics. Blocked at the network layer for every test.
test.beforeEach(async ({ context }) => {
  await context.route(/googletagmanager|google-analytics|analytics\.google/, (route) => route.abort());
});

test.describe('navigation and route gating', () => {
  test('homepage has HCM Calculator in the title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/HCM Calculator/);
  });

  test('released chapter routes stay put', async ({ page }) => {
    await page.goto('/hcm10');
    await expect(page).toHaveURL(/\/hcm10$/);
    await page.goto('/hcm11');
    await expect(page).toHaveURL(/\/hcm11$/);
    await page.goto('/hcm12');
    await expect(page).toHaveURL(/\/hcm12$/);
    await page.goto('/hcm12ml');
    await expect(page).toHaveURL(/\/hcm12ml$/);
    await page.goto('/hcm13');
    await expect(page).toHaveURL(/\/hcm13$/);
    await page.goto('/hcm14');
    await expect(page).toHaveURL(/\/hcm14$/);
    await page.goto('/hcm15');
    await expect(page).toHaveURL(/\/hcm15$/);
    await page.goto('/hcm16');
    await expect(page).toHaveURL(/\/hcm16$/);
    await page.goto('/hcm17');
    await expect(page).toHaveURL(/\/hcm17$/);
    await page.goto('/hcm18');
    await expect(page).toHaveURL(/\/hcm18$/);
    await page.goto('/hcm19');
    await expect(page).toHaveURL(/\/hcm19$/);
    await page.goto('/hcm20');
    await expect(page).toHaveURL(/\/hcm20$/);
    await page.goto('/hcm21');
    await expect(page).toHaveURL(/\/hcm21$/);
    await page.goto('/hcm22');
    await expect(page).toHaveURL(/\/hcm22$/);
    await page.goto('/hcm23');
    await expect(page).toHaveURL(/\/hcm23$/);
    await page.goto('/hcm24');
    await expect(page).toHaveURL(/\/hcm24$/);
  });

  test('desktop shows the horizontal menu, phones get the hamburger', async ({ page }) => {
    // Regression guard for the Tailwind v4 import-order bug that silently
    // stopped emitting responsive utilities: assert VISIBILITY, not presence.
    await page.goto('/');
    await expect(page.locator('.navbar-center')).toBeVisible();
    await expect(page.locator('.navbar-start .dropdown [role="button"]')).toBeHidden();

    await page.setViewportSize({ width: 500, height: 800 });
    await expect(page.locator('.navbar-center')).toBeHidden();
    await expect(page.locator('.navbar-start .dropdown [role="button"]')).toBeVisible();
  });

  test('printing always uses the light palette', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.emulateMedia({ media: 'print' });
    const pavement = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--diag-pavement').trim()
    );
    expect(pavement).toBe('#e2e8f0');
  });

  test('the wasm engine is precached and computes with the network gone', async ({ browser, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'service worker test runs on chromium');
    test.slow(); // three navigations plus a worker install

    if (!baseURL) throw new Error('the offline proxy needs a baseURL to forward to');
    const proxy = await startOfflineProxy(baseURL);
    const origin = proxy.origin;

    // A fresh origin, so nothing is cached from earlier tests. The analytics
    // block from beforeEach applies to the default context only, so repeat it.
    const context = await browser.newContext();
    await context.route(/googletagmanager|google-analytics|analytics\.google/, (route) => route.abort());
    try {
      const page = await context.newPage();
      // /terms never loads the engine, so the wasm binary can only be in the
      // cache if the worker precached it on install.
      await page.goto(`${origin}/terms`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await expect
        .poll(
          () =>
            page.evaluate(async () => {
              const found: string[] = [];
              for (const key of await caches.keys()) {
                const cache = await caches.open(key);
                for (const req of await cache.keys()) {
                  if (req.url.endsWith('.wasm')) found.push(new URL(req.url).pathname);
                }
              }
              return found;
            }),
          { timeout: 20_000 }
        )
        .toEqual([expect.stringMatching(/\.wasm$/)]);

      // From here the binary is unreachable, so a chapter page can only get an
      // engine from the cache.
      proxy.blockWasm();
      await page.goto(`${origin}/hcm14`);
      await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });

      proxy.cut();
      // Control: the cut is real. A POST returns early from the worker's fetch
      // handler, so this is the page talking to the network directly.
      const reachable = await page.evaluate(async (base) => {
        try {
          const res = await fetch(`${base}/__offline_probe`, { method: 'POST' });
          return `status ${res.status}`;
        } catch (err) {
          return `blocked ${(err as Error).name}`;
        }
      }, origin);
      expect(reachable).toMatch(/^blocked/);

      await page.reload();
      const calculate = page.getByRole('button', { name: 'Calculate' });
      await expect(calculate).toBeEnabled({ timeout: 30_000 });
      await calculate.click();
      await expect(page.getByText(/Segment LOS: [A-F]/)).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test('a never-visited chapter page opens with the network gone', async ({ browser, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'service worker test runs on chromium');
    test.slow(); // an install that fetches every route, then a navigation

    // Nothing here is prerendered, so page HTML exists only if the worker
    // fetched it on install. This visitor sees the home page and nothing else
    // before the network dies, which before the app-shell precache produced a
    // failed navigation rather than a page.
    if (!baseURL) throw new Error('the offline proxy needs a baseURL to forward to');
    const proxy = await startOfflineProxy(baseURL);
    const context = await browser.newContext();
    await context.route(/googletagmanager|google-analytics|analytics\.google/, (route) => route.abort());
    try {
      const page = await context.newPage();
      await page.goto(`${proxy.origin}/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await waitForPrecachedRoute(page, '/hcm14');

      proxy.cut();
      // Control: the cut is real. A POST returns early from the worker's fetch
      // handler, so this is the page talking to the network directly.
      const reachable = await page.evaluate(async (base) => {
        try {
          const res = await fetch(`${base}/__offline_probe`, { method: 'POST' });
          return `status ${res.status}`;
        } catch (err) {
          return `blocked ${(err as Error).name}`;
        }
      }, proxy.origin);
      expect(reachable).toMatch(/^blocked/);

      await page.goto(`${proxy.origin}/hcm14`);
      await expect(page).toHaveURL(/\/hcm14$/); // the shell fallback would land on /
      const calculate = page.getByRole('button', { name: 'Calculate' });
      await expect(calculate).toBeEnabled({ timeout: 30_000 });
      await calculate.click();
      await expect(page.getByText(/Segment LOS: [A-F]/)).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test('a visited chapter page survives a reload with the network gone', async ({ browser, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'service worker test runs on chromium');
    test.slow();

    if (!baseURL) throw new Error('the offline proxy needs a baseURL to forward to');
    const proxy = await startOfflineProxy(baseURL);
    const context = await browser.newContext();
    await context.route(/googletagmanager|google-analytics|analytics\.google/, (route) => route.abort());
    try {
      const page = await context.newPage();
      await page.goto(`${proxy.origin}/hcm13`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await waitForPrecachedRoute(page, '/hcm13');

      proxy.cut();
      await page.reload();
      await expect(page).toHaveURL(/\/hcm13$/);
      const calculate = page.getByRole('button', { name: 'Calculate' });
      await expect(calculate).toBeEnabled({ timeout: 30_000 });
      await calculate.click();
      await expect(page.getByText(/Segment LOS: [A-F]/)).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test('an online navigation is still served by the network, not the precache', async ({ browser, browserName, baseURL }) => {
    test.skip(browserName !== 'chromium', 'service worker test runs on chromium');
    test.slow();

    // The point of the precache is offline reach, not speed. Serving a page
    // from it while the network is up would pin every visitor to the HTML
    // rendered at install time, so the fetch handler must stay network-first
    // and this asserts it at the transport: the proxy has to see the request.
    if (!baseURL) throw new Error('the offline proxy needs a baseURL to forward to');
    const proxy = await startOfflineProxy(baseURL);
    const context = await browser.newContext();
    await context.route(/googletagmanager|google-analytics|analytics\.google/, (route) => route.abort());
    try {
      const page = await context.newPage();
      await page.goto(`${proxy.origin}/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await waitForPrecachedRoute(page, '/hcm15');

      // Forget the install's own fetches, so what follows can only be the
      // navigation.
      proxy.forget();
      await page.goto(`${proxy.origin}/hcm15`);
      await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
      expect(proxy.seen()).toContain('/hcm15');
    } finally {
      await context.close();
      await proxy.close();
    }
  });

  test('nav lists every released chapter', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.navbar-center');
    await expect(nav.locator('a[href="/hcm10"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm11"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm12"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm12ml"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm13"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm14"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm15"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm16"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm17"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm18"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm19"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm20"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm21"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm22"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm23"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm24"]')).toHaveCount(1);
  });

  test('the consent banner gates analytics and remembers the choice', async ({ page }) => {
    // The banner only appears where analytics is eligible; the debug flag
    // simulates the production hostname from localhost.
    await page.addInitScript(() => localStorage.setItem('hcm-consent-debug', '1'));
    await page.goto('/');
    const banner = page.locator('.consent-banner');
    await expect(banner).toBeVisible();

    await banner.getByRole('button', { name: 'Decline' }).click();
    await expect(banner).toHaveCount(0);

    // The choice persists across reloads.
    await page.reload();
    await expect(page.locator('.consent-banner')).toHaveCount(0);

    // Accept path: banner reappears when unset, accepting dismisses it.
    await page.evaluate(() => localStorage.removeItem('hcm-analytics-consent'));
    await page.reload();
    await expect(page.locator('.consent-banner')).toBeVisible();
    await page.locator('.consent-banner').getByRole('button', { name: 'Accept analytics' }).click();
    await expect(page.locator('.consent-banner')).toHaveCount(0);
  });

  test('terms page states the personal, no-revenue scope', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('.page-title')).toHaveText(/Terms/);
    await expect(page.getByText('independent, personal work')).toBeVisible();
    await expect(page.getByText('no sale or')).toBeVisible();
    await expect(page.getByText('hcm-calculator.com', { exact: false }).first()).toBeVisible();
  });

  test('analytics never loads from localhost', async ({ page }) => {
    // Guard for the phantom-user incident: automation traffic must not reach
    // Google Analytics. The tag only injects on the production hostname.
    const hits = [];
    page.on('request', (r) => {
      if (r.url().includes('googletagmanager') || r.url().includes('google-analytics')) hits.push(r.url());
    });
    await page.goto('/');
    await page.goto('/hcm22');
    await page.waitForTimeout(1500);
    expect(hits).toHaveLength(0);
  });

  test('the theme toggle flips to dark and persists across reloads', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.locator('.nav-theme-toggle').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // The inline script in app.html applies the saved theme before hydration.
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.locator('.nav-theme-toggle').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('unreleased chapter routes redirect home', async ({ page }) => {
    // Nothing is gated any more: hcm12ml was the last route outside the RELEASED
    // set of src/routes/+layout.js. The gate itself still has to work, so this
    // asserts it against a chapter route that does not exist at all. The load
    // function's /^\/hcm[0-9a-z]+$/i test matches /hcm99 and the RELEASED set does
    // not contain it, so the redirect is what proves the gate is still wired up
    // rather than silently passing everything through. Add a real gated route
    // here in place of /hcm99 the next time one exists.
    await page.goto('/hcm99');
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('pre-hydration input guard', () => {
  // Every calculator page server-renders a fully painted form whose fields
  // already hold their defaults, and each field only becomes a real binding
  // once onMount finishes loading the wasm module. Typing into that window
  // wrote into a DOM the framework had not adopted yet, and on webkit the edit
  // combined with the server-rendered value rather than replacing it, so a
  // field seeded with 2000 could end up holding 20003800 and the analysis ran
  // on twenty million veh/h without throwing anything.
  //
  // The specs in this file have always gated on Calculate being enabled, so
  // they never saw it. Users have no such gate. Each page's form now carries
  // inert={!ready}, which makes the whole subtree unfocusable and uneditable
  // until hydration and costs no visual change.
  //
  // A warm preview server hydrates faster than a fill can land, which is why
  // this delays the JS responses: that is the condition the bug needs, a slow
  // connection where the form is painted long before it is live.
  for (const [route, field, seeded] of [
    ['/hcm12ml', '#GPDEMAND_input', '2000'],
    ['/hcm19', '#PHF_input', '0.92'],
  ] as const) {
    test(`${route} refuses edits until hydration`, async ({ page }) => {
      await page.route('**/*.js', async (route_) => {
        await new Promise((r) => setTimeout(r, 2500));
        await route_.continue();
      });
      await page.goto(route, { waitUntil: 'commit' });

      const input = page.locator(field);
      await expect(input).toHaveValue(seeded); // painted, not yet live
      await expect(page.locator('form[inert]')).toHaveCount(1);

      // The fill is attempted with no readiness gate, the way a user types.
      // It must not land, so the field still holds exactly its default.
      await input.fill('3800', { timeout: 3000 }).catch(() => { /* refused is also a pass */ });
      await expect(input).toHaveValue(seeded);

      // And the guard must actually lift, or it would be a very effective way
      // of breaking every page.
      await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
      await expect(page.locator('form[inert]')).toHaveCount(0);
      await input.fill('3800');
      await expect(input).toHaveValue('3800');
    });
  }
});

test.describe('chapter 10 freeway facilities calculator', () => {
  // Cell order in the segment table: 0 #, 1 type select, 2 length, 3 lanes,
  // 4 on-ramp demand, 5 off-ramp demand, 6 ramp FFS, 7 accel, 8 decel.
  async function setSegment(page, index, seg) {
    const row = page.locator('.seg-table tbody tr').nth(index);
    await row.locator('select').selectOption(seg.type);
    await row.locator('td').nth(2).locator('input').fill(seg.len);
    await row.locator('td').nth(3).locator('input').fill(seg.lanes);
    if (seg.on) await row.locator('td').nth(4).locator('input').fill(seg.on);
    if (seg.off) await row.locator('td').nth(5).locator('input').fill(seg.off);
  }

  test('reproduces the published undersaturated facility example problem', async ({ page }) => {
    // HCM Chapter 25, Example Problem 1: 6-mi urban freeway, 11 segments, five
    // 15-min periods. Published facility performance (Exhibit 25-52):
    // 57.6/27.5 D, 56.6/31.3 D, 55.0/34.8 E, 57.9/27.5 D, 58.4/21.4 C;
    // overall 56.9 mi/h at 28.4 veh/mi/ln (the engine prints 28.5, within the
    // book's rounding). The library integration suite asserts all 55 cells of
    // the speed, density, and LOS matrices for this fixture.
    await page.goto('/hcm10');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FFS_input').fill('60');
    await page.locator('#HV_input').fill('2.25');
    await page.locator('#PHF_input').fill('1.0');
    await page.locator('#ID_input').fill('0.8');
    await page.locator('#DEMAND_input').fill('4505, 4955, 5225, 4685, 3785');

    // The form starts with 3 segment rows; EP1 has 11.
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: '+ Add Segment' }).click();
    }

    await setSegment(page, 0, { type: 'Basic', len: '5280', lanes: '3' });
    await setSegment(page, 1, { type: 'Merge', len: '1500', lanes: '3', on: '450, 540, 630, 360, 180' });
    await setSegment(page, 2, { type: 'Basic', len: '2280', lanes: '3' });
    await setSegment(page, 3, { type: 'Diverge', len: '1500', lanes: '3', off: '270, 360, 270, 270, 270' });
    await setSegment(page, 4, { type: 'Basic', len: '5280', lanes: '3' });
    await setSegment(page, 5, { type: 'Weaving', len: '2640', lanes: '4', on: '540, 720, 810, 360, 270', off: '360, 360, 360, 360, 180' });
    await setSegment(page, 6, { type: 'Basic', len: '5280', lanes: '3' });
    await setSegment(page, 7, { type: 'Merge', len: '1140', lanes: '3', on: '450, 540, 630, 450, 270' });
    await setSegment(page, 8, { type: 'OverlappingRamp', len: '360', lanes: '3' });
    await setSegment(page, 9, { type: 'Diverge', len: '1140', lanes: '3', off: '270, 270, 450, 270, 180' });
    await setSegment(page, 10, { type: 'Basic', len: '5280', lanes: '3' });

    // Weaving details subtable for segment 6.
    await page.locator('#SL_input6').fill('1640');
    await page.locator('#NWL_input6').fill('2');
    await page.locator('#LCRF_input6').fill('1');
    await page.locator('#LCFR_input6').fill('1');
    await page.locator('#RR_input6').fill('50, 100, 150, 80, 50');

    await calculate.click();

    // Facility LOS by period, Exhibit 25-52: D D E D C.
    const losRow = page.locator('tr', { has: page.getByText('Facility LOS:') }).first();
    await expect(losRow.locator('td')).toHaveText(['D', 'D', 'E', 'D', 'C']);

    await expect(page.getByText('Facility Length: 6.00 mi')).toBeVisible();
    await expect(page.getByText('Overall Space Mean Speed: 56.9 mi/hr')).toBeVisible();
    await expect(page.getByText('Overall Density: 28.5 veh/mi/ln')).toBeVisible();
    await expect(page.getByText(/Oversaturated: No/)).toBeVisible();
  });

  test('facility builder diagram colors segments by per-period LOS and syncs selection', async ({ page }) => {
    await page.goto('/hcm10');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    // Geometry mode before a run: three default segments, no period chips.
    const diagram = page.locator('.fd-diagram');
    await expect(diagram.locator('.fd-seg')).toHaveCount(3);
    await expect(diagram.locator('.fd-chip')).toHaveCount(0);
    await expect(diagram.getByText(/press Calculate/)).toBeVisible();

    // Adding a segment extends the chain reactively.
    await page.getByRole('button', { name: '+ Add Segment' }).click();
    await expect(diagram.locator('.fd-seg')).toHaveCount(4);
    await page.getByRole('button', { name: 'Remove' }).click();

    await calculate.click();

    // Four demand values give four period chips, and every mainline rect
    // carries a concrete LOS fill instead of the pavement token.
    await expect(diagram.locator('.fd-chip')).toHaveCount(4);
    const firstRect = diagram.locator('.fd-main').first();
    await expect(firstRect).toHaveAttribute('fill', /^#/);
    await expect(diagram.locator('.fd-los')).toHaveCount(3);

    // Switching the period keeps the chain scored.
    await diagram.locator('.fd-chip', { hasText: 'P3' }).click();
    await expect(firstRect).toHaveAttribute('fill', /^#/);

    // Clicking a diagram segment highlights the matching table row.
    await diagram.locator('.fd-seg').nth(1).click();
    await expect(page.locator('.seg-table tbody tr').nth(1)).toHaveClass(/seg-selected/);

    // The 3D ribbon shares the toggle and the period chips, and tapping a
    // slab selects it there too (a tap, not a drag, so the camera keeps
    // rotate gestures).
    await page.getByRole('button', { name: '3D' }).click();
    await expect(page.locator('.fd3-chip')).toHaveCount(4);
    const decks = page.locator('path.fd3-deck');
    await decks.first().click({ force: true });
    await expect(decks.first()).toHaveClass(/selected/);
    await expect(page.locator('.seg-table tbody tr').first()).toHaveClass(/seg-selected/);
  });

  // Example Problems 4 and 5 run on the same 11-segment chain as Example
  // Problem 1, differing only in the ramp demands, the Segment 11 cross
  // section, and what is attached to it. Mirrors the construction in
  // tests/boundary/ch10_freeway_facilities.mjs.
  async function buildEp1Chain(page: Page, opts: Record<string, string>) {
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: '+ Add Segment' }).click();
    }
    await setSegment(page, 0, { type: 'Basic', len: '5280', lanes: '3' });
    await setSegment(page, 1, { type: 'Merge', len: '1500', lanes: '3', on: opts.on2 });
    await setSegment(page, 2, { type: 'Basic', len: '2280', lanes: '3' });
    await setSegment(page, 3, { type: 'Diverge', len: '1500', lanes: '3', off: opts.off4 });
    await setSegment(page, 4, { type: 'Basic', len: '5280', lanes: '3' });
    await setSegment(page, 5, { type: 'Weaving', len: '2640', lanes: '4', on: opts.on6, off: opts.off6 });
    await setSegment(page, 6, { type: 'Basic', len: '5280', lanes: '3' });
    await setSegment(page, 7, { type: 'Merge', len: '1140', lanes: '3', on: opts.on8 });
    await setSegment(page, 8, { type: 'OverlappingRamp', len: '360', lanes: '3' });
    await setSegment(page, 9, { type: 'Diverge', len: '1140', lanes: '3', off: opts.off10 });
    await setSegment(page, 10, { type: 'Basic', len: '5280', lanes: opts.lanes11 });

    await page.locator('#SL_input6').fill('1640');
    await page.locator('#NWL_input6').fill('2');
    await page.locator('#LCRF_input6').fill('1');
    await page.locator('#LCFR_input6').fill('1');
    await page.locator('#RR_input6').fill(opts.rr6);
  }

  test('a segment work zone moves the published Example Problem 4 capacity and v/c', async ({ page }) => {
    // HCM Chapter 25, Example Problem 4: the Example Problem 1 facility with
    // Segment 11 reduced to two open lanes behind plastic drums (the
    // work_zone object of the library fixture case4.json). Exhibit 25-72
    // publishes the Segment 11 period-1 demand-to-capacity ratio as 1.26.
    //
    // The control matters more than the pinned value here. Without the work
    // zone the same two-lane cross section gives 1.12 at the unadjusted 4,499
    // veh/h, which is exactly the tell the boundary suite pinned while
    // set_work_zone was unbound. Asserting both proves the panel is what
    // moves the number, not the lane count.
    await page.goto('/hcm10');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FFS_input').fill('60');
    await page.locator('#HV_input').fill('2.25');
    await page.locator('#PHF_input').fill('1.0');
    await page.locator('#ID_input').fill('0.8');
    await page.locator('#DEMAND_input').fill('4505, 4955, 5225, 4685, 3785');

    await buildEp1Chain(page, {
      on2: '450, 540, 630, 360, 180', off4: '270, 360, 270, 270, 270',
      on6: '540, 720, 810, 360, 270', off6: '360, 360, 360, 360, 180',
      on8: '450, 540, 630, 450, 270', off10: '270, 270, 450, 270, 180',
      rr6: '50, 100, 150, 80, 50', lanes11: '2',
    });

    // Control: the two-lane Segment 11 with no work zone attached.
    await calculate.click();
    const capRow = () => page.locator('.cap-table tbody tr').nth(10);
    await expect(capRow()).toContainText('4499 (v/c 1.12)');

    // Nothing on the strip claims a closure yet.
    const diagram = page.locator('.fd-diagram');
    await expect(diagram.locator('.fd-wz')).toHaveCount(0);
    await expect(diagram.locator('[data-testid="wz-chip"]')).toHaveCount(0);

    // Opening the panel places the Example Problem 4 closure, and the panel
    // shows the values it placed rather than leaving them implicit.
    await page.locator('.seg-table tbody tr').nth(10)
      .getByRole('button', { name: '+ Add work zone' }).click();
    await expect(page.locator('#WZTL_input11')).toHaveValue('3');
    await expect(page.locator('#WZOL_input11')).toHaveValue('2');
    await expect(page.locator('#WZSL_input11')).toHaveValue('55');
    await expect(page.locator('#WZQDD_input11')).toHaveValue('13.1');
    await expect(page.locator('#WZLAT_input11')).toHaveValue('0');

    // The closure appears on the strip from the same form state, before any
    // run: one closed lane of hatched pavement on Segment 11 alone, in the
    // cone-and-drum stripe because Example Problem 4 is a soft barrier.
    await expect(diagram.locator('.fd-wz')).toHaveCount(1);
    await expect(diagram.locator('.fd-wz-hatch')).toHaveAttribute('fill', 'url(#fdWzSoft)');
    await expect(diagram.locator('[data-testid="wz-chip"]')).toHaveText('WZ 3→2');
    await expect(diagram.locator('[data-testid="wz-chip"]')).not.toHaveClass(/mismatch/);

    // The band that carries traffic is the two open lanes, one lane shallower
    // than the three-lane Segment 10 beside it, and the closed lane is drawn
    // outside it rather than inside. Heights, not pixels: LANE is 10.
    const seg11 = diagram.locator('.fd-seg').nth(10);
    await expect(seg11).toHaveAttribute('data-wz-open', '2');
    await expect(seg11).toHaveAttribute('data-wz-closed', '1');
    await expect(diagram.locator('.fd-main').nth(10)).toHaveAttribute('height', '20');
    await expect(diagram.locator('.fd-main').nth(9)).toHaveAttribute('height', '30');
    await expect(diagram.locator('.fd-wz')).toHaveAttribute('height', '10');

    await calculate.click();

    // Exhibit 25-72 publishes 1.26, against the post-CAF_wz capacity of
    // 4,499 x 0.892 (Equation 10-11).
    await expect(capRow()).toContainText('4014 (v/c 1.26)');
    await expect(capRow()).toContainText('Segment 11 (work zone)');

    // The work zone drives the facility oversaturated, which Example
    // Problem 4 is the demonstration of.
    await expect(page.getByText(/Oversaturated: Yes/)).toBeVisible();

    // The 3D view extrudes the same closure as its own deck beside the
    // narrowed mainline.
    await page.getByRole('button', { name: '3D' }).click();
    await expect(page.locator('path.fd3-wz')).toHaveCount(1);
    await expect(page.locator('path.fd3-wz-hatch')).toHaveAttribute('fill', 'url(#fd3WzSoft)');
    await page.getByRole('button', { name: '2D' }).click();

    // The seed derives from the segment's own lane coding (lanes = the OPEN
    // count during a closure), so adding a work zone on three-lane Segment 1
    // seeds a consistent four-to-three closure with no mismatch flag.
    await page.locator('.seg-table tbody tr').nth(0)
      .getByRole('button', { name: '+ Add work zone' }).click();
    const chip1 = diagram.locator('[data-testid="wz-chip"]').first();
    await expect(chip1).toHaveText('WZ 4→3');
    await expect(chip1).not.toHaveClass(/mismatch/);
    // A deliberate inconsistency still gets flagged rather than silently
    // drawn one way or the other: the mismatch condition is open lanes
    // differing from the segment's coded lanes (which is what the run uses),
    // so set open to 2 on the 3-lane segment.
    await page.locator('#WZOL_input1').fill('2');
    await expect(chip1).toHaveText('WZ 4→2 !');
    await expect(chip1).toHaveClass(/mismatch/);
    await page.locator('.seg-table tbody tr').nth(0)
      .getByRole('button', { name: 'Remove work zone' }).click();

    // Removing it restores the unadjusted capacity, so the panel is not a
    // one-way door and set_work_zone is genuinely conditional.
    await page.locator('.seg-table tbody tr').nth(10)
      .getByRole('button', { name: 'Remove work zone' }).click();
    await calculate.click();
    await expect(capRow()).toContainText('4499 (v/c 1.12)');

    // And the strip drops the closure with it.
    await expect(diagram.locator('.fd-wz')).toHaveCount(0);
    await expect(diagram.locator('[data-testid="wz-chip"]')).toHaveCount(0);
    await page.getByRole('button', { name: '3D' }).click();
    await expect(page.locator('path.fd3-wz')).toHaveCount(0);
  });

  test('the printable report carries the facility strip with its closure', async ({ page }) => {
    await page.goto('/hcm10');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    // Two open lanes behind a three-to-two closure, the coding the engine
    // reads, on the default three-segment facility.
    await page.locator('.seg-table tbody tr').nth(0).locator('td').nth(3).locator('input').fill('2');
    await page.locator('.seg-table tbody tr').nth(0)
      .getByRole('button', { name: '+ Add work zone' }).click();
    await calculate.click();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page).toHaveURL(/\/report$/);
    // The report reuses the 2D component, so the closure comes with it.
    const strip = page.locator('.report-diagram .fd-diagram');
    await expect(strip.locator('.fd-wz')).toHaveCount(1);
    await expect(strip.locator('[data-testid="wz-chip"]')).toHaveText('WZ 3→2');
    await expect(page.locator('.report-diagram')).toContainText('closed by the work zone on segment 1');
  });

  test('the managed lane mode reproduces the published Example Problem 5 lane groups', async ({ page }) => {
    // HCM Chapter 25, Example Problem 5 (fixture ml_case1.json): the Example
    // Problem 1 chain carrying a one-lane continuous-access managed lane its
    // whole length. Exhibit 25-87 publishes facility LOS C D D C C and
    // Exhibit 25-81 the uniform ML capacity of 1,614 veh/h.
    await page.goto('/hcm10');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FFS_input').fill('60');
    await page.locator('#HV_input').fill('2.25');
    await page.locator('#PHF_input').fill('1.0');
    await page.locator('#ID_input').fill('0.8');
    await page.locator('#DEMAND_input').fill('4001, 4400, 4640, 4160, 3361');

    await buildEp1Chain(page, {
      on2: '500, 599, 699, 400, 200', off4: '300, 400, 300, 300, 300',
      on6: '599, 799, 899, 400, 300', off6: '400, 400, 400, 400, 200',
      on8: '500, 599, 699, 500, 300', off10: '300, 300, 500, 300, 200',
      rr6: '56, 111, 167, 89, 56', lanes11: '3',
    });

    // Before enabling, the strip carries no ML band at all.
    const diagram = page.locator('.fd-diagram');
    await expect(diagram.locator('.fd-ml')).toHaveCount(0);

    await page.getByLabel('Enable managed lane').check();
    await expect(page.locator('#MLFFS_input')).toHaveValue('60');
    await expect(page.locator('#MLDEMAND_input')).toHaveValue('1000, 1100, 1160, 1040, 840');

    // The band appears from the form state, before any run.
    await expect(diagram.locator('.fd-ml')).toHaveCount(11);

    await calculate.click();

    // Facility LOS by period, Exhibit 25-87: C D D C C. These are the two
    // lane groups combined, not the general-purpose lanes alone.
    const losRow = page.locator('tr', { has: page.getByText('Facility LOS:') }).first();
    await expect(losRow.locator('td')).toHaveText(['C', 'D', 'D', 'C', 'C']);

    // Lane group rows, Exhibit 25-86.
    const gpRow = page.locator('tr', { has: page.getByText('GP Lane Group') }).first();
    await expect(gpRow.locator('td').first()).toHaveText('57.7 · 24.9 · C');
    const mlRow = page.locator('tr', { has: page.getByText('ML Lane Group') }).first();
    await expect(mlRow.locator('td').first()).toHaveText('59.3 · 16.9 · B');

    // ML segment cell, Exhibit 25-81: 1,614 veh/h uniform.
    const mlSeg1 = page.locator('.ml-out-table tbody tr').first();
    await expect(mlSeg1.locator('td').first()).toContainText('1614 veh/h');

    // Step A-13 adjacent friction fires on Segment 8 in period 3, where the
    // neighbouring GP density passes 35 pc/mi/ln (Exhibit 25-83).
    const mlSeg8 = page.locator('.ml-out-table tbody tr').nth(7);
    await expect(mlSeg8.locator('td').nth(2)).toContainText('friction');
    await expect(mlSeg1.locator('td').first()).not.toContainText('friction');

    // The band is scored after the run, in its own fill, and the GP mainline
    // keeps its own.
    await expect(diagram.locator('.fd-ml').first()).toHaveAttribute('fill', /^#/);
    await expect(diagram.locator('.fd-ml-los')).toHaveCount(11);
  });
});

test.describe('chapter 11 freeway reliability calculator', () => {
  // This block used to carry two retries for an intermittent webkit fault in
  // the Chapter 11 run, described there as an engine matter in cold wasm
  // instantiation. It is neither. Instantiation always succeeds, and the fault
  // is WebKit miscompiling the first heavy run in a fresh context, which is why
  // a reused page never trips it. The page now recovers on its own through
  // withWasmRetry, so the retries are gone: keeping them would hide a
  // regression of that fix, and the point of the fix is that a Safari user does
  // not see the failure either. VALIDATION.md carries the measurements.

  test('seed facility diagram renders in both views without LOS coloring', async ({ page }) => {
    await page.goto('/hcm11');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    const diagram = page.locator('.fd-diagram');
    await expect(diagram.locator('.fd-seg')).toHaveCount(3);
    await expect(diagram.locator('.fd-chip')).toHaveCount(0);
    await expect(diagram.getByText(/not LOS-colored here/)).toBeVisible();

    await page.getByRole('button', { name: '3D' }).click();
    await expect(page.locator('path.fd3-top').first()).toBeVisible();
    await expect(page.locator('.fd3-chip')).toHaveCount(0);
  });

  test('default inputs run a deterministic whole-year scenario set', async ({ page }) => {
    test.slow(); // 240 scenarios of wasm compute; tight under parallel load

    // The default facility is not a published example, so this pins the
    // engine's deterministic output for it with rng seed 1: 12 months x 5
    // weekdays x 4 replications = 240 scenarios, 4 periods each = 960
    // observations, and the exact metric values the seeded run produces. Any
    // engine change that moves these numbers must be deliberate. Example
    // Problem 7 is pinned separately below, on its own facility.
    await page.goto('/hcm11');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    // The three fidelity panels are opt-in, and these numbers are the
    // fifteen-argument no-weather run they must leave untouched while closed.
    // Asserting their inactive state here is what makes the pins below
    // evidence that nothing leaked in by default.
    // Scoped to the panel summaries: the beta note also contains the words
    // "not modeled", so a bare text lookup is ambiguous.
    const panelState = (title: string) =>
      page.locator('.fidelity-panel', { hasText: title }).locator('.fidelity-state');
    await expect(panelState('Weather Events')).toHaveText('Not modeled');
    await expect(panelState('Demand Multipliers')).toHaveText('Exhibit 11-18 defaults');
    await expect(panelState('Facility Parameters')).toHaveText('Engine defaults');

    await calculate.click();

    const cell = (label) => page.locator('tr', { hasText: label }).first().locator('td');
    await expect(cell('Scenarios Evaluated:')).toHaveText('240', { timeout: 60_000 });
    await expect(cell('Travel Time Observations:')).toHaveText('960');
    await expect(cell('Free-Flow Travel Time (min):')).toHaveText('2.28');
    await expect(cell('Mean TTI:')).toHaveText('1.264');
    await expect(cell('50th Percentile TTI:')).toHaveText('1.097');
    await expect(cell('95th Percentile TTI (PTI):')).toHaveText('1.698');
    // 62.8 since library PR #75 scoped the Equation 25-12 front-clearing test
    // to a restored bottleneck; it read 62.9 before. The rating is the share of
    // observations under a TTI threshold, so it is the one metric here that a
    // handful of reclassified scenarios can move — mean TTI, the median, and
    // PTI above are all unchanged to three decimals on the same run.
    await expect(page.getByText(/Reliability Rating: 62\.8/)).toBeVisible();
  });

  test('Example Problem 7 reproduces the boundary suite at full fidelity', async ({ page }) => {
    test.slow(); // 240 scenarios over an 11-segment facility

    // HCM Chapter 25, Example Problem 7 (Exhibits 25-97 through 25-105). With
    // the weather panel, the Exhibit 25-100 demand multipliers and the four
    // facility parameters all seeded, the page runs the same experiment as
    // tests/boundary/ch11_freeway_reliability.mjs, so these are that file's
    // assertions at the page's three-decimal precision. The published value is
    // named beside each; the tail measures are the documented reproduction
    // gaps, pinned at what this engine computes because the published ones come
    // from FREEVAL's Monte Carlo stream at seed 1, which it cannot replay.
    await page.goto('/hcm11');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Load Example Problem 7' }).click();

    // The loader brings the whole published facility, not only the panels: the
    // Exhibit 25-104 metrics belong to EP7's own 11-segment geometry.
    await expect(page.locator('.fd-diagram .fd-seg')).toHaveCount(11);
    await expect(page.getByRole('heading', { name: /Segment 6 · Weaving Details/ })).toBeVisible();
    // Scoped to the panel summaries: the beta note also contains the words
    // "not modeled", so a bare text lookup is ambiguous.
    const panelState = (title: string) =>
      page.locator('.fidelity-panel', { hasText: title }).locator('.fidelity-state');
    await expect(panelState('Weather Events')).toHaveText('Active');
    await expect(panelState('Demand Multipliers')).toHaveText('Local table');
    await expect(panelState('Facility Parameters')).toHaveText('Overridden');

    await calculate.click();

    const cell = (label: string) => page.locator('tr', { hasText: label }).first().locator('td');
    // 12 months x 5 weekdays x 4 replications, 12 analysis periods each.
    await expect(cell('Scenarios Evaluated:')).toHaveText('240', { timeout: 60_000 });
    await expect(cell('Travel Time Observations:')).toHaveText('2880');
    await expect(cell('Free-Flow Travel Time (min):')).toHaveText('6.00'); // 6 mi at 60 mi/h
    await expect(cell('Mean TTI:')).toHaveText('1.323');          // published 1.30
    await expect(cell('50th Percentile TTI:')).toHaveText('1.033'); // published 1.03
    await expect(cell('Misery Index:')).toHaveText('5.630');       // published 5.76
    await expect(cell('Semi-Standard Deviation:')).toHaveText('1.963'); // published 2.05
    await expect(cell('95th Percentile TTI (PTI):')).toHaveText('1.970'); // published 1.67, a known gap
    // Probability-weighted, which is how Exhibit 25-104 reports EP7, so the
    // rating here is over observations rather than the HCM's VMT weighting
    // (the boundary's VMT-weighted run gives 84.4 against a published 90.8).
    await expect(page.getByText(/Reliability Rating: 87\.0 % of observations/)).toBeVisible();
  });

  test('closing the fidelity panels restores the no-weather run', async ({ page }) => {
    test.slow();

    // The control for the pins above: the panels must be removable, not just
    // openable. After loading EP7 and then switching every panel back off and
    // clearing the four parameters, the same facility must return to the
    // Exhibit 11-18, weather-free numbers. Without this, an "off" state that
    // silently kept applying something would still pass every assertion above.
    await page.goto('/hcm11');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Load Example Problem 7' }).click();

    const panel = (title: string) => page.locator('.fidelity-panel', { hasText: title });
    for (const title of ['Weather Events', 'Demand Multipliers', 'Facility Parameters']) {
      await panel(title).locator('summary').click();
    }
    await page.locator('#WX_input').uncheck();
    await page.locator('#DM_input').uncheck();
    for (const id of ['#JAM_input', '#QDROP_input', '#TRD_input', '#ID_input']) {
      await page.locator(id).fill('');
    }
    await page.locator('#WEIGHT_input').selectOption('vmt');

    const panelState = (title: string) =>
      page.locator('.fidelity-panel', { hasText: title }).locator('.fidelity-state');
    await expect(panelState('Weather Events')).toHaveText('Not modeled');
    await expect(panelState('Demand Multipliers')).toHaveText('Exhibit 11-18 defaults');
    await expect(panelState('Facility Parameters')).toHaveText('Engine defaults');

    await calculate.click();

    const cell = (label: string) => page.locator('tr', { hasText: label }).first().locator('td');
    await expect(cell('Scenarios Evaluated:')).toHaveText('240', { timeout: 60_000 });
    await expect(cell('Travel Time Observations:')).toHaveText('2880');
    // Milder than the full-fidelity run above on the same geometry: no weather,
    // the Exhibit 11-18 national ratios, and the interchange-density fallback.
    await expect(cell('Mean TTI:')).toHaveText('1.218');
    await expect(cell('Misery Index:')).toHaveText('3.257');
    await expect(page.getByText(/Reliability Rating: 85\.8 % of travel/)).toBeVisible();
  });
});

test.describe('chapter 13 weaving calculator', () => {
  // Both tests run HCM Chapter 27, Example Problem 1 (the same segment), once per
  // edition. The editions disagree by design: the 7th Edition reports S = 53.1 mi/h
  // and D = 26.3 pc/mi/ln, Edition 7.1 reports S_o = 59.32 and D = 23.6, both LOS C.
  async function fillExampleProblem1(page) {
    await page.locator('#LS_input').fill('1500');
    await page.locator('#N_input').fill('4');
    await page.locator('#LCRF_input').fill('0');
    await page.locator('#LCFR_input').fill('1');
    await page.locator('#FFS_input').fill('65');
    await page.locator('#VFF_input').fill('1815');
    await page.locator('#VFR_input').fill('692');
    await page.locator('#VRF_input').fill('1037');
    await page.locator('#VRR_input').fill('1297');
    await page.locator('#PHF_input').fill('0.91');
    await page.locator('#PHV_input').fill('5');
    await page.locator('#CIFL_input').fill('2350');
  }

  test('reproduces the published example under the 7th Edition', async ({ page }) => {
    await page.goto('/hcm13');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await fillExampleProblem1(page);
    await page.locator('#NWL_input').fill('3');
    await calculate.click();

    await expect(page.getByText(/Segment LOS: C/)).toBeVisible();
    // Scoped to the step table: the generated discussion below it quotes the same figures, so a
    // page-wide text match on a bare number is ambiguous rather than wrong.
    const table = page.locator('.results-panel table');
    await expect(table.getByText(/26\.[0-9]/)).toBeVisible(); // D ≈ 26.3
    await expect(table.getByText(/53\.[0-9]/).first()).toBeVisible(); // S ≈ 53.1
  });

  test('reproduces the published example under Edition 7.1 via the picker', async ({ page }) => {
    await page.goto('/hcm13');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#VER_input').selectOption('7.1');
    await fillExampleProblem1(page);
    // Edition 7.1 configuration weighting: complex 0-1 weave, N_W,RF = 2, N_W,FR = 1.
    await page.locator('#NWRF_input').fill('2');
    await page.locator('#NWFR_input').fill('1');
    await calculate.click();

    await expect(page.getByText(/Edition 7.1 bands.*: C/)).toBeVisible();
    const table = page.locator('.results-panel table');
    await expect(table.getByText(/23\.[0-9]/)).toBeVisible(); // D ≈ 23.6
    await expect(table.getByText(/59\.[0-9]/).first()).toBeVisible(); // S_o ≈ 59.32
    await expect(page.getByText('Configuration Class:')).toBeVisible();
  });

  test('the movement diagram follows the inputs and highlights on hover', async ({ page }) => {
    await page.goto('/hcm13');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.weave-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /one-sided weaving segment/);

    // Hovering a legend chip highlights its movement path and dims the rest.
    await page.locator('.wv-chip.rf').hover();
    await expect(page.locator('path.mv-rf')).toHaveClass(/active/);
    await expect(page.locator('path.mv-ff')).toHaveClass(/dim/);

    // The geometry reacts to the form: two-sided redraws the ramps.
    await page.locator('#WT_input').selectOption('two_sided');
    await expect(diagram).toHaveAttribute('aria-label', /two-sided weaving segment/);

    // The legend inputs two-way bind to the form.
    await page.locator('input[aria-label*="v_RF"]').fill('880');
    await expect(page.locator('#VRF_input')).toHaveValue('880');
    await page.locator('#VFR_input').fill('610');
    await expect(page.locator('input[aria-label*="v_FR"]')).toHaveValue('610');

    // The shared 2D/3D toggle swaps in the projected view with the same state.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    const svg3d = page.locator('.weave-diagram-3d svg');
    await expect(svg3d).toBeVisible();
    await expect(svg3d).toHaveAttribute('aria-label', /two-sided weaving segment, 3D view/);
    await page.locator('.w3-chip.rr').hover();
    await expect(page.locator('.weave-diagram-3d path.mv-rr')).toHaveClass(/active/);
  });
});

test.describe('chapter 14 merge and diverge calculator', () => {
  test('reproduces the published isolated on-ramp example problem', async ({ page }) => {
    // HCM Chapter 26, Example Problem 1: one-lane right-hand on-ramp to a
    // four-lane freeway (2 lanes/direction), FFS 60, L_A 740 ft, 2,500 veh/h
    // freeway demand, 535 veh/h ramp demand, PHF 0.90, 5% trucks, level.
    // Published: D_R = 28.2 pc/mi/ln, LOS D, S_R = 53.0 mi/h (library
    // integration test chapter14_integration.rs asserts the same fixture).
    await page.goto('/hcm14');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FL_input').fill('2');
    await page.locator('#FFS_input').fill('60');
    await page.locator('#RFFS_input').fill('45');
    await page.locator('#LA_input').fill('740');
    await page.locator('#VF_input').fill('2500');
    await page.locator('#VR_input').fill('535');
    await page.locator('#PHF_input').fill('0.90');
    await page.locator('#PHV_input').fill('5');
    await page.locator('#RPHV_input').fill('5');
    await calculate.click();

    await expect(page.getByText(/Segment LOS: D/)).toBeVisible();
    const table = page.locator('.results-panel table');
    await expect(table.getByText(/28\.[0-9]/)).toBeVisible(); // D_R ≈ 28.2
    await expect(table.getByText(/5[23]\.[0-9]/).first()).toBeVisible(); // S_R ≈ 53.0
  });

  test('the same on-ramp under Edition 7.1 via the picker', async ({ page }) => {
    // Same Chapter 26 Example Problem 1 inputs under the Edition 7.1 methodology, which
    // replaces the lane-distribution model with an equivalent-basic-segment speed less an
    // impedance. Expected values come from the library's Edition 7.1 implementation for this
    // fixture: density 32.1 pc/mi/ln, influence area speed 55.1 mi/h, d/c 0.94, LOS E under
    // the Exhibit 14-2 Edition 7.1 bands.
    await page.goto('/hcm14');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#VER_input').selectOption('7.1');
    await page.locator('#FL_input').fill('2');
    await page.locator('#FFS_input').fill('60');
    await page.locator('#RFFS_input').fill('45');
    await page.locator('#LA_input').fill('740');
    await page.locator('#VF_input').fill('2500');
    await page.locator('#VR_input').fill('535');
    await page.locator('#PHF_input').fill('0.90');
    await page.locator('#PHV_input').fill('5');
    await page.locator('#RPHV_input').fill('5');
    await calculate.click();

    await expect(page.getByText(/Edition 7.1 bands.*: E/)).toBeVisible();
    const table = page.locator('.results-panel table');
    await expect(table.getByText(/32\.[0-9]/)).toBeVisible(); // density ≈ 32.1
    await expect(table.getByText(/55\.[0-9]/).first()).toBeVisible(); // S ≈ 55.1
    await expect(page.getByText('Demand-to-Capacity Ratio:')).toBeVisible();
  });

  test('major merge under capacity says the HCM defines no LOS', async ({ page }) => {
    await page.goto('/hcm14');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#RT_input').selectOption('major_merge');
    await calculate.click();

    await expect(page.getByText(/not defined by the HCM/)).toBeVisible();
  });

  test('the junction diagram follows the inputs', async ({ page }) => {
    await page.goto('/hcm14');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.ramp-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /right-side on ramp/);

    await page.locator('.rd-chip', { hasText: 'influence area' }).hover();
    await expect(page.locator('.rd-influence')).toHaveClass(/active/);

    // The dimensioned length is editable beside the legend and two-way binds
    // to the form.
    await page.locator('input[aria-label="Acceleration lane length (ft)"]').fill('980');
    await expect(page.locator('#LA_input')).toHaveValue('980');

    await page.locator('#RT_input').selectOption('off_ramp');
    await expect(diagram).toHaveAttribute('aria-label', /off ramp/);
    await page.locator('input[aria-label="Deceleration lane length (ft)"]').fill('520');
    await expect(page.locator('#LD_input')).toHaveValue('520');

    // The shared 2D/3D toggle swaps in the projected view with the same state.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    const svg3d = page.locator('.ramp-diagram-3d svg');
    await expect(svg3d).toBeVisible();
    await expect(svg3d).toHaveAttribute('aria-label', /off ramp, 3D view/);
    await page.locator('.r3-chip.influence').hover();
    await expect(page.locator('.ramp-diagram-3d .r3-influence')).toHaveClass(/active/);
  });
});

test.describe('chapter 12 basic freeway calculator', () => {
  test('example inputs run through the wasm engine to a LOS letter and visuals', async ({ page }) => {
    await page.goto('/hcm12');

    // The Calculate button stays disabled until the wasm module has initialized.
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Load example' }).click();
    await calculate.click();

    // Segment LOS badge renders a real letter, not the "no LOS" dash.
    const badge = page.locator('.los-badge');
    await expect(badge.first()).toBeVisible();
    await expect(badge.first()).toHaveAttribute('aria-label', /Level of service [A-F]/);

    // The two result visuals introduced with the LOS scale work: the density
    // scale against the Exhibit 12-15 thresholds and the speed-flow curve fed
    // by the middleware's ffs_adj/breakpoint accessors.
    await expect(page.getByText('Density against the Exhibit 12-15 thresholds')).toBeVisible();
    await expect(page.locator('.result-visuals svg').first()).toBeVisible();
  });

  test('reset clears the outputs', async ({ page }) => {
    await page.goto('/hcm12');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Load example' }).click();
    await calculate.click();
    await expect(page.locator('.los-badge').first()).toBeVisible();

    await page.getByRole('button', { name: 'Reset Params' }).click();
    await expect(page.locator('.los-badge')).toHaveCount(0);
  });

  test('the 3D segment view renders from the page inputs and again in the report', async ({ page }) => {
    // The 3D slab is a shared component used by this page and by /report. It has
    // no route of its own, so nothing renders it with default props; both call
    // sites have to pass the analysis inputs through. One divider per interior
    // lane line, so four lanes draw three.
    await page.goto('/hcm12');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    // Load example fetches the fixture, so wait for its lane count to land
    // before overwriting it or the fetch resolves on top of the edit.
    await page.getByRole('button', { name: 'Load example' }).click();
    await expect(page.locator('#LC_input')).toHaveValue('3');
    await page.locator('#LC_input').fill('4');
    await calculate.click();

    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    const svg3d = page.locator('.fw3d svg');
    await expect(svg3d).toHaveAttribute('aria-label', /Basic freeway segment/);
    await expect(svg3d.locator('polyline.r-lane')).toHaveCount(3);

    await page.goto('/report');
    const reported = page.locator('.report-diagram .fw3d svg');
    await expect(reported).toBeVisible();
    await expect(reported.locator('polyline.r-lane')).toHaveCount(3);
  });
});

test.describe('chapter 12 mixed-flow mode', () => {
  // The Chapter 25/26 mixed-flow model as a second method on the Chapter 12 page. Same
  // fixtures the boundary suite runs (tests/boundary/ch25_26_mixed_flow.mjs); driven here
  // through the form so the percent-to-decimal conversion on the truck shares and the
  // rendering of the absent-speed case are covered too.
  async function openMixedFlow(page: Page) {
    await page.goto('/hcm12');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.selectOption('#METHOD_input', 'mixed');
  }

  test('Load Ch.26 EP5 reproduces the published single-grade result', async ({ page }) => {
    await openMixedFlow(page);
    await page.getByRole('button', { name: 'Load Ch.26 EP5' }).click();

    // Example Problem 5's facts, seeded by the loader rather than typed.
    await expect(page.locator('#MFSUB_input')).toHaveValue('single');
    await expect(page.locator('#MFGRADE_input')).toHaveValue('5');
    await expect(page.locator('#MFLEN_input')).toHaveValue('2');
    await expect(page.locator('#MFFFS_input')).toHaveValue('65');
    await expect(page.locator('#MFV_input')).toHaveValue('1500');
    await expect(page.locator('#MFSUT_input')).toHaveValue('5');
    await expect(page.locator('#MFTT_input')).toHaveValue('10');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Published: CAF_mix 0.734, C_mix 1,725 veh/h/ln, FFS_mix 60.1, S_mix 47.4, D_mix 31.6.
    // The capacity prints 1726 rather than the book's 1,725 because the example carries
    // CAF_mix rounded to three decimals into Equation 26-5 and the engine does not.
    await expect(page.getByTestId('mf-caf-mix')).toHaveText('0.735');
    await expect(page.getByTestId('mf-capacity')).toHaveText('1726 veh/h/ln');
    await expect(page.getByTestId('mf-ffs-mix')).toHaveText('60.1 mi/h');
    await expect(page.getByTestId('mf-speed')).toHaveText('47.4 mi/h');
    await expect(page.getByTestId('mf-density')).toHaveText('31.6 veh/mi/ln');

    // Chapter 26 assigns LOS F above capacity and no letter below it. Reading D_mix against
    // the Exhibit 12-15 bands would be reading a mixed-flow density against auto-only
    // thresholds, which the Example Problem 5 discussion rules out in as many words.
    await expect(page.getByTestId('mf-los')).toHaveText('not assigned');
    await expect(page.getByTestId('mf-los-basis')).toContainText('assigns no letter');
    await expect(page.getByTestId('mf-oversaturated')).toHaveCount(0);
  });

  test('Load Ch.25 EP11 reproduces the published composite-grade result', async ({ page }) => {
    await openMixedFlow(page);
    await page.getByRole('button', { name: 'Load Ch.25 EP11' }).click();

    await expect(page.locator('#MFSUB_input')).toHaveValue('composite');
    await expect(page.locator('#MFSEGG0_input')).toHaveValue('3');
    await expect(page.locator('#MFSEGL0_input')).toHaveValue('1.5');
    await expect(page.locator('#MFSEGG2_input')).toHaveValue('5');

    await page.getByRole('button', { name: 'Calculate' }).click();

    // Published per-segment capacities 1,875 / 1,934 / 1,746 veh/h/ln and speeds
    // 57.7 / 58.7 / 47.9 mi/h; the 1 mi 5% grade governs at 1,746 and the facility runs at
    // 55.6 mi/h over 4.5 mi. The engine's unrounded chain lands a unit or two off each.
    await expect(page.getByTestId('mf-comp-seg-1')).toContainText('1874');
    await expect(page.getByTestId('mf-comp-seg-1')).toContainText('57.7');
    await expect(page.getByTestId('mf-comp-seg-3')).toContainText('1747');
    await expect(page.getByTestId('mf-comp-capacity')).toHaveText('1747 veh/h/ln');
    await expect(page.getByTestId('mf-comp-governing')).toHaveText('Grade 3');
    await expect(page.getByTestId('mf-comp-overall')).toHaveText('55.7 mi/h');
    await expect(page.getByTestId('mf-comp-los')).toHaveText('not assigned');

    // The profile strip draws the three grades to scale and calls out the governing one.
    const profile = page.locator('.grade-profile');
    await expect(profile).toHaveAttribute('aria-label', /1.5 mi at 3%, 2 mi at 2%, 1 mi at 5%/);
    await expect(profile.locator('.gp-governing')).toHaveCount(1);
  });

  test('above capacity the single-grade result reports no speed rather than a zero', async ({ page }) => {
    await openMixedFlow(page);
    await page.getByRole('button', { name: 'Load Ch.26 EP5' }).click();

    // C_mix is 1,726 veh/h/ln for this grade, so 2,000 is oversaturated. s_mix and d_mix
    // cross the wasm boundary as `undefined` rather than `null` (serde crosses Rust's None
    // that way), which is why the page guards on `== null`: a `=== null` guard never fires
    // and the absent speed prints as a number.
    await page.locator('#MFV_input').fill('2000');
    await page.getByRole('button', { name: 'Calculate' }).click();

    await expect(page.getByTestId('mf-oversaturated')).toContainText(
      'LOS F — demand exceeds mixed-flow capacity; the method reports no speed'
    );
    await expect(page.getByTestId('mf-speed')).toHaveText('no speed reported');
    await expect(page.getByTestId('mf-density')).toHaveText('no density reported');
    await expect(page.getByTestId('mf-los')).toHaveText('F');
    // The capacity side still computes, which is what makes the LOS F call.
    await expect(page.getByTestId('mf-capacity')).toHaveText('1726 veh/h/ln');
  });

  test('switching modes preserves the standard-mode result', async ({ page }) => {
    await page.goto('/hcm12');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Load example' }).click();
    await calculate.click();
    const density = await page.locator('.step-table tr', { hasText: 'Density, D' }).locator('td.num').textContent();
    expect(density).toMatch(/pc\/mi\/ln/);

    await page.selectOption('#METHOD_input', 'mixed');
    await expect(page.locator('#MFSUB_input')).toBeVisible();
    await expect(page.locator('.step-table tr', { hasText: 'Density, D' })).toHaveCount(0);

    await page.selectOption('#METHOD_input', 'standard');
    await expect(page.locator('.step-table tr', { hasText: 'Density, D' }).locator('td.num')).toHaveText(density!);
    await expect(page.locator('.los-badge').first()).toBeVisible();
  });

  test('a grade the PCE exhibits do not cover offers the mixed-flow mode', async ({ page }) => {
    await page.goto('/hcm12');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    // Exhibits 12-26/27/28 stop at 6%. Selecting a specific-upgrade mix makes grade live, and
    // a 7% grade is then a refusal the mixed-flow mode is the answer to.
    await page.selectOption('#SUT_input', '30');
    await page.locator('#GRADE_input').fill('7');
    await page.locator('#LEN_input').fill('2');
    await calculate.click();

    await expect(page.getByTestId('hcm12-error')).toContainText('Exhibit 12-26/27/28');
    const escalate = page.getByTestId('hcm12-escalate');
    await expect(escalate).toBeVisible();
    await escalate.getByRole('button', { name: 'Switch to mixed-flow mode' }).click();
    await expect(page.locator('#MFSUB_input')).toBeVisible();
    await expect(page.locator('#METHOD_input')).toHaveValue('mixed');
  });

  test('mountainous terrain advertises the mixed-flow mode without blocking', async ({ page }) => {
    await page.goto('/hcm12');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });

    await expect(page.getByTestId('hcm12-mountainous-hint')).toHaveCount(0);
    await page.selectOption('#TERRAIN_input', 'mountainous');

    // Mountainous does not refuse — Exhibit 12-25 has a column for it — so this is a hint,
    // not an error, and the standard analysis still runs.
    const hint = page.getByTestId('hcm12-mountainous-hint');
    await expect(hint).toBeVisible();
    await expect(page.getByTestId('hcm12-error')).toHaveCount(0);
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.locator('.los-badge').first()).toBeVisible();

    await hint.getByRole('button', { name: 'Switch to mixed-flow mode' }).click();
    await expect(page.locator('#MFSUB_input')).toBeVisible();
  });

  test('the mixed-flow form is inert until the wasm module is ready', async ({ page }) => {
    // A warm preview server hydrates faster than a fill lands, so the race has to be created
    // rather than raced for. Without the guard webkit APPENDS to the server-rendered value.
    await page.route('**/*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto('/hcm12');
    await page.unroute('**/*.js');

    // Pre-hydration the method selector is inside no form and the mixed-flow inputs do not
    // exist yet, so the guard is checked on the standard form, which is the one painted.
    const demand = page.locator('#DEMAND_input');
    await demand.fill('3800').catch(() => {});
    await expect(demand).toHaveValue('1000');

    // And it lifts.
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await demand.fill('3800');
    await expect(demand).toHaveValue('3800');
  });
});

test.describe('chapter 12 managed lane calculator', () => {
  // HCM Chapter 26, Example Problem 7. The page defaults are Case 1; the only edit
  // between the two cases is the adjacent general purpose demand. Same fixture as
  // tests/boundary/ch12ml_managed_lanes.mjs, driven here through the form so the
  // veh/h to pc/h/ln conversion on the page is covered too.
  async function calculate(page: Page) {
    const button = page.getByRole('button', { name: 'Calculate' });
    await expect(button).toBeEnabled({ timeout: 30_000 });
    await button.click();
    return button;
  }

  test('defaults reproduce Example Problem 7 Case 1', async ({ page }) => {
    await page.goto('/hcm12ml');
    await calculate(page);

    // Published Case 1: f_HV 0.93, ML flow 1,519 pc/h/ln, S_ML 56.3 mi/h,
    // density 27.0 pc/mi/ln, LOS D, with the GP lanes under the friction threshold.
    const row = (label: string) => page.locator('tr', { has: page.getByText(label, { exact: false }) }).first();
    await expect(row('Heavy-Vehicle Factor').locator('td')).toHaveText('0.930');
    await expect(row('Managed Lane Flow Rate').locator('td')).toHaveText('1519');
    await expect(row('Adjusted Capacity').locator('td')).toHaveText('1650');
    await expect(row('Speed-Flow Breakpoint').locator('td')).toHaveText('500');
    await expect(row('Space Mean Speed').locator('td')).toHaveText('56.3');
    await expect(row('Density (pc/mi/ln)').locator('td')).toHaveText('27.0');
    await expect(row('GP Lane Friction Active').locator('td')).toHaveText(/No/);
    await expect(page.getByText('Segment LOS: D')).toBeVisible();

    await expect(page.locator('.los-badge').first()).toHaveAttribute('aria-label', 'Level of service D');
    await expect(page.getByText('Managed lane density against the Exhibit 12-15 thresholds')).toBeVisible();
  });

  test('raising the GP demand reproduces Case 2 and activates friction', async ({ page }) => {
    await page.goto('/hcm12ml');
    // Wait for hydration before touching an input. Filling a bind:value number
    // field while the page is still the server-rendered markup appends to the
    // seeded value instead of replacing it on webkit, so 3800 becomes 20003800
    // and the analysis runs on twenty million veh/h without erroring. Every
    // other test in this file reaches an input only after this gate.
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#GPDEMAND_input').fill('3800');
    await calculate(page);

    // Published Case 2: GP flow 2,221 pc/h/ln at 53.0 mi/h gives K_GP 41.9 > 35,
    // so I_c = 1 and the managed lane drops to 41.9 mi/h and LOS E. The page prints
    // 2,220 and 36.2 where the book prints 2,221 and 36.3, because the book carries
    // its rounded intermediates forward (1,519 / 41.9 = 36.3) while the engine
    // divides by the unrounded speed 41.9094 and gets 36.245. Both differences are
    // inside the 0.1 and 1.0 tolerances the boundary suite pins EP7 to, and neither
    // moves the LOS letter.
    const row = (label: string) => page.locator('tr', { has: page.getByText(label, { exact: false }) }).first();
    await expect(row('GP Flow Rate').locator('td')).toHaveText('2220');
    await expect(row('GP Speed').locator('td')).toHaveText('53.0');
    await expect(row('GP Density').locator('td')).toHaveText('41.9');
    await expect(row('Space Mean Speed').locator('td')).toHaveText('41.9');
    await expect(row('Density (pc/mi/ln)').locator('td')).toHaveText('36.2');
    await expect(row('GP Lane Friction Active').locator('td')).toHaveText(/Yes/);
    await expect(page.getByText('Segment LOS: E')).toBeVisible();
  });

  test('the diagram redraws for the separation type and tints by LOS after a run', async ({ page }) => {
    await page.goto('/hcm12ml');
    const diagram = page.locator('.ml-diagram');

    // Continuous access draws the wide dashed access line and no separation band.
    await expect(diagram.locator('.ml-access-line')).toHaveCount(1);
    await expect(diagram.locator('.ml-barrier')).toHaveCount(0);
    await expect(diagram.locator('.ml-tint')).toHaveCount(0);

    // Two GP lanes plus one managed lane means exactly one interior lane line.
    await expect(diagram.locator('.ml-lane-line')).toHaveCount(1);

    await page.locator('#TYPE_input').selectOption('barrier2');
    await expect(diagram.locator('.ml-barrier')).toHaveCount(1);
    await expect(diagram.locator('.ml-access-line')).toHaveCount(0);

    await page.locator('#TYPE_input').selectOption('continuous_access');
    await calculate(page);
    await expect(diagram.locator('.ml-tint')).toHaveCount(1);
    // The labels are SVG <text>, which the text engine does not reach, so assert on
    // the rendered node itself.
    await expect(diagram.locator('[data-testid="ml-label"]')).toHaveText(/Managed lane · LOS D · 27\.0 pc\/mi\/ln/);
    await expect(diagram.locator('[data-testid="gp-label"]')).toHaveText(/2 general purpose lanes · K_GP 19\.5 pc\/mi\/ln/);
  });

  test('a run publishes a printable report', async ({ page }) => {
    await page.goto('/hcm12ml');
    await calculate(page);

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page).toHaveURL(/\/report$/);
    await expect(page.locator('.report-title')).toHaveText('Basic Managed Lane Segments');
    await expect(page.locator('.report-eyebrow')).toHaveText('HCM Chapter 12, Section 4');
    // The report carries the same diagram component the page draws.
    await expect(page.locator('.report-diagram .ml-diagram')).toHaveCount(1);
  });

  test('reset clears the outputs', async ({ page }) => {
    await page.goto('/hcm12ml');
    await calculate(page);
    await expect(page.locator('.los-badge').first()).toBeVisible();

    await page.getByRole('button', { name: 'Reset Params' }).click();
    await expect(page.locator('.los-badge')).toHaveCount(0);
  });
});

test.describe('chapter 16 urban street facility calculator', () => {
  test('inputs mode reproduces the published Chapter 30 facility on defaults', async ({ page }) => {
    // Inputs-mode defaults are the library fixture
    // tests/ExampleCases/hcm/UrbanFacilities/case3.json: three copies of the
    // HCM Chapter 30, Section 8, Example Problem 1 eastbound segment, with the
    // Exhibit 30-35 per-point access delays supplied. A facility of identical
    // segments reproduces the published segment values at facility level
    // (Exhibit 30-36): base FFS 40.78 mi/h, travel speed 23.67 mi/h, LOS C.
    // Same fixture and expectations as tests/boundary/ch16_urban_facilities.mjs.
    await page.goto('/hcm16');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    const row = (label: string) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('Facility Base Free-Flow Speed')).toContainText('40.78');
    await expect(row('Facility Travel Speed')).toContainText('23.67');
    // 1.6045 stops/mi, printed at two decimals; the book's 1.61 is the same
    // number at its own rounding, and the boundary suite's tolerance is 0.02.
    await expect(row('Facility Spatial Stop Rate')).toContainText('1.60');
    await expect(row('Critical Volume-to-Capacity Ratio')).toContainText('0.52');
    await expect(row('Poorest Segment LOS')).toContainText('C');
    await expect(page.getByText(/Facility LOS: C/)).toBeVisible();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Urban Street Facilities');
    await expect(page.locator('.report-diagram .uf-diagram svg')).toBeVisible();
  });

  test('measures mode reproduces the published Chapter 29 facility', async ({ page }) => {
    // Measures-mode defaults are case1.json, HCM Chapter 29, Section 5,
    // Example Problem 1 eastbound: five segments given by their published
    // Chapter 18 outputs, aggregated through add_segment_summary + aggregate().
    // Published Exhibit 29-49: base FFS 40.1 mi/h (exact, printed here at two
    // decimals as 40.11), facility LOS C, poorest segment LOS D. The facility
    // travel speed lands on 22.13 rather than the published 22.6 because the
    // chapter publishes only Segments 1 and 5, which the fixture copies into
    // Segments 2 through 4; the page says so under the outputs.
    await page.goto('/hcm16');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#MODE_input').selectOption('measures');
    await expect(page.locator('.seg-table tbody tr')).toHaveCount(5);
    await calculate.click();

    const row = (label: string) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('Facility Base Free-Flow Speed')).toContainText('40.11');
    await expect(row('Facility Travel Speed')).toContainText('22.13');
    await expect(row('Poorest Segment LOS')).toContainText('D');
    await expect(page.getByText(/Facility LOS: C/)).toBeVisible();
    await expect(page.locator('.fixture-note')).toContainText('22.6');
  });

  test('the analysis modes stay exclusive and keep their own segments', async ({ page }) => {
    // One kind of segment per run: the mode selector swaps the whole segment
    // set, and each mode's numbers survive a round trip through the other.
    await page.goto('/hcm16');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });

    await expect(page.locator('#LEN_input_0')).toHaveValue('1800');
    await page.locator('#LEN_input_0').fill('1500');

    await page.locator('#MODE_input').selectOption('measures');
    await expect(page.locator('#LEN_input_0')).toHaveCount(0);
    await expect(page.locator('#MLEN_input_0')).toHaveValue('1320');

    await page.locator('#MODE_input').selectOption('inputs');
    await expect(page.locator('#MLEN_input_0')).toHaveCount(0);
    await expect(page.locator('#LEN_input_0')).toHaveValue('1500');
  });

  test('the facility diagram selects segments, colors by LOS, and toggles to 3D', async ({ page }) => {
    await page.goto('/hcm16');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready

    const diagram = page.locator('.uf-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /urban street facility, 3 segments upstream to downstream/);

    // Three decks and four boundary intersections, with the subject-side
    // access points drawn as driveway ticks (4 per segment).
    await expect(page.locator('rect.uf-deck')).toHaveCount(3);
    await expect(page.locator('rect.uf-cross')).toHaveCount(4);
    await expect(page.locator('rect.uf-drive')).toHaveCount(12);

    // Clicking a segment selects it, and the matching card takes the accent.
    await page.locator('g.uf-seg').nth(1).click();
    await expect(page.locator('.seg-panel').nth(1)).toHaveClass(/seg-selected/);
    await expect(page.locator('g.uf-seg').nth(1)).toHaveClass(/selected/);

    // LOS heat only appears after a run.
    await expect(page.locator('rect.uf-deck.scored')).toHaveCount(0);
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByText(/Facility LOS: C/)).toBeVisible();
    await expect(page.locator('rect.uf-deck.scored')).toHaveCount(3);
    await expect(diagram).toHaveAttribute('aria-label', /coloured by segment level of service/);

    // The 3D toggle swaps in the projected view, LOS heat and all.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    await expect(page.locator('.uf3-wrap svg')).toHaveAttribute('aria-label', /urban street facility 3D view, 3 segments/);
    await expect(page.locator('path.uf3-top.scored')).toHaveCount(3);
  });
});

test.describe('chapter 17 urban street reliability calculator', () => {
  // The reliability run is one synchronous wasm call over roughly three
  // thousand scenarios, so every assertion here waits on the results cell
  // rather than on the click.
  const row = (page: Page, label: string) => page.locator('.results-panel tr', { hasText: label }).first();

  test('reproduces the published Chapter 29 example problem on defaults', async ({ page }) => {
    // The page defaults are HCM Chapter 29, Section 5, Example Problem 4
    // (Exhibits 29-62 through 29-77): the 3-mi Lincoln, Nebraska principal
    // arterial, twelve 15-min periods from 7 a.m., seeds 82/11/63. Same
    // fixture and expectations as tests/boundary/ch17_urban_reliability.mjs,
    // whose header explains why the computed TTI measures differ from the
    // published Exhibit 29-73 values.
    await page.goto('/hcm17');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    await expect(row(page, 'Scenarios Evaluated')).toContainText('3120', { timeout: 60_000 });
    await expect(row(page, 'Mean Travel Time Index')).toContainText('1.545');
    await expect(row(page, '80th Percentile TTI')).toContainText('1.593');
    await expect(row(page, '95th Percentile TTI')).toContainText('1.746');
    await expect(row(page, 'Oversaturated Scenarios')).toContainText('70');
    await expect(page.getByText(/Urban Street Reliability Rating: 98.8 %/)).toBeVisible();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Urban Street Reliability and ATDM');
  });

  // The results panel is cleared on every Calculate, so a plain read can catch
  // an empty cell. Poll the cell instead of the click.
  const meanTravelTime = async (page: Page) => {
    const text = (await row(page, 'Mean Travel Time (s)').locator('td').textContent())?.trim();
    return text ? Number(text) : NaN;
  };
  const meanTti = async (page: Page) => {
    const text = (await row(page, 'Mean Travel Time Index').locator('td').textContent())?.trim();
    return text === '' ? null : text;
  };

  test('an ATDM green-time strategy lowers the mean travel time', async ({ page }) => {
    // Chapter 29 Example Problem 5 Strategy 1: 5 s of split shifted to the
    // coordinated through phase. The published direction of effect is a
    // travel time drop, which is what the boundary suite asserts too.
    await page.goto('/hcm17');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();
    await expect(row(page, 'Scenarios Evaluated')).toContainText('3120', { timeout: 60_000 });
    const baseTravelTime = await meanTravelTime(page);
    expect(baseTravelTime).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Add Strategy' }).click();
    await page.locator('#STN_input_0').fill('EP5 Strategy 1');
    await page.locator('#SGA_input_0').fill('5');
    await calculate.click();

    await expect.poll(() => meanTravelTime(page), { timeout: 60_000 }).toBeLessThan(baseTravelTime);
  });

  test('the same seeds reproduce the same distribution', async ({ page }) => {
    // The Monte Carlo stream is software-specific but deterministic in the
    // seeds. The middle run on a different weather seed is what makes the
    // third read provably fresh rather than a stale cell that never changed.
    await page.goto('/hcm17');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await calculate.click();
    await expect(row(page, 'Scenarios Evaluated')).toContainText('3120', { timeout: 60_000 });
    const first = await meanTti(page);
    expect(first).toBeTruthy();

    await page.locator('#WSE_input').fill('83');
    await calculate.click();
    await expect.poll(() => meanTti(page), { timeout: 60_000 }).not.toBe(first);

    await page.locator('#WSE_input').fill('82');
    await calculate.click();
    await expect.poll(() => meanTti(page), { timeout: 60_000 }).toBe(first);
  });

  test('the facility strip selects segments, stays un-tinted, and toggles to 3D', async ({ page }) => {
    // Chapter 17 exports no per-segment result, so the strip is the Chapter 16
    // component with its LOS channel deliberately unused. This test is the
    // guard on that: no deck may ever pick up a scored fill, before or after a
    // run.
    await page.goto('/hcm17');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    const diagram = page.locator('.uf-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /urban street facility, 6 segments upstream to downstream/);
    // Six decks, seven boundary intersections, two subject-side access points
    // drawn per segment.
    await expect(page.locator('rect.uf-deck')).toHaveCount(6);
    await expect(page.locator('rect.uf-cross')).toHaveCount(7);
    await expect(page.locator('rect.uf-drive')).toHaveCount(12);

    // Clicking a deck selects it and accents the matching segment card.
    await page.locator('g.uf-seg').nth(2).click();
    await expect(page.locator('.seg-panel').nth(2)).toHaveClass(/seg-selected/);
    await expect(page.locator('g.uf-seg').nth(2)).toHaveClass(/selected/);
    // Clicking the same deck again clears the selection.
    await page.locator('g.uf-seg').nth(2).click();
    await expect(page.locator('.seg-panel').nth(2)).not.toHaveClass(/seg-selected/);

    await expect(page.locator('rect.uf-deck.scored')).toHaveCount(0);
    await calculate.click();
    await expect(row(page, 'Scenarios Evaluated')).toContainText('3120', { timeout: 60_000 });
    // Still no tint after the run, and no LOS legend to imply one.
    await expect(page.locator('rect.uf-deck.scored')).toHaveCount(0);
    await expect(page.locator('.uf-diagram .uf-scale')).toHaveCount(0);
    await expect(diagram).not.toHaveAttribute('aria-label', /level of service/);

    // The 3D toggle swaps in the projected view, un-tinted there too.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    await expect(page.locator('.uf3-wrap svg')).toHaveAttribute('aria-label', /urban street facility 3D view, 6 segments/);
    await expect(page.locator('path.uf3-top')).toHaveCount(6);
    await expect(page.locator('path.uf3-top.scored')).toHaveCount(0);
  });
});

test.describe('chapter 18 urban street segment calculator', () => {
  test('reproduces the published Chapter 30 example problem on defaults', async ({ page }) => {
    // The page defaults are HCM Chapter 30, Section 8, Example Problem 1
    // (Exhibits 30-26 through 30-36), eastbound, with the Exhibit 30-35
    // per-point access delays supplied. Published: base FFS 40.78 mi/h,
    // travel speed 23.67 mi/h, LOS C, through delay 18.310 s/veh. Same
    // fixture and expectations as tests/boundary/ch18_urban_segments.mjs.
    await page.goto('/hcm18');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    const row = (label: string) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('Base Free-Flow Speed')).toContainText('40.78');
    await expect(row('Travel Speed')).toContainText('23.67');
    await expect(row('Through Delay')).toContainText('18.31');
    await expect(page.getByText(/Segment LOS: C/)).toBeVisible();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Urban Street Segments');
    await expect(page.locator('.report-diagram .us-diagram svg')).toBeVisible();
  });

  test('switching the access-point delay source to the planning estimate moves the travel speed', async ({ page }) => {
    // With every planning field left blank the engine takes the Exhibit 18-13
    // baseline (10% left and right turns, N_ap = N_ap,s + p_ap,lt * N_ap,o =
    // 8), giving d_ap 2.96 s against the per-point 0.387 s and a travel speed
    // of 22.55 mi/h. That is the pre-0.3.3 default path, held as a regression
    // anchor in tests/boundary/ch18_urban_segments.mjs.
    await page.goto('/hcm18');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#APSRC_input').selectOption('planning');
    await expect(page.locator('#NAP_input')).toHaveValue('');
    await calculate.click();

    const row = (label: string) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('Travel Speed')).toContainText('22.55');
    await expect(row('Access-Point Delay')).toContainText('2.960');
    // The free-flow speed chain does not depend on the delay source.
    await expect(row('Base Free-Flow Speed')).toContainText('40.78');
    await expect(page.getByText(/Segment LOS: C/)).toBeVisible();
  });

  test('the segment diagram edits demand, counts driveways, and animates', async ({ page }) => {
    await page.goto('/hcm18');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.us-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /urban street segment, 2 through lanes each direction, 4 subject and 4 opposing access points/);

    // Four driveways per side, redrawn from the counts.
    await expect(page.locator('rect.us-drive')).toHaveCount(8);
    await page.locator('input[aria-label="Subject access points"]').fill('2');
    await expect(page.locator('rect.us-drive')).toHaveCount(6);
    await expect(page.locator('#APS_input')).toHaveValue('2');
    await page.locator('#APS_input').fill('4');
    await expect(page.locator('rect.us-drive')).toHaveCount(8);

    // On-diagram demand editing two-way binds to the form.
    await page.locator('input[aria-label="Through demand"]').fill('1200');
    await expect(page.locator('#DEM_input')).toHaveValue('1200');

    // Animation runs and stops.
    await page.getByRole('button', { name: 'Animate traffic' }).click();
    const vehicles = page.locator('g.us-veh');
    await expect(vehicles.first()).toBeVisible();
    expect(await vehicles.count()).toBeGreaterThan(3);
    await page.getByRole('button', { name: 'Stop traffic' }).click();
    await expect(vehicles).toHaveCount(0);

    // The 3D toggle swaps in the projected view.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    await expect(page.locator('.us-diagram-3d svg')).toHaveAttribute('aria-label', /urban street segment, 3D view/);
  });

  test('the computed Chapter 30 section 4 mode reproduces the published per-point delays', async ({ page }) => {
    // Computed mode drives the Section 4 procedure from the two Exhibit 30-35
    // approaches instead of taking their published delays as inputs. Library
    // fixture UrbanSegments/case3.json, same expectations as case3 in
    // tests/boundary/ch18_urban_segments.mjs: per-point 0.193 and 0.194 s/veh,
    // inside-lane blockage probability 0.115 at both points, and the published
    // Exhibit 30-36 travel speed of 23.67 mi/h.
    await page.goto('/hcm18');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#APSRC_input').selectOption('computed');
    // Two default approaches, carrying the Exhibit 30-35 adjusted volumes.
    await expect(page.locator('#AVLT_input_0')).toHaveValue('74.8');
    await expect(page.locator('#AVTH_input_1')).toHaveValue('991.7');
    await expect(page.locator('#AVO_input_0')).toHaveValue('1086.15');
    await expect(page.locator('#APT_input')).toHaveValue('0.25');
    // The per-point delay field of measured mode is gone, so nothing published
    // is being supplied on this path.
    await expect(page.locator('#APD_input')).toHaveCount(0);

    await calculate.click();

    const row = (label: string) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('Travel Speed')).toContainText('23.67');
    await expect(row('Base Free-Flow Speed')).toContainText('40.78');
    await expect(row('Through Delay')).toContainText('18.31');
    // Σ d_ap,i = 0.1934 + 0.1947; the two per-point roundings accumulate
    // against the published 0.387.
    await expect(row('Access-Point Delay')).toContainText('0.388');
    await expect(page.getByText(/Segment LOS: C/)).toBeVisible();

    // The read-only per-point breakdown, one row per approach.
    // The delay columns print four decimals on purpose: the computed 0.1947
    // of the second point rounds to 0.195 at three, which reads as a
    // disagreement with the published 0.194 rather than the rounding it is.
    const out = page.locator('.ap-out tbody tr');
    await expect(out).toHaveCount(2);
    await expect(out.nth(0)).toContainText('0.193');
    await expect(out.nth(0)).toContainText('0.115');
    await expect(out.nth(1)).toContainText('0.194');
    await expect(out.nth(1)).toContainText('0.115');

    // Adding an approach adds a computed row, so the table follows the form
    // rather than being pinned to the two defaults.
    await page.getByRole('button', { name: 'Add Approach' }).click();
    await expect(page.locator('#AVLT_input_2')).toHaveValue('0');
    await calculate.click();
    await expect(page.locator('.ap-out tbody tr')).toHaveCount(3);
  });
});

test.describe('chapter 19 signalized intersection calculator', () => {
  test('reproduces the published pretimed timing-plan example', async ({ page }) => {
    // HCM Chapter 31, Section 2, pretimed phase duration example (Exhibit 31-7):
    // two-phase signal, through movements only, cycle 60 s, phases 33.3 s (EB/WB)
    // and 26.7 s (NB/SB) including the change period. Published X_c = 0.923; the
    // approach delays are hand-computed from Equations 19-19/19-26 in the library
    // integration suite: EB 30.0 C, WB 12.5 B, NB 37.4 D, SB 20.2 C,
    // intersection 26.8 s/veh LOS C.
    await page.goto('/hcm19');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#CYCLE_input').fill('60');
    await page.locator('#PHF_input').fill('1.0');
    await page.locator('#PHV_input').fill('0');

    const approaches = [
      { key: 'NB', thru: '665', phase: '26.7' },
      { key: 'SB', thru: '475', phase: '26.7' },
      { key: 'EB', thru: '855', phase: '33.3' },
      { key: 'WB', thru: '475', phase: '33.3' },
    ];
    for (const ap of approaches) {
      await page.locator(`#${ap.key}_VL_input`).fill('0');
      await page.locator(`#${ap.key}_VT_input`).fill(ap.thru);
      await page.locator(`#${ap.key}_VR_input`).fill('0');
      await page.locator(`#${ap.key}_LL_input`).fill('0');
      await page.locator(`#${ap.key}_LT_input`).fill('1');
      await page.locator(`#${ap.key}_LR_input`).fill('0');
      await page.locator(`#${ap.key}_TP_input`).fill(ap.phase);
      await page.locator(`#${ap.key}_LP_input`).fill('0');
    }

    await calculate.click();

    const row = (dir) => page.locator('tr', { has: page.locator(`th:text-is("${dir}")`) }).first();
    await expect(row('EB').locator('td').nth(1)).toHaveText('30.0');
    await expect(row('EB').locator('td').nth(2)).toHaveText('C');
    await expect(row('WB').locator('td').nth(1)).toHaveText('12.5');
    await expect(row('NB').locator('td').nth(1)).toHaveText('37.4');
    await expect(row('NB').locator('td').nth(2)).toHaveText('D');
    await expect(row('SB').locator('td').nth(1)).toHaveText('20.2');

    await expect(page.locator('tr', { hasText: 'Critical Volume-to-Capacity' }).locator('td')).toHaveText('0.92');
    await expect(page.locator('tr', { hasText: 'Intersection Control Delay' }).locator('td')).toHaveText('26.8');
    await expect(page.locator('.result-summary-badge .los-badge')).toHaveAttribute('aria-label', /Level of service C/);

    // Every run publishes a printable report; the link opens it with the same
    // numbers, the input echo, and the read-only diagram.
    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page).toHaveURL(/\/report$/);
    await expect(page.locator('.report-title')).toHaveText('Signalized Intersections');
    await expect(page.locator('tr', { hasText: 'Critical volume-to-capacity ratio' }).locator('td')).toHaveText('0.92');
    await expect(page.locator('tr', { hasText: 'Cycle length' }).locator('td')).toHaveText('60 s');
    await expect(page.locator('.report-diagram .signal-diagram svg')).toBeVisible();
    await expect(page.locator('.report-diagram .sd-cluster')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible();
  });

  test('the intersection diagram follows the inputs and highlights on hover', async ({ page }) => {
    await page.goto('/hcm19');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.signal-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /four-leg signalized intersection/);

    // Hovering a legend chip highlights that approach's movements and dims the rest.
    await page.locator('.sd-chip.eb').hover();
    await expect(page.locator('path.mv-eb').first()).toHaveClass(/active/);
    await expect(page.locator('path.mv-nb').first()).toHaveClass(/dim/);

    // The left-turn path renders dashed while permitted and solid once a
    // protected phase is set; the chip text follows.
    const nbLeft = page.locator('path.mv-nb').nth(1);
    await expect(nbLeft).toHaveAttribute('stroke-dasharray', '6 5');
    await page.locator('#NB_LP_input').fill('12');
    await expect(nbLeft).not.toHaveAttribute('stroke-dasharray', '6 5');
    await expect(page.locator('.sd-chip.nb')).toContainText('protected left');

    // Adding lanes widens the road: more dashed lane lines appear.
    const before = await page.locator('line.sd-lane-line').count();
    await page.locator('#NB_LT_input').fill('3');
    await expect(page.locator('line.sd-lane-line')).toHaveCount(before + 4);
  });

  test('signal-timed traffic animation pulses with the phases', async ({ page }) => {
    await page.goto('/hcm19');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    await expect(page.locator('.signal-diagram svg')).toBeVisible();
    await page.getByRole('button', { name: 'Animate traffic' }).click();
    const vehicles = page.locator('g.sd-veh');
    expect(await vehicles.count()).toBeGreaterThan(8);
    // A vehicle progresses over time (during some green window).
    const el = vehicles.first();
    const a = await el.boundingBox();
    await page.waitForTimeout(2500);
    const b = await el.boundingBox();
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(2);
    await page.getByRole('button', { name: 'Stop traffic' }).click();
    await expect(vehicles).toHaveCount(0);
  });

  test('volumes can be edited on the diagram and the 3D view toggles', async ({ page }) => {
    await page.goto('/hcm19');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready

    // The on-diagram editors two-way bind to the same state as the form.
    await page.locator('input[aria-label="NB through volume"]').fill('750');
    await expect(page.locator('#NB_VT_input')).toHaveValue('750');
    await page.locator('#EB_VL_input').fill('120');
    await expect(page.locator('input[aria-label="EB left-turn volume"]')).toHaveValue('120');

    // The shared 2D/3D toggle swaps in the rotatable projected view, which
    // keeps the legend highlighting and follows the same inputs.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    const svg3d = page.locator('.signal-diagram-3d svg');
    await expect(svg3d).toBeVisible();
    await expect(svg3d).toHaveAttribute('aria-label', /3D view/);
    await page.locator('.sd3-chip.wb').hover();
    await expect(page.locator('.signal-diagram-3d path.mv-wb').first()).toHaveClass(/active/);
    await expect(page.locator('.signal-diagram-3d path.mv-sb').first()).toHaveClass(/dim/);

    // Toggling back restores the editable plan view with the edited value.
    await page.locator('.view-toggle .vt-btn', { hasText: '2D' }).click();
    await expect(page.locator('input[aria-label="NB through volume"]')).toHaveValue('750');
  });
});

test.describe('chapter 20 TWSC calculator', () => {
  test('reproduces the published three-leg example problem on defaults', async ({ page }) => {
    // The page defaults are HCM Chapter 32, TWSC Example Problem 1. Published
    // answers: c_m,4 = 1,238, c_m,7 = 268, c_m,9 = 760, c_SH,NB = 521 veh/h;
    // d_4 = 8.3 s LOS A; NB lane 14.9 s LOS B (engine prints 15.0, within the
    // book's 0.5 s tolerance); d_A,WB = 2.9; d_I = 4.1 s/veh.
    await page.goto('/hcm20');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    const row = (label) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('Major WB left').locator('td').nth(2)).toHaveText('1238');
    await expect(row('Major WB left')).toContainText('8.3');
    await expect(row('Minor NB left').locator('td').nth(2)).toHaveText('268');
    await expect(row('Minor NB right').locator('td').nth(2)).toHaveText('760');
    await expect(row('NB lane 1').locator('td').nth(2)).toHaveText('521');
    await expect(row('NB lane 1')).toContainText('B');
    await expect(page.getByText(/Intersection Delay.*4\.1|4\.1 s\/veh/).first()).toBeVisible();

    // The run publishes a printable report with the TWSC diagram.
    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Two-Way STOP-Controlled Intersections');
    await expect(page.locator('.report-diagram .twsc-diagram svg')).toBeVisible();
  });

  test('the TWSC diagram follows the inputs and shows ranks', async ({ page }) => {
    await page.goto('/hcm20');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.twsc-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /three-leg two-way stop-controlled/);

    // Rank in the dash pattern: NB left is rank 3 on a T (dash 6 5), NB right
    // rank 2 (dash 10 6), major through rank 1 (no dash attribute).
    await expect(page.locator('path.mv-nb[stroke-dasharray="6 5"]')).toHaveCount(1);
    await expect(page.locator('path.mv-nb[stroke-dasharray="10 6"]')).toHaveCount(1);

    // On-diagram editing two-way binds to the form.
    await page.locator('input[aria-label="EB through volume"]').fill('480');
    await expect(page.locator('#V2_input')).toHaveValue('480');

    // Switching to four-leg redraws with the SB approach and its stop bar.
    await page.locator('#TYPE_input').selectOption('four_leg');
    await expect(diagram).toHaveAttribute('aria-label', /four-leg/);
    await expect(page.locator('.tw-chip.sb')).toBeVisible();

    // The 3D toggle swaps in the projected view.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    const svg3d = page.locator('.twsc-diagram-3d svg');
    await expect(svg3d).toBeVisible();
    await expect(svg3d).toHaveAttribute('aria-label', /four-leg two-way stop-controlled intersection, 3D view/);
  });
});

test.describe('chapter 20 pedestrian crossing mode', () => {
  // HCM Chapter 20 Section 5, driven by the three scenarios of Chapter 32 TWSC
  // Example Problem 2. Published totals and letters: A = 761 s LOS F,
  // B = 6.0 s LOS C, C = 3.0 s LOS A. The page prints one decimal, and the
  // engine's values sit inside the book's own tolerances (0.5% on Scenario A,
  // whose delay is published to three significant figures, and 0.5 s on the
  // other two), so the pins below are the printed values with the published
  // ones named alongside.
  const openPedestrianMode = async (page: Page) => {
    await page.goto('/hcm20');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#MODE_input').selectOption('pedestrian');
    await expect(page.locator('#PEDSCEN_input')).toBeVisible();
  };

  const calculate = async (page: Page) => {
    await page.locator('#hcm20ped').getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByTestId('ped-total-delay')).not.toBeEmpty();
  };

  test('scenario B is the default and reproduces 6.0 s at LOS C', async ({ page }) => {
    await openPedestrianMode(page);
    await expect(page.locator('#PEDSCEN_input')).toHaveValue('B');

    // Step 1 loads as the two-stage crossing of Scenario B.
    await expect(page.getByTestId('ped-stage-row-1')).toBeVisible();
    await expect(page.getByTestId('ped-stage-row-2')).toBeVisible();
    await expect(page.locator('#PEDL0_input')).toHaveValue('20');
    await expect(page.locator('#PEDN0_input')).toHaveValue('2');
    await expect(page.locator('#PEDV0_input')).toHaveValue('850');
    await expect(page.locator('#PEDMY_input')).toHaveValue('50');
    // AADT reaches Equation 20-95 through the K-factor, 1,700 / 0.08.
    await expect(page.getByTestId('ped-aadt-used')).toContainText('21250');

    await calculate(page);

    // The published Step 2 through Step 5 chain for a stage of Scenario B:
    // t_c = 6.0 s, P_b = 0.508, P_d = 0.758, d_g = 7.2 s, d_gd = 9.5 s,
    // h = 2.3 s, n = 4, and d_p,s = 3.0 s.
    const stage1 = page.getByTestId('ped-result-stage-1');
    await expect(stage1.locator('td').nth(1)).toHaveText('6.0');   // t_c
    await expect(stage1.locator('td').nth(4)).toHaveText('0.508'); // P_b
    await expect(stage1.locator('td').nth(5)).toHaveText('0.757'); // P_d, published 0.758
    await expect(stage1.locator('td').nth(6)).toHaveText('7.2');   // d_g
    await expect(stage1.locator('td').nth(7)).toHaveText('9.5');   // d_gd
    await expect(stage1.locator('td').nth(8)).toHaveText('2.3');   // h
    await expect(stage1.locator('td').nth(9)).toHaveText('4');     // n
    await expect(stage1.locator('td').nth(10)).toHaveText('3.0');  // stage delay
    // Both stages are identical by construction, so Equation 20-94 doubles it.
    await expect(page.getByTestId('ped-result-stage-2').locator('td').nth(10)).toHaveText('3.0');

    // The yield chain, P(Y_0) = 0 then the published P(Y_1) = 0.314.
    await expect(page.getByTestId('ped-yield-stage-1')).toContainText('P(Y_0) 0.000');
    await expect(page.getByTestId('ped-yield-stage-1')).toContainText('P(Y_1) 0.314');

    // Step 6 and Step 7. Exhibit 32-7: P_nd = 0.481, P_D = 0.207, LOS C.
    await expect(page.getByTestId('ped-total-delay')).toHaveText('6.0');
    await expect(page.getByTestId('ped-p-nd')).toHaveText('0.481');
    await expect(page.getByTestId('ped-p-d')).toHaveText('0.206');
    await expect(page.getByTestId('ped-los')).toContainText('C');
    // LOS is on the satisfaction basis of Exhibit 20-3, not on the delay, and
    // the page has to say so because 6.0 s reads like a very good delay.
    await expect(page.getByTestId('ped-los')).toContainText('dissatisfied');
    await expect(page.getByTestId('ped-delay-interpretation')).toContainText('Occasionally some delay');

    // The two-stage caveat is shown only where it applies.
    await expect(page.locator('.facility-summary')).toContainText('uses the first stage');
  });

  test('scenario A reproduces 761 s at LOS F', async ({ page }) => {
    await openPedestrianMode(page);
    await page.locator('#PEDSCEN_input').selectOption('A');

    // One 46-ft stage across all four lanes, no countermeasures, no yielding.
    await expect(page.getByTestId('ped-stage-row-1')).toBeVisible();
    await expect(page.getByTestId('ped-stage-row-2')).toHaveCount(0);
    await expect(page.locator('#PEDL0_input')).toHaveValue('46');
    await expect(page.locator('#PEDN0_input')).toHaveValue('4');
    await expect(page.locator('#PEDV0_input')).toHaveValue('1700');
    await expect(page.locator('#PEDMY_input')).toHaveValue('0');

    await calculate(page);

    // Published: t_c = 12.5 s, P_b = 0.771, P_d = 0.997, d_g = 761 s,
    // d_gd = 763 s, d_p = 761 s (the engine's 760.6 is inside the 0.5% band
    // of a three-significant-figure publication), P_nd = 0.003, LOS F.
    const stage1 = page.getByTestId('ped-result-stage-1');
    await expect(stage1.locator('td').nth(1)).toHaveText('12.5');  // t_c
    await expect(stage1.locator('td').nth(4)).toHaveText('0.771'); // P_b
    await expect(stage1.locator('td').nth(5)).toHaveText('0.997'); // P_d
    await expect(stage1.locator('td').nth(6)).toHaveText('760.6'); // d_g, published 761
    await expect(stage1.locator('td').nth(7)).toHaveText('762.6'); // d_gd, published 763
    await expect(page.getByTestId('ped-total-delay')).toHaveText('760.6');
    await expect(page.getByTestId('ped-p-nd')).toHaveText('0.003');
    await expect(page.getByTestId('ped-p-d')).toHaveText('0.862');
    await expect(page.getByTestId('ped-los')).toContainText('F');
    await expect(page.getByTestId('ped-delay-interpretation')).toContainText('exceeds tolerance level');

    // No refuge, so the two-stage caveat is absent here.
    await expect(page.locator('.facility-summary')).not.toContainText('uses the first stage');
  });

  test('scenario C reproduces 3.0 s at LOS A', async ({ page }) => {
    await openPedestrianMode(page);
    await page.locator('#PEDSCEN_input').selectOption('C');
    await expect(page.locator('#PEDMY_input')).toHaveValue('80');
    await expect(page.locator('#PEDRRFB_input')).toHaveValue('true');

    await calculate(page);

    // Published: P(Y_1) = 0.565, d_p,1 = 1.5 s, d_p = 3.0 s (the engine's 2.9
    // is inside the 0.5 s tolerance), P_nd = 0.670, P_D = 0.029, LOS A.
    await expect(page.getByTestId('ped-yield-stage-1')).toContainText('P(Y_1) 0.565');
    await expect(page.getByTestId('ped-result-stage-1').locator('td').nth(10)).toHaveText('1.5');
    await expect(page.getByTestId('ped-total-delay')).toHaveText('2.9');
    await expect(page.getByTestId('ped-p-nd')).toHaveText('0.670');
    await expect(page.getByTestId('ped-p-d')).toHaveText('0.029');
    await expect(page.getByTestId('ped-los')).toContainText('A');

    // The countermeasure the scenario adds is load-bearing rather than
    // decorative: clearing the RRFB indicator alone moves the letter to C.
    await page.locator('#PEDRRFB_input').selectOption('false');
    await calculate(page);
    await expect(page.getByTestId('ped-p-d')).toHaveText('0.156');
    await expect(page.getByTestId('ped-los')).toContainText('C');
  });

  test('the crossing diagram follows the staging, and the report carries it', async ({ page }) => {
    await openPedestrianMode(page);
    // The role and the label sit on the wrapper rather than the svg, which is
    // the convention of the other cross-section diagrams here.
    const diagram = page.locator('.pedx-diagram');
    await expect(diagram.locator('svg')).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /2-stage pedestrian crossing of 2 lanes at 850 veh\/h then 2 lanes at 850 veh\/h/);
    await expect(page.getByTestId('pedx-refuge')).toBeVisible();
    await expect(page.getByTestId('pedx-stage-1')).toHaveText('Stage 1 · 2 lanes · 20 ft · 850 veh/h');
    await expect(page.getByTestId('pedx-headline')).toHaveText('2-stage crossing · median refuge · 4.0 ft/s');

    // Editing a stage redraws it, and dropping to one stage removes the refuge.
    await page.locator('#PEDN0_input').fill('3');
    await expect(page.getByTestId('pedx-stage-1')).toHaveText('Stage 1 · 3 lanes · 20 ft · 850 veh/h');
    await page.getByRole('button', { name: 'Remove stage 2' }).click();
    await expect(page.getByTestId('pedx-refuge')).toHaveCount(0);
    await expect(page.getByTestId('pedx-headline')).toHaveText('One-stage crossing · 4.0 ft/s');

    // Switching scenarios restores the published staging, and a run publishes
    // a printable report carrying the crossing diagram and the LOS.
    await page.locator('#PEDSCEN_input').selectOption('B');
    await calculate(page);
    await expect(page.getByTestId('pedx-footline')).toHaveText('d_p 6.0 s · LOS C');
    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Pedestrian Crossing at a Two-Way STOP-Controlled Intersection');
    await expect(page.locator('.report-diagram .pedx-diagram svg')).toBeVisible();
  });

  test('a crossing with no stages cannot be sent to the engine', async ({ page }) => {
    // The binding rejects a stageless crossing, because the core's serde
    // defaults would otherwise analyze it to zero delay and LOS A. The page
    // never lets the user build one, which is the same guarantee one layer up.
    await openPedestrianMode(page);
    await page.locator('#PEDSCEN_input').selectOption('A');
    const remove = page.getByRole('button', { name: 'Remove stage 1' });
    await expect(remove).toBeDisabled();
    await calculate(page);
    await expect(page.getByTestId('ped-los')).toContainText('F');
  });
});

test.describe('chapter 21 AWSC calculator', () => {
  test('reproduces the published three-leg example problem on defaults', async ({ page }) => {
    // The page defaults are HCM Chapter 32, AWSC Example Problem 1. Published
    // answers (Exhibit 32-21): h_d,EB = 4.97 s, h_d,WB = 4.74 s (engine 4.75,
    // within the 0.1 s tolerance), h_d,SB = 5.70 s (engine 5.73); d_EB = 13.0
    // LOS B, d_WB = 13.5, d_SB = 10.6; intersection 12.8 s/veh LOS B.
    await page.goto('/hcm21');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    const row = (label) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('EB lane 1')).toContainText('4.97');
    await expect(row('EB lane 1')).toContainText('13.0');
    await expect(row('EB lane 1')).toContainText('B');
    await expect(row('WB lane 1')).toContainText('13.5');
    await expect(row('SB lane 1')).toContainText('10.6');
    await expect(page.getByText(/12\.8/).first()).toBeVisible();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('All-Way STOP-Controlled Intersections');
    await expect(page.locator('.report-diagram .awsc-diagram svg')).toBeVisible();
  });

  test('the AWSC diagram follows the leg configuration', async ({ page }) => {
    await page.goto('/hcm21');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.awsc-diagram svg');
    await expect(diagram).toBeVisible();
    // EP1 defaults: NB has zero lanes, so three legs.
    await expect(diagram).toHaveAttribute('aria-label', /3-leg all-way stop-controlled/);

    // Restoring the NB approach redraws as a four-leg intersection.
    await page.locator('#LC_nb_input').selectOption('1');
    await expect(diagram).toHaveAttribute('aria-label', /4-leg all-way stop-controlled/);

    // On-diagram editing targets lane 1 and two-way binds to the form.
    await page.locator('input[aria-label="EB through volume"]').fill('480');
    await expect(page.locator('#T_eb_0_input')).toHaveValue('480');

    // The 3D toggle swaps in the projected view.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    await expect(page.locator('.awsc-diagram-3d svg')).toHaveAttribute('aria-label', /all-way stop-controlled intersection, 3D view/);
  });
});

test.describe('chapter 22 roundabout calculator', () => {
  test('reproduces the published single-lane example problem on defaults', async ({ page }) => {
    // The page defaults are HCM Chapter 33, Roundabout Example Problem 1.
    // Published (Exhibit 33-8): c_NB 597, c_SB 618, c_EB 824, c_WB 694,
    // c_bypass,WB 851 veh/h; delays 22.6/14.0/22.0/26.8 with LOS C/B/C/D;
    // WB bypass 20.2 C; d_A,SB 4.7 A; intersection 17.5 s LOS C. The engine
    // prints 596/617/822/693/850 and 22.7/14.0/22.1/27.2, bypass 20.3,
    // intersection 17.7 C, all inside the chapter tolerances (5 veh/h,
    // 0.5 s/veh).
    await page.goto('/hcm22');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    const row = (label) => page.locator('.results-panel tr', { hasText: label }).first();
    await expect(row('NB')).toContainText('596');
    await expect(row('NB')).toContainText('22.7');
    await expect(row('NB')).toContainText('C');
    await expect(row('SB')).toContainText('617');
    await expect(row('EB')).toContainText('822');
    await expect(row('WB')).toContainText('693');
    await expect(page.getByText(/17\.7/).first()).toBeVisible();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Roundabouts');
    await expect(page.locator('.report-diagram .rb-diagram svg')).toBeVisible();
  });

  test('the roundabout diagram highlights entries and edits volumes', async ({ page }) => {
    await page.goto('/hcm22');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.rb-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /four-leg roundabout, 1 circulating lane/);

    // EP1 has two bypasses: WB yielding (dashed), SB nonyielding (solid).
    await expect(page.locator('path.rb-bypass')).toHaveCount(2);
    await expect(page.locator('path.rb-bypass.mv-wb')).toHaveAttribute('stroke-dasharray', '6 5');
    await expect(page.locator('path.rb-bypass.mv-sb')).not.toHaveAttribute('stroke-dasharray', '6 5');

    await page.locator('.rb-chip.eb').hover();
    await expect(page.locator('path.mv-eb').first()).toHaveClass(/active/);
    await expect(page.locator('path.mv-nb').first()).toHaveClass(/dim/);

    // On-diagram editing two-way binds to the form (NB through input).
    await page.locator('input[aria-label="NB through volume"]').fill('260');
    await expect(page.locator('#T_nb_input')).toHaveValue('260');

    // The 3D toggle swaps in the projected view.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    await expect(page.locator('.rb-diagram-3d svg')).toHaveAttribute('aria-label', /four-leg roundabout, 3D view/);
  });

  test('the traffic animation runs volume-weighted vehicles', async ({ page }) => {
    await page.goto('/hcm22');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    await expect(page.locator('.rb-diagram svg')).toBeVisible();

    await page.getByRole('button', { name: 'Animate traffic' }).click();
    const vehicles = page.locator('g.rb-veh');
    await expect(vehicles.first()).toBeVisible();
    expect(await vehicles.count()).toBeGreaterThan(10);

    // Vehicles actually move: the same element's position changes over time.
    const before = await vehicles.first().boundingBox();
    await page.waitForTimeout(900);
    const after = await vehicles.first().boundingBox();
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(3);

    await page.getByRole('button', { name: 'Stop traffic' }).click();
    await expect(vehicles).toHaveCount(0);
  });
});

test.describe('chapter 23 interchange calculator', () => {
  test('reproduces the published diamond example problem on defaults', async ({ page }) => {
    // The page defaults are HCM Chapter 34, Example Problem 1 (conventional
    // diamond). The library integration suite holds the O-D delays and ETTs
    // within 1.0 s/veh of Exhibit 34-16 with LOS exact; the engine prints an
    // interchange ETT of 50.4 s/veh, LOS C, and O-D A at 47.7 s ETT LOS C.
    //
    // Both dropped under library 0.3.1 (middleware 0.3.5), which evaluates the
    // Equation 19-26 incremental delay d2 with the Step 7 lane group capacity
    // instead of the per-lane capacity: interchange ETT was 52.4 and O-D A was
    // 47.9 before. The published Exhibit 34-16 values are 52.4 and 47.5, and
    // Example Problem 1 is the one worked example whose published d2
    // reproduces only per-lane, so it is treated as a book defect outvoted by
    // the equation text and by Example Problems 3 and 5. Every LOS letter here
    // still matches the published one.
    await page.goto('/hcm23');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    const rowA = page.locator('.results-panel tbody tr', { has: page.locator('th:text-is("A")') }).first();
    await expect(rowA).toContainText('47.7');
    await expect(rowA).toContainText('C');
    await expect(page.getByText(/Interchange LOS: C/)).toBeVisible();
    // Scoped to the interchange ETT row: the previous bare /52\.4/ page-wide
    // match also hit two unrelated cells carrying the same digits.
    await expect(page.locator('tr', { hasText: 'Interchange Experienced Travel Time' }))
      .toContainText('50.4');

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Ramp Terminals and Alternative Intersections');
  });

  test('the DDI form loads Example Problem 5 and reproduces its answer', async ({ page }) => {
    // Switching to the diverging diamond loads Chapter 34 Example Problem 5
    // as defaults. The engine's demand-weighted interchange ETT is 29.8 s/veh
    // LOS B against the published 34.9 C (library-documented deviation), down
    // from 34.8 C before library 0.3.1 evaluated the Equation 19-26
    // incremental delay with the lane group capacity. That correction is what
    // makes O-D E reproduce its published 24.7 s/veh and LOS B exactly, since
    // it runs entirely on the 3-lane external crossover at X = 0.84. The
    // westbound O-Ds run short and carry the aggregate down, but their
    // Exhibit 34-64 movement delays are already documented in the library
    // suite as not reproducible from the printed equations. The Exhibit 23-10
    // B/C boundary is 30 s/veh, so the aggregate lands 0.2 s/veh on the far
    // side of it and grades B against the published C.
    await page.goto('/hcm23');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FORM_input').selectOption('Ddi');
    await expect(page.locator('#CYCLE_input')).toHaveValue('70');
    await expect(page.locator('.dd-diagram svg')).toHaveAttribute('aria-label', /diverging diamond/);
    await calculate.click();

    await expect(page.getByText(/Interchange LOS: B/)).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Interchange Experienced Travel Time' }))
      .toContainText('29.8');

    // Lane configuration drives the geometry: dropping EB to two shared
    // lanes removes a lane line and merges the E left onto the through lane.
    const before = await page.locator('line.dd-lane-line').count();
    await page.locator('#DDIEB_input').selectOption('TwoLaneShared');
    expect(await page.locator('line.dd-lane-line').count()).toBe(before - 2);
    await page.locator('#DDIEB_input').selectOption('ThreeLaneExclusive');

    // 3D view carries the form and the overpass deck.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    await expect(page.locator('.dd-diagram-3d svg')).toHaveAttribute('aria-label', /diverging diamond interchange, 3D view/);
    await expect(page.locator('.dd-diagram-3d path.dd3-deck')).toHaveCount(1);
  });

  test('the parclo form loads Example Problem 2 and reproduces its answer', async ({ page }) => {
    // Switching to the Parclo A-2Q loads Chapter 34 Example Problem 2 as
    // defaults, the I-75 at Newberry Avenue interchange: C = 140 s, PHF 0.95,
    // D = 800 ft, and the Exhibit 34-19 demands. It is the first form on this
    // page whose lane groups are not the diamond skeleton, so it is also the
    // check that the composed movement names of library 0.3.3 survive the
    // round trip from this page's config object through wasm.
    //
    // The engine reads an interchange ETT of 61.5 s/veh and LOS D against the
    // published 61.3 and D (Exhibit 34-29 totals row). Per O-D: A reads 99.5 s
    // LOS E on its published value, and I reads 34.6 s LOS C against a
    // published 33.8, the 0.8 being the Exhibit 34-22 lane utilization defect
    // reaching the internal through-and-right group I runs on. O-D F is the
    // failing movement at v/c 1.02 with a queue 1.96 times its bay, which is
    // what puts it on LOS F whatever its travel time.
    await page.goto('/hcm23');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FORM_input').selectOption('ParcloA2Q');
    await expect(page.locator('#CYCLE_input')).toHaveValue('140');
    await expect(page.locator('#PHF_input')).toHaveValue('0.95');
    await expect(page.locator('#DIST_input')).toHaveValue('800');
    // Equation 23-50 takes a design speed per diverted movement, and the two
    // loop O-Ds of this example do not share the interchange-wide one.
    await expect(page.locator('#LOOPD_input')).toHaveValue('1200');
    await expect(page.locator('#LOOPS_input')).toHaveValue('25');
    await calculate.click();

    await expect(page.getByText(/Interchange LOS: D/)).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Interchange Experienced Travel Time' }))
      .toContainText(/61\.[56]/);

    const rowA = page.locator('.results-panel tbody tr', { has: page.locator('th:text-is("A")') }).first();
    await expect(rowA).toContainText('99.5');
    await expect(rowA).toContainText('E');
    const rowI = page.locator('.results-panel tbody tr', { has: page.locator('th:text-is("I")') }).first();
    await expect(rowI).toContainText('34.6'); // published 33.8
    await expect(rowI).toContainText('C');

    // The other five Exhibit 23-17 parclos are structurally supported by the
    // engine and unvalidated, so they get no selector entry and the note says
    // why rather than leaving their absence unexplained. The fourth entry is
    // the SPUI, which does have a published example (Example Problem 7).
    await expect(page.locator('#FORM_input option')).toHaveCount(4);
    await expect(page.locator('.beta-note')).toContainText('A-4Q');
    await expect(page.locator('.beta-note')).not.toContainText('SPUI of Exhibit');
  });

  test('the SPUI form loads Example Problem 7 and reproduces its answer', async ({ page }) => {
    // Switching to the single-point urban interchange loads Chapter 34 Example
    // Problem 7 as defaults, I-95 at University Drive: C = 110 s, PHF 0.95, and
    // the Exhibit 34-72 demands. It is the first form on this page with no
    // internal link and the first with a lane group that runs in two phases,
    // so it is also the check that the library 0.3.4
    // `protected_permitted_left` object survives the round trip from this
    // page's config object through wasm.
    //
    // The engine reads an interchange ETT of 45.4 s/veh and LOS C against the
    // published 48.3 and C (Exhibit 34-82 totals row). Eight of the ten
    // published O-D LOS letters reproduce; D and E do not, and they are the
    // two nearest an Exhibit 23-10 band edge. The gap is the Exhibit
    // 34-75/34-76 saturation flow worksheets, which were carried over from a
    // superseded edition and which the page's own note enumerates.
    await page.goto('/hcm23');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FORM_input').selectOption('Spui');
    await expect(page.locator('#CYCLE_input')).toHaveValue('110');
    await expect(page.locator('#PHF_input')).toHaveValue('0.95');
    await expect(page.locator('#YAR_input')).toHaveValue('8');
    // A SPUI has one signalized point, so there is no spacing to enter. The
    // field is withheld rather than shown at zero, because its min="100" would
    // block the form from submitting and Calculate would silently do nothing.
    await expect(page.locator('#DIST_input')).toHaveCount(0);
    // The two arterial lefts run twice per cycle and carry the Equation 31-95
    // unblocked green, which the other eight lane groups do not.
    await expect(page.locator('#LG_EbExtLeft_gu')).toHaveValue('13.01');
    await expect(page.locator('#LG_WbExtLeft_gu')).toHaveValue('11.78');
    await expect(page.locator('#LG_NbRampLeft_gu')).toHaveCount(0);
    await expect(page.locator('.spui-note')).toContainText('0.967');

    await calculate.click();
    await expect(page.getByText(/Interchange LOS: C/)).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Interchange Experienced Travel Time' }))
      .toContainText('45.4');

    // One signalized point means no O-D leaves the arterial and rejoins it, so
    // every EDTT is exactly zero and every ETT is its movement's control delay.
    // That is the property Exhibit 34-82 shows and the one that separates this
    // form from every other on the page.
    const rows = page.locator('.results-panel tbody tr');
    for (const [letter, ett, los] of [['A', '27.7', 'B'], ['B', '64.0', 'D'], ['I', '50.3', 'C']]) {
      const row = rows.filter({ has: page.locator(`th:text-is("${letter}")`) }).first();
      await expect(row).toContainText(ett);
      await expect(row).toContainText(los);
    }
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
      const cells = rows.filter({ has: page.locator(`th:text-is("${letter}")`) }).first().locator('td');
      // Columns are demand, control delay, EDTT, ETT, LOS.
      await expect(cells.nth(2)).toHaveText('0.0');
      await expect(cells.nth(3)).toHaveText(await cells.nth(1).innerText());
    }
  });

  test('the SPUI diagram draws one junction and puts every left across the opposing through', async ({ page }) => {
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#FORM_input').selectOption('Spui');

    const diagram = page.locator('.sp-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /Single-point urban interchange/);
    // Plan view only. The crossing of the left turns with the through
    // movements is a planar fact, and the shared Camera3DSvg projection would
    // foreshorten the four paths into each other at the centre of the deck,
    // which is exactly where they have to stay legible.
    await expect(page.locator('.panel-actions .view-toggle')).toHaveCount(0);
    // One signalized point, not two ramp terminals.
    await expect(page.locator('.sp-diagram circle.sp-signal')).toHaveCount(1);
    await expect(diagram).toContainText('C = 110 s');
    await expect(diagram).toContainText('EB 13.01 · WB 11.78');

    // The picture has to give the same answer as the Exhibit 34-73 phase table,
    // so the paths are sampled rather than eyeballed. Phase 1 runs both
    // arterial lefts (NEMA 1+5) and phase 3 runs both ramp lefts (3+8), so
    // neither pair may cross itself; what each left must cross is the opposing
    // through, which is why the arterial lefts are permitted in phase 2.
    const crosses = await page.evaluate(() => {
      const at = (od: string, n: number) => {
        const p = document.querySelector(`.sp-diagram path[data-od="${od}"]`) as SVGPathElement;
        const len = p.getTotalLength();
        return Array.from({ length: n }, (_, i) => {
          const q = p.getPointAtLength((i * len) / (n - 1));
          return [q.x, q.y] as [number, number];
        });
      };
      // Two polylines cross if any pair of their segments intersects.
      const seg = (a: number[], b: number[], c: number[], d: number[]) => {
        const s = (p: number[], q: number[], r: number[]) =>
          Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
        return s(a, b, c) !== s(a, b, d) && s(c, d, a) !== s(c, d, b);
      };
      const cross = (u: string, v: string) => {
        const A = at(u, 400), B = at(v, 400);
        for (let i = 1; i < A.length; i++) {
          for (let j = 1; j < B.length; j++) if (seg(A[i - 1], A[i], B[j - 1], B[j])) return true;
        }
        return false;
      };
      return {
        ebLeftVsWbLeft: cross('E', 'H'),
        nbLeftVsSbLeft: cross('A', 'D'),
        ebLeftVsWbThrough: cross('E', 'J'),
        wbLeftVsEbThrough: cross('H', 'I'),
        nbLeftVsEbThrough: cross('A', 'I'),
        sbLeftVsWbThrough: cross('D', 'J'),
      };
    });
    expect(crosses).toEqual({
      ebLeftVsWbLeft: false,
      nbLeftVsSbLeft: false,
      ebLeftVsWbThrough: true,
      wbLeftVsEbThrough: true,
      nbLeftVsEbThrough: true,
      sbLeftVsWbThrough: true,
    });

    // Hovering a group chip isolates its O-D paths.
    await page.locator('.sp-chip.chip-ebg').hover();
    await expect(page.locator('.sp-diagram path[data-od="E"]')).toHaveClass(/active/);
    await expect(page.locator('.sp-diagram path[data-od="A"]')).toHaveClass(/dim/);
    await page.mouse.move(0, 0);

    // On-diagram O-D editing two-way binds to the form.
    await page.locator('input[aria-label="O-D I demand"]').fill('700');
    await expect(page.locator('#OD_i_input')).toHaveValue('700');
    await page.locator('input[aria-label="O-D I demand"]').fill('865');

    // After a run the movement carries its own O-D LOS rather than its group
    // identity, and the chip reports the poorest letter in its group.
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByText(/Interchange LOS: C/)).toBeVisible();
    await expect(page.locator('.sp-diagram path[data-od="B"]')).toHaveAttribute('data-los', 'D');
    await expect(page.locator('.sp-diagram path[data-od="A"]')).toHaveAttribute('data-los', 'B');
    await expect(page.locator('.sp-chip.chip-nboff')).toContainText('worst LOS D');

    // Animation runs and stops.
    await page.getByRole('button', { name: 'Animate traffic' }).click();
    expect(await page.locator('g.sp-veh').count()).toBeGreaterThan(8);
    await page.getByRole('button', { name: 'Stop traffic' }).click();
    await expect(page.locator('g.sp-veh')).toHaveCount(0);
  });

  test('the parclo diagram isolates O-Ds, edits demands, and colours by LOS', async ({ page }) => {
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#FORM_input').selectOption('ParcloA2Q');

    const diagram = page.locator('.pc-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /Parclo A-2Q interchange/);
    // The parclo has a plan view only, so the 2D/3D toggle is not offered.
    await expect(page.locator('.panel-actions .view-toggle')).toHaveCount(0);

    // Hovering a group chip isolates its O-D paths.
    await page.locator('.pc-chip.chip-ebg').hover();
    await expect(page.locator('.pc-diagram path[data-od="I"]')).toHaveClass(/active/);
    await expect(page.locator('.pc-diagram path[data-od="A"]')).toHaveClass(/dim/);

    // On-diagram O-D editing two-way binds to the form.
    await page.locator('input[aria-label="O-D I demand"]').fill('700');
    await expect(page.locator('#OD_i_input')).toHaveValue('700');

    // After a run the movement carries its own O-D LOS rather than its group
    // identity, and the chip reports the poorest letter in its group.
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.getByText(/Interchange LOS: D/)).toBeVisible();
    await expect(page.locator('.pc-diagram path[data-od="F"]')).toHaveAttribute('data-los', 'F');
    await expect(page.locator('.pc-diagram path[data-od="C"]')).toHaveAttribute('data-los', 'B');
    await expect(page.locator('.pc-chip.chip-ebg')).toContainText('worst LOS F');

    // Animation runs and stops.
    await page.getByRole('button', { name: 'Animate traffic' }).click();
    expect(await page.locator('g.pc-veh').count()).toBeGreaterThan(8);
    await page.getByRole('button', { name: 'Stop traffic' }).click();
    await expect(page.locator('g.pc-veh')).toHaveCount(0);
  });

  test('the diamond diagram groups O-Ds, edits demands, and animates', async ({ page }) => {
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    const diagram = page.locator('.dd-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /conventional diamond interchange/);

    // Hovering a group chip isolates its O-D paths.
    await page.locator('.dd-chip.ebg').hover();
    await expect(page.locator('path.mv-ebg').first()).toHaveClass(/active/);
    await expect(page.locator('path.mv-wbg').first()).toHaveClass(/dim/);

    // On-diagram O-D editing two-way binds to the form.
    await page.locator('input[aria-label="O-D I demand"]').fill('700');
    await expect(page.locator('#OD_i_input')).toHaveValue('700');

    // Animation runs and stops.
    await page.getByRole('button', { name: 'Animate traffic' }).click();
    expect(await page.locator('g.dd-veh').count()).toBeGreaterThan(8);
    await page.getByRole('button', { name: 'Stop traffic' }).click();
    await expect(page.locator('g.dd-veh')).toHaveCount(0);
  });
});

test.describe('chapter 23 part C alternative intersections', () => {
  test('the RCUT form reproduces Example Problem 13 from demands alone', async ({ page }) => {
    // Part C defaults are HCM Chapter 34, Example Problem 13 (three-legged
    // RCUT with STOP signs). The page derives the Exhibit 34-128 junction
    // inputs from the demands and site parameters: minor approach 344 veh/h
    // against 444 conflicting at 7.22/3.36 s headways. Published movement
    // results (Exhibit 34-129): EB L ETT 55.2 E (engine prints 55.1, junction
    // delays 22.9 + 16.4 against the book's rounded 22.9 + 16.3), EB R 22.9 C,
    // NB L 13.0 B, majors free-flowing at A.
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled();
    await calculate.click();

    const results = page.locator('.results-panel');
    await expect(results).toContainText('7.22');
    await expect(results).toContainText('3.36');
    const ebl = results.locator('tbody tr', { has: page.locator('th:text-is("EB L")') }).first();
    await expect(ebl).toContainText('22.9 + 16.4');
    await expect(ebl).toContainText('55.1');
    await expect(ebl).toContainText('E');
    const nbl = results.locator('tbody tr', { has: page.locator('th:text-is("NB L")') }).first();
    await expect(nbl).toContainText('13.0');
    await expect(nbl).toContainText('B');
    await expect(page.getByText(/Intersection LOS: A/)).toBeVisible();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Ramp Terminals and Alternative Intersections');
  });

  test('the RCUT diagram isolates movements, edits demands, and colours by LOS', async ({ page }) => {
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');

    const diagram = page.locator('.rc-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /restricted crossing U-turn/);

    // Hovering a movement chip isolates that path.
    await page.locator('.rc-chip.chip-ebl').hover();
    await expect(page.locator('path.mv-ebl')).toHaveClass(/active/);
    await expect(page.locator('path.mv-nbt')).toHaveClass(/dim/);
    await page.locator('.rc-note').hover();

    // On-diagram demand editing two-way binds to the form field.
    await page.locator('input[aria-label="EBL demand"]').fill('210');
    await expect(page.locator('#PC_OD_ebl_input')).toHaveValue('210');

    // After a run each path carries its movement LOS as a class. The EB left
    // is the movement the RCUT penalises, so it is the one worth asserting.
    await page.locator('#PC_OD_ebl_input').fill('150');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.locator('path.mv-ebl')).toHaveClass(/los-[a-f]/);
  });

  test('the signalized RCUT form reproduces Example Problem 14', async ({ page }) => {
    // Chapter 34 Example Problem 14 (four-legged RCUT with signals): the twelve
    // Exhibit 34-132 junction delays enter as inputs, so Exhibit 34-133
    // reproduces exactly. Equation 23-62 weights by flow rate, not raw demand:
    // the Exhibit 34-130 demands sum to 3,250 veh/h and the published total of
    // 3,500 is the flow-rate total. The engine lands at 22.854 s/veh, which
    // prints as 22.9 at one decimal against the book's rounded 22.8.
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');
    await page.locator('#PC_FORM_input').selectOption('RcutSignal');
    await expect(page.locator('#PC_DIST_input')).toHaveValue('800');
    await expect(page.locator('#PC_PHF_input')).toHaveValue('0.93');
    await expect(page.locator('#PC_OD_sbt_input')).toHaveValue('1900');
    await expect(page.locator('#PC_DJ_wM_ebR_input')).toHaveValue('35.1');
    await expect(page.locator('#PC_DJ_eM_sbL_input')).toHaveValue('10.8');
    await expect(page.getByText(/demands sum to 3,250/)).toBeVisible();
    await page.getByRole('button', { name: 'Calculate' }).click();

    const results = page.locator('.results-panel');
    const row = (label: string) =>
      results.locator('tbody tr', { has: page.locator(`th:text-is("${label}")`) }).first();
    // Exhibit 34-133, all twelve movements.
    for (const [label, ett, los] of [
      ['NB L', '37.3', 'D'], ['SB L', '18.4', 'B'],
      ['NB T', '10.5', 'B'], ['SB T', '13.0', 'B'],
      ['NB R', '13.2', 'B'], ['SB R', '7.9', 'A'],
      ['EB L', '79.4', 'E'], ['WB L', '72.9', 'E'],
      ['EB T', '82.1', 'F'], ['WB T', '67.8', 'E'],
      ['EB R', '35.1', 'D'], ['WB R', '12.4', 'B'],
    ]) {
      await expect(row(label)).toContainText(ett);
      await expect(row(label)).toContainText(los);
    }
    // The three rerouted-journey movements carry the Equation 23-59 EDTT.
    await expect(row('EB T')).toContainText('21.8');
    await expect(row('NB T')).toContainText('4.1 + 6.4');
    await expect(results).toContainText('22.9');
    await expect(page.getByText(/Intersection LOS: C/)).toBeVisible();
  });

  test('the signalized RCUT diagram isolates an approach, edits demands, and colours by LOS', async ({ page }) => {
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');
    await page.locator('#PC_FORM_input').selectOption('RcutSignal');

    const diagram = page.locator('.rs-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /four-legged with signals/);
    // The four signalized junctions are what distinguishes this form from the
    // three-legged STOP-controlled RCUT, so the picture has to carry all four.
    await expect(diagram.locator('.rs-signal')).toHaveCount(4);

    // Twelve chips would overwhelm the picture, so the legend groups the
    // movements by approach and a hover isolates all three of that approach.
    await page.locator('.rs-chip.chip-eb').hover();
    await expect(page.locator('path.mv-ebl')).toHaveClass(/active/);
    await expect(page.locator('path.mv-ebt')).toHaveClass(/active/);
    await expect(page.locator('path.mv-nbt')).toHaveClass(/dim/);
    await page.locator('.rs-note').hover();

    // On-diagram demand editing two-way binds to the form field.
    await page.locator('input[aria-label="EBT demand"]').fill('360');
    await expect(page.locator('#PC_OD_ebt_input')).toHaveValue('360');

    // After a run each path carries its own movement LOS as a class. The EB
    // through is the movement the RCUT reroutes furthest, so it is the one
    // worth asserting alongside a major-street movement that is not rerouted.
    await page.locator('#PC_OD_ebt_input').fill('300');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.locator('path.mv-ebt')).toHaveClass(/los-[a-f]/);
    await expect(page.locator('path.mv-sbt')).toHaveClass(/los-[a-f]/);
  });

  test('the MUT form reproduces Example Problem 15', async ({ page }) => {
    // Chapter 34 Example Problem 15 (four-legged MUT): the Exhibit 34-137
    // junction delays enter as inputs, so Exhibit 34-138 reproduces exactly:
    // WB left 20.2 + 34.6 + 12.3 + EDTT 20.4 = 87.5 LOS F, NB left 78.0 E.
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');
    await page.locator('#PC_FORM_input').selectOption('Mut');
    await expect(page.locator('#PC_DIST_input')).toHaveValue('600');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await calculate.click();

    const results = page.locator('.results-panel');
    const wbl = results.locator('tbody tr', { has: page.locator('th:text-is("WB L")') }).first();
    await expect(wbl).toContainText('87.5');
    await expect(wbl).toContainText('F');
    const nbl = results.locator('tbody tr', { has: page.locator('th:text-is("NB L")') }).first();
    await expect(nbl).toContainText('78.0');
    await expect(nbl).toContainText('E');
    await expect(page.getByText(/Intersection LOS: C/)).toBeVisible();
  });

  test('the MUT diagram isolates an approach, edits demands, and colours by LOS', async ({ page }) => {
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');
    await page.locator('#PC_FORM_input').selectOption('Mut');

    const diagram = page.locator('.mu-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /median U-turn intersection/);

    // Twelve chips would overwhelm the picture, so the legend groups the
    // movements by approach and a hover isolates all three of that approach.
    await page.locator('.mu-chip.chip-nb').hover();
    await expect(page.locator('path.mv-nbl')).toHaveClass(/active/);
    await expect(page.locator('path.mv-nbt')).toHaveClass(/active/);
    await expect(page.locator('path.mv-sbt')).toHaveClass(/dim/);
    await page.locator('.mu-note').hover();

    // On-diagram demand editing two-way binds to the form field.
    await page.locator('input[aria-label="NBL demand"]').fill('310');
    await expect(page.locator('#PC_OD_nbl_input')).toHaveValue('310');

    // After a run each path carries its own movement LOS as a class. The NB
    // left is the movement the MUT penalises, so it is the one worth asserting.
    await page.locator('#PC_OD_nbl_input').fill('280');
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.locator('path.mv-nbl')).toHaveClass(/los-[a-f]/);
    await expect(page.locator('path.mv-nbt')).toHaveClass(/los-[a-f]/);
  });

  test('the DLT diagram presents the three component intersections', async ({ page }) => {
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');
    await page.locator('#PC_FORM_input').selectOption('Dlt');

    const diagram = page.locator('.dl-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /partial displaced left-turn intersection/);
    // The signals carry the same 1/2/3 numbering as the delay table.
    await expect(page.locator('.dl-signal')).toHaveCount(3);

    await page.locator('.dl-chip.chip-ebl').hover();
    await expect(page.locator('path.mv-ebl')).toHaveClass(/active/);
    await expect(page.locator('path.mv-wbl')).toHaveClass(/dim/);
    await page.locator('.dl-note').hover();

    // The dimension tracks the DLT roadway distance input.
    await page.locator('#PC_TD_input').fill('420');
    await expect(diagram).toContainText('420 ft');
    await expect(diagram).toHaveAttribute('aria-label', /420 ft/);
    await page.locator('#PC_TD_input').fill('350');

    // A DLT has one intersection LOS rather than one per movement, so a run
    // adds that letter as a class on every path and reports it on a badge.
    await page.getByRole('button', { name: 'Calculate' }).click();
    await expect(page.locator('path.mv-ebl')).toHaveClass(/los-c/);
    await expect(page.locator('.dl-los')).toContainText('Intersection LOS C');
    // The computed offset is bound back onto the picture.
    await expect(diagram).toContainText('TT_DLT 6.8 s');
    await expect(diagram).toContainText('O_SUPP 45.2 s');
  });

  test('the DLT form reproduces Example Problem 16', async ({ page }) => {
    // Chapter 34 Example Problem 16 (partial DLT): supplemental-intersection
    // offset TT_DLT 6.8 s and O_SUPP 45.2 s (published rounds to 7 and 45),
    // weighted-average ETT 28.5 s/veh, LOS C by the Chapter 19 thresholds.
    await page.goto('/hcm23');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.locator('#PART_input').selectOption('C');
    await page.locator('#PC_FORM_input').selectOption('Dlt');
    await expect(page.locator('#PC_TOTALOD_input')).toHaveValue('5594');
    await page.getByRole('button', { name: 'Calculate' }).click();

    const results = page.locator('.results-panel');
    await expect(results).toContainText('6.8 s');
    await expect(results).toContainText('45.2 s');
    await expect(results).toContainText('28.5 s/veh');
    await expect(page.getByText(/DLT Intersection LOS: C/)).toBeVisible();
  });
});

test.describe('chapter 24 pedestrian and bicycle path calculator', () => {
  test('reproduces the published shared-use path pedestrian example', async ({ page }) => {
    // HCM Chapter 35, Example Problem 1 part 1: 100 bikes/h each direction,
    // PHF 0.83, 4.0 mi/h pedestrian and 16.0 mi/h bicycle speeds. Published:
    // F_p = 90, F_m = 151, F = 166 events/h, LOS E (Exhibit 24-4).
    await page.goto('/hcm24');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#KIND_input').selectOption('shared_path');
    await page.locator('#SBS_input').fill('100');
    await page.locator('#SBO_input').fill('100');
    await page.locator('#SPHF_input').fill('0.83');
    await page.locator('#SPS_input').fill('4.0');
    await page.locator('#SBSP_input').fill('16.0');
    await calculate.click();

    await expect(page.locator('.results-panel')).toContainText('90');
    await expect(page.locator('.results-panel')).toContainText('151');
    await expect(page.locator('.results-panel')).toContainText('166');
    await expect(page.locator('.results-panel .los-badge').first()).toHaveAttribute('aria-label', /Level of service E/);
  });

  test('reproduces the published bicycle BLOS example', async ({ page }) => {
    // HCM Chapter 35, Example Problem 2: 10-ft path, no centerline, 3-mi
    // segment, 340 users/h two-way at a 50/50 split, PHF 0.90, Exhibit 24-6
    // mode defaults. Published: 2 effective lanes, BLOS 2.69, LOS D.
    await page.goto('/hcm24');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#KIND_input').selectOption('bicycle');
    await page.locator('#BPW_input').fill('10');
    await page.locator('#BSL_input').fill('3');
    await page.locator('#BTD_input').fill('340');
    await page.locator('#BPHF_input').fill('0.90');
    await calculate.click();

    await expect(page.locator('.results-panel')).toContainText('2.69');
    await expect(page.locator('.results-panel .los-badge').first()).toHaveAttribute('aria-label', /Level of service D/);

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Off-Street Pedestrian and Bicycle Facilities');
    await expect(page.locator('.report-diagram .path-diagram svg')).toBeVisible();
  });

  test('the path diagram mixes modes and edits demand', async ({ page }) => {
    await page.goto('/hcm24');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 }); // hydration + wasm ready
    await page.locator('#KIND_input').selectOption('bicycle');
    const diagram = page.locator('.path-diagram svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAttribute('aria-label', /off-street bicycle path, 10 ft wide/);

    // The five-mode animation runs by default.
    expect(await page.locator('.path-diagram g.pd-user').count()).toBeGreaterThan(8);
    await page.locator('.pd-chip.u-ped').hover();
    await expect(page.locator('.path-diagram g.u-ped').first()).toHaveClass(/active/);
    await expect(page.locator('.path-diagram g.u-bike').first()).toHaveClass(/dim/);

    // On-diagram demand editing two-way binds to the form.
    await page.locator('.path-diagram input[aria-label="primary demand (per hour)"]').fill('420');
    await expect(page.locator('#BTD_input')).toHaveValue('420');

    // Width follows the form.
    await page.locator('#BPW_input').fill('14');
    await expect(diagram).toHaveAttribute('aria-label', /14 ft wide/);
  });
});

test.describe('chapter 15 two-lane highway calculator', () => {
  test('page loads with its segment controls', async ({ page }) => {
    await page.goto('/hcm15');
    await expect(page).toHaveTitle(/Two-Lane Highways/);
    await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
  });

  test('facility strip and segments table share selection', async ({ page }) => {
    await page.goto('/hcm15');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: '+ Add Segment' }).first().click();
    await expect(page.locator('.facility-seg')).toHaveCount(2);

    // Clicking a strip segment highlights it and its table row.
    await page.locator('.facility-seg').nth(1).click();
    await expect(page.locator('.facility-seg').nth(1)).toHaveClass(/seg-selected/);
    await expect(page.locator('.seg-table tbody tr').nth(1)).toHaveClass(/seg-selected/);

    // Clicking the other table row moves the selection both places.
    await page.locator('.seg-table tbody tr').first().click();
    await expect(page.locator('.seg-table tbody tr').first()).toHaveClass(/seg-selected/);
    await expect(page.locator('.facility-seg').first()).toHaveClass(/seg-selected/);
    await expect(page.locator('.facility-seg').nth(1)).not.toHaveClass(/seg-selected/);
  });

  test('the 3D facility slabs select in sync with the strip and the table', async ({ page }) => {
    await fillTwoLane(page, CASE3_TWOLANE);

    // Every segment gets its own slab, which is what makes one selectable at
    // all: the predecessor drew the facility as a single continuous surface.
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    const decks = page.locator('path.tl3-deck');
    await expect(decks).toHaveCount(5);
    await expect(page.locator('.tl3-wrap svg')).toHaveAttribute('aria-label', /two-lane highway facility 3D view, 5 segments/);

    // A tap (press and release in place) selects; the camera keeps drags.
    await decks.nth(2).click({ force: true });
    await expect(decks.nth(2)).toHaveClass(/selected/);
    await expect(page.locator('.seg-table tbody tr').nth(2)).toHaveClass(/seg-selected/);

    // The 2D strip shows the same selection when the view swaps back.
    await page.locator('.view-toggle .vt-btn', { hasText: '2D' }).click();
    await expect(page.locator('.facility-seg').nth(2)).toHaveClass(/seg-selected/);

    // And a strip pick carries into 3D.
    await page.locator('.facility-seg').nth(4).click();
    await page.locator('.view-toggle .vt-btn', { hasText: '3D' }).click();
    await expect(page.locator('path.tl3-deck').nth(4)).toHaveClass(/selected/);
  });

  test('the published examples print the same values as before the refactor', async ({ page }) => {
    // Chapter 15 Example Problem 1 (fixture case1) and the five-segment
    // facility (fixture case3), the same inputs tests/boundary/ch15_*.mjs
    // drives through the WASM boundary. These are the exact strings the page
    // printed before it was rewritten off direct DOM writes, so any drift in
    // the engine or in the porting of the calculation shows up here.
    await fillTwoLane(page, CASE1_TWOLANE);
    await expectTwoLaneOutputs(page, {
      ffs: ['56.833'],
      avgspd: ['53.676'],
      pf: ['67.714'],
      fd: ['10.092'],
      seglos: ['D'],
      los: 'Facility LOS: D',
      fdF: 'Facility Follower Density: 10.092',
    });

    await fillTwoLane(page, CASE3_TWOLANE);
    await expectTwoLaneOutputs(page, {
      ffs: ['62.434', '62.434', '62.434', '62.45', '62.434'],
      avgspd: ['58.812', '57.834', '58.878', '59.225', '58.873'],
      pf: ['69.69', '60.689', '67.993', '67.801', '67.666'],
      fd: ['10.715', '2.831', '8.251', '8.237', '8.764'],
      seglos: ['D', 'B', 'D', 'D', 'D'],
      los: 'Facility LOS: C',
      fdF: 'Facility Follower Density: 7.271',
    });
  });

  test('a completed run opens a printable report with the facility strip', async ({ page }) => {
    await fillTwoLane(page, CASE3_TWOLANE);

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Two-Lane Highways');
    await expect(page.locator('.report-los .los-badge')).toHaveText('C');
    // The report carries the facility, LOS chips and all, not a bare table.
    await expect(page.locator('.report-diagram .facility-seg')).toHaveCount(5);
    await expect(page.locator('.report-diagram .facility-seg .tls-los').first()).toHaveText('D');
  });
});

type TwoLaneSeg = {
  type: string;
  length: string;
  grade: string;
  spl: string;
  vi: string;
  vo: string;
  vc: string;
  phf: string;
  phv: string;
};

const CASE1_TWOLANE: TwoLaneSeg[] = [
  { type: 'Passing Constrained', length: '0.75', grade: '0', spl: '50', vi: '752', vo: '0', vc: '1', phf: '0.94', phv: '5' },
];

const CASE3_TWOLANE: TwoLaneSeg[] = [
  { type: 'Passing Constrained', length: '0.75', grade: '0', spl: '55', vi: '850', vo: '0', vc: '1', phf: '0.94', phv: '8' },
  { type: 'Passing Lane', length: '1.5', grade: '0', spl: '55', vi: '825', vo: '0', vc: '1', phf: '0.95', phv: '8' },
  { type: 'Passing Constrained', length: '1.0', grade: '0', spl: '55', vi: '820', vo: '0', vc: '1', phf: '0.95', phv: '8' },
  { type: 'Passing Zone', length: '0.5', grade: '0', spl: '55', vi: '800', vo: '500', vc: '1', phf: '0.94', phv: '7.5' },
  { type: 'Passing Constrained', length: '1.75', grade: '0', spl: '55', vi: '795', vo: '0', vc: '1', phf: '0.935', phv: '8' },
];

// Loads /hcm15, enters a facility, and runs it. The passing type goes in first
// because changing it resets that segment's demand volumes.
async function fillTwoLane(page: Page, segs: TwoLaneSeg[]) {
  await page.goto('/hcm15');
  const calculate = page.getByRole('button', { name: 'Calculate' });
  await expect(calculate).toBeEnabled({ timeout: 30_000 });

  for (let i = 1; i < segs.length; i++) {
    await page.getByRole('button', { name: '+ Add Segment' }).first().click();
  }

  await page.locator('#LW_input').fill('12');
  await page.locator('#SW_input').fill('6');
  await page.locator('#APD_input').fill('0');
  await page.locator('#PMHVFL_input').fill('0.4');

  for (let i = 0; i < segs.length; i++) {
    const n = i + 1;
    const s = segs[i];
    await page.locator(`#passing_type${n}`).selectOption(s.type);
    await page.locator(`#seg_length${n}`).fill(s.length);
    await page.locator(`#seg_grade${n}`).fill(s.grade);
    await page.locator(`#seg_Spl${n}`).fill(s.spl);
    await page.locator(`#vi_input${n}`).fill(s.vi);
    await page.locator(`#vo_input${n}`).fill(s.vo);
    await page.locator(`#vc_select${n}`).selectOption(s.vc);
    await page.locator(`#PHF_input${n}`).fill(s.phf);
    await page.locator(`#PHV_input${n}`).fill(s.phv);
  }
  await calculate.click();
  await expect(page.locator('#seglos1')).not.toBeEmpty();
}

async function expectTwoLaneOutputs(
  page: Page,
  want: { ffs: string[]; avgspd: string[]; pf: string[]; fd: string[]; seglos: string[]; los: string; fdF: string }
) {
  for (const key of ['ffs', 'avgspd', 'pf', 'fd', 'seglos'] as const) {
    for (let i = 0; i < want[key].length; i++) {
      await expect(page.locator(`#${key}${i + 1}`)).toHaveText(want[key][i]);
    }
  }
  await expect(page.locator('#los')).toHaveText(want.los);
  await expect(page.locator('#fdF')).toHaveText(want.fdF);
}

// ── Facility builder (phase 1a: the editor, no analysis) ─────────────────
//
// What is worth pinning here is not that the page renders. It is that the
// derived table follows the features live, that an override outlives a
// re-derivation, and that the two persistence layers do what they claim: the
// builder document round-trips the intent, and a fixture imports as segments
// with the missing feature layer stated rather than guessed at.
//
// The numbers come from the library's own Example Problem 1 fixture, which is
// read off disk rather than transcribed.
test.describe('facility builder', () => {
  // The library checkout sits beside this repo, the same place the boundary
  // suite looks for it.
  const LIB_CASES: string =
    process.env.HCM_LIB_CASES || join(process.cwd(), '..', 'transportations-library', 'tests', 'ExampleCases', 'hcm');
  const CASE1 = join(LIB_CASES, 'FreewayFacilities', 'case1.json');

  /** The whole editor sits behind `inert={!ready}`, so every test waits for the
   * wasm module the same way the chapter pages wait for Calculate. */
  async function openBuilder(page: Page) {
    // A previous test's autosave would otherwise be restored into this one.
    await page.addInitScript(() => window.localStorage.removeItem('hcm-builder:default'));
    await page.goto('/builder');
    // `inert` is not what Playwright's toBeEnabled() looks at, and the buttons
    // are in the SSR HTML, so gating on a button would let a test click before
    // the wasm module has initialized and the derivation would return nothing.
    // The editor publishes its own ready flag instead.
    await expect(page.getByTestId('builder-body')).toHaveAttribute('data-ready', 'true');
  }

  const typesOf = (page: Page) =>
    page.getByTestId('segment-row').evaluateAll((rows) =>
      rows.map((r) => (r as HTMLElement).dataset.segType)
    );

  /** Every field a feature carries lives in the editor its row opens, so a test
   * that edits one opens the row first, the same way a user does. */
  async function expandFeature(page: Page, id: string) {
    const toggle = page.getByTestId(`expand-${id}`);
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(page.locator(`[data-testid="feature-editor"][data-feature-id="${id}"]`)).toBeVisible();
  }

  async function setStation(page: Page, id: string, mi: number) {
    await expandFeature(page, id);
    const field = page.getByTestId(`station-${id}`);
    await field.fill(String(mi));
    await field.blur();
  }

  test('an empty facility is one basic segment, and a ramp pair segments itself', async ({ page }) => {
    await openBuilder(page);
    expect(await typesOf(page)).toEqual(['Basic']);

    await page.getByTestId('template-diamond').click();
    // 4,000 ft apart with no auxiliary lane: merge + basic + diverge, wrapped
    // in the basic termini Chapter 10 asks for (Exhibit 10-11).
    expect(await typesOf(page)).toEqual(['Basic', 'Merge', 'Basic', 'Diverge', 'Basic']);
    await expect(page.getByTestId('strip-seg')).toHaveCount(5);
  });

  test('dragging a ramp across the 3,000-ft threshold turns the basic segment into an overlap', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('facility-length').fill('4');
    await page.getByTestId('facility-length').blur();
    await page.getByTestId('template-diamond').click();
    expect(await typesOf(page)).toEqual(['Basic', 'Merge', 'Basic', 'Diverge', 'Basic']);

    // Drag the off-ramp marker upstream. The strip is linear in station, so the
    // pointer position is the station, and the derivation runs on every move.
    const strip = page.getByTestId('builder-strip').locator('svg');
    const off = page.locator('[data-testid="feature-marker"]').last();
    const from = await off.locator('circle').boundingBox();
    const box = await strip.boundingBox();
    expect(from && box).toBeTruthy();
    // 4 mi of facility across the plot: move left by roughly 2,000 ft.
    const perFt = (box!.width * (900 - 28) / 900) / (4 * 5280);
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width / 2 - 2000 * perFt, from!.y + from!.height / 2, { steps: 8 });
    await page.mouse.up();

    // Gore-to-gore is now under 3,000 ft, so the influence areas overlap.
    expect(await typesOf(page)).toEqual(['Basic', 'Merge', 'OverlappingRamp', 'Diverge', 'Basic']);
    // And the rule that produced it says so in words.
    await page.getByTestId('segment-row').nth(2).locator('button').click();
    await expect(page.getByTestId('why-row')).toContainText('between 1,500 and 3,000 ft');
    await expect(page.getByTestId('why-row')).toContainText('Exhibit 10-11');

    // A drag is one undo step, not one per pointermove: one undo restores the
    // pre-drag segmentation, and the step behind it is the template drop rather
    // than an intermediate pointer position.
    await page.getByTestId('undo').click();
    expect(await typesOf(page)).toEqual(['Basic', 'Merge', 'Basic', 'Diverge', 'Basic']);
    await page.getByTestId('undo').click();
    expect(await typesOf(page)).toEqual(['Basic']);
  });

  test('undo restores the segmentation a station change produced', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('template-diamond').click();
    const before = await typesOf(page);
    const offId = await page.getByTestId('feature-row').last().getAttribute('data-feature-id');
    await setStation(page, offId!, 1.3);
    expect(await typesOf(page)).not.toEqual(before);
    await page.getByTestId('undo').click();
    expect(await typesOf(page)).toEqual(before);
    await page.getByTestId('redo').click();
    expect(await typesOf(page)).not.toEqual(before);
  });

  test('an override survives re-derivation, is marked stale when its row changes type, and clears', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('facility-length').fill('4');
    await page.getByTestId('facility-length').blur();
    await page.getByTestId('template-diamond').click();

    // Pin the middle row to 4 lanes.
    const middle = page.getByTestId('segment-row').nth(2);
    await middle.locator('input[type="number"]').last().fill('4');
    await middle.locator('input[type="number"]').last().blur();
    await expect(middle.getByTestId('override-pin')).toBeVisible();

    // Move the pair inside 3,000 ft: the row is now an overlapping ramp, the
    // override is still on it, and it says it was made against something else.
    const offId = await page.getByTestId('feature-row').last().getAttribute('data-feature-id');
    const onStation = await page.getByTestId('feature-row').first().getAttribute('data-feature-id');
    expect(onStation).toBeTruthy();
    await setStation(page, offId!, 1.4);
    const moved = page.getByTestId('segment-row').nth(2);
    await expect(moved).toHaveAttribute('data-seg-type', 'OverlappingRamp');
    await expect(moved.locator('input[type="number"]').last()).toHaveValue('4');
    await expect(moved.getByTestId('override-stale')).toBeVisible();

    await moved.getByTestId('clear-override').click();
    await expect(page.getByTestId('segment-row').nth(2).getByTestId('override-pin')).toHaveCount(0);
    await expect(page.getByTestId('segment-row').nth(2).locator('input[type="number"]').last()).toHaveValue('3');
  });

  test('a builder document downloads and uploads back to the same facility', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('template-aux-weave').click();
    await page.getByTestId('facility-name').fill('Round trip');
    await page.getByTestId('facility-name').blur();
    const before = await typesOf(page);
    expect(before).toContain('Weaving');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-document').click()
    ]);
    const savedPath = await download.path();

    // Start clean, then load the file back.
    await page.getByTestId('new-facility').click();
    expect(await typesOf(page)).toEqual(['Basic']);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'round-trip.builder.json',
      mimeType: 'application/json',
      buffer: readFileSync(savedPath)
    });
    await expect(page.getByTestId('facility-name')).toHaveValue('Round trip');
    expect(await typesOf(page)).toEqual(before);
  });

  test('Example Problem 1 loads as placed ramps and rebuilds the published eleven segments', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('example-ep1').click();
    const case1 = JSON.parse(readFileSync(CASE1, 'utf8'));
    expect(await typesOf(page)).toEqual(case1.segments.map((s: { seg_type: string }) => s.seg_type));
    await expect(page.getByTestId('feature-row')).toHaveCount(6);
    // The weave carries the auxiliary lane, so it is one lane wider than the
    // mainline, exactly as the fixture codes it.
    const weave = page.locator('[data-testid="segment-row"][data-seg-type="Weaving"]');
    await expect(weave.locator('input[type="number"]').last()).toHaveValue(String(case1.segments[5].lanes));
  });

  test('a fixture imports as segments with no feature layer, and says so', async ({ page }) => {
    await openBuilder(page);
    const case1 = JSON.parse(readFileSync(CASE1, 'utf8'));
    await page.locator('input[type="file"]').setInputFiles({
      name: 'case1.json',
      mimeType: 'application/json',
      buffer: readFileSync(CASE1)
    });
    expect(await typesOf(page)).toEqual(case1.segments.map((s: { seg_type: string }) => s.seg_type));
    await expect(page.getByTestId('segment-row')).toHaveCount(11);
    // No features arrived with it, and the page does not pretend otherwise.
    await expect(page.getByTestId('feature-table')).toHaveCount(0);
    await expect(page.getByTestId('imported-note')).toBeVisible();
    await expect(
      page.locator('[data-testid="validation-flag"][data-flag-id="imported-no-features"]')
    ).toBeVisible();
  });

  test('the checks panel flags an over-long facility as a warning and cites the section', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('facility-length').fill('20');
    await page.getByTestId('facility-length').blur();
    const flag = page.locator('[data-testid="validation-flag"][data-flag-id="facility-too-long"]');
    await expect(flag).toBeVisible();
    await expect(flag).toHaveAttribute('data-level', 'warn');
    await expect(flag).toContainText('Section 3');
    // Twenty periods is not a flag of any kind above a note, because Chapter 10
    // sets no limit on the analysis period count.
    await page.getByTestId('period-count').fill('20');
    await page.getByTestId('period-count').blur();
    await expect(page.locator('[data-testid="validation-flag"][data-level="error"]')).toHaveCount(0);
  });

  const lanesOf = (page: Page) =>
    page.getByTestId('strip-seg').evaluateAll((els) =>
      els.map((e) => Number((e as HTMLElement).dataset.segLanes))
    );

  test('Example Problem 3 shows the added lane as a step in the cross section', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('example-ep3').click();
    const case3 = JSON.parse(readFileSync(join(LIB_CASES, 'FreewayFacilities', 'case3.json'), 'utf8'));
    expect(await typesOf(page)).toEqual(case3.segments.map((s: { seg_type: string }) => s.seg_type));
    // The strip is the thing that has to show the step, not just the table.
    expect(await lanesOf(page)).toEqual(case3.segments.map((s: { lanes: number }) => s.lanes));
    await expect(page.getByTestId('lane-change-marker')).toHaveCount(1);
    await expect(page.getByTestId('lane-change-marker')).toHaveAttribute('data-lanes', '4');
    // Removing it puts the downstream half back to three lanes.
    const id = await page.getByTestId('lane-change-marker').getAttribute('data-feature-id');
    await page.getByTestId(`remove-${id}`).click();
    expect((await lanesOf(page)).slice(6)).toEqual([3, 3, 3, 3, 3]);
  });

  test('Example Problem 4 codes the closure segment with the lanes that stay open', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('example-ep4').click();
    const case4 = JSON.parse(readFileSync(join(LIB_CASES, 'FreewayFacilities', 'case4.json'), 'utf8'));
    expect(await typesOf(page)).toEqual(case4.segments.map((s: { seg_type: string }) => s.seg_type));
    expect(await lanesOf(page)).toEqual(case4.segments.map((s: { lanes: number }) => s.lanes));
    const closure = page.locator('[data-testid="strip-seg"][data-seg-wz="yes"]');
    await expect(closure).toHaveCount(1);
    await expect(closure).toHaveAttribute('data-seg-lanes', '2');
    await expect(page.getByTestId('work-zone-marker')).toHaveCount(1);
    // Opening a third lane puts the segment back to three, live.
    const id = await page.getByTestId('work-zone-marker').getAttribute('data-feature-id');
    await expandFeature(page, id!);
    await page.getByTestId(`open-lanes-${id}`).fill('3');
    await page.getByTestId(`open-lanes-${id}`).blur();
    await expect(page.locator('[data-testid="strip-seg"][data-seg-wz="yes"]')).toHaveAttribute('data-seg-lanes', '3');
  });

  test('a lane change added from the toolbar cuts the segment it lands in', async ({ page }) => {
    await openBuilder(page);
    expect(await typesOf(page)).toEqual(['Basic']);
    await page.getByTestId('add-lane-change').click();
    // One basic stretch becomes two, and only the downstream half is wider.
    expect(await typesOf(page)).toEqual(['Basic', 'Basic']);
    expect(await lanesOf(page)).toEqual([3, 4]);
    await page.getByTestId('undo').click();
    expect(await typesOf(page)).toEqual(['Basic']);
  });

  test('EP2 is EP1 at higher demands, and the segmentation does not move', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('example-ep1').click();
    const ep1Types = await typesOf(page);
    const ep1Lanes = await lanesOf(page);
    await page.getByTestId('example-ep2').click();
    expect(await typesOf(page)).toEqual(ep1Types);
    expect(await lanesOf(page)).toEqual(ep1Lanes);
    const case2 = JSON.parse(readFileSync(join(LIB_CASES, 'FreewayFacilities', 'case2.json'), 'utf8'));
    await expect(page.locator('[data-testid="demand-row"][data-source="mainline"] input').first())
      .toHaveValue(String(case2.mainline_demand[0]));
  });

  // Every feature kind shares one `features` array, and the ramp kinds are the
  // only ones carrying a demand vector. A consumer that iterates the array
  // without saying which kinds it means throws during render, and a thrown
  // render does not blank the page: it leaves the last good DOM standing while
  // every later update is silently dropped, which reads as "the button is
  // disabled" rather than as an error. So the assertion is on pageerror.
  test('placing one of every feature kind raises no page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openBuilder(page);
    for (const kind of ['add-on-ramp', 'add-off-ramp', 'add-lane-change', 'add-work-zone']) {
      await page.getByTestId(kind).click();
    }
    await expect(page.getByTestId('feature-table')).toBeVisible();
    await expect(page.getByTestId('mainline-feature-table')).toBeVisible();
    await expect(page.getByTestId('demand-grid')).toBeVisible();
    // The demand grid holds the mainline row plus one per ramp, and nothing for
    // the two kinds that have no demand. The ramp-to-ramp row is not among them
    // because it belongs to a weave, and no auxiliary lane is set here.
    await expect(page.getByTestId('demand-row')).toHaveCount(3);
    await expect(page.locator('[data-testid="demand-row"][data-source="mainline"]')).toHaveCount(1);
    // Still live after all four: undo unwinds them one at a time.
    for (let i = 0; i < 4; i++) await page.getByTestId('undo').click();
    expect(await typesOf(page)).toEqual(['Basic']);
    expect(errors).toEqual([]);
  });

  // ── Point editors (phase 1c) ───────────────────────────────────────────
  //
  // The claim is that the editor a row opens is the same editor the strip
  // opens, that a field committed in it re-derives the table exactly as a drag
  // does, and that it costs one undo step rather than one per keystroke.

  test('a ramp row opens an editor whose station change re-derives, and one undo restores it', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('facility-length').fill('4');
    await page.getByTestId('facility-length').blur();
    await page.getByTestId('template-diamond').click();
    const before = await typesOf(page);
    expect(before).toEqual(['Basic', 'Merge', 'Basic', 'Diverge', 'Basic']);

    const offId = (await page.getByTestId('feature-row').last().getAttribute('data-feature-id'))!;
    // Collapsed, the row holds no editable station at all: the fields are in
    // the panel, which is the thing that has to open.
    await expect(page.getByTestId(`station-${offId}`)).toHaveCount(0);
    await page.getByTestId(`expand-${offId}`).click();
    const editor = page.locator(`[data-testid="feature-editor"][data-feature-id="${offId}"]`);
    await expect(editor).toBeVisible();
    await expect(page.getByTestId(`expand-${offId}`)).toHaveAttribute('aria-expanded', 'true');

    // Pulling the off-ramp back inside 3,000 ft of the on-ramp turns the basic
    // segment between them into an overlapping ramp, live.
    const field = page.getByTestId(`station-${offId}`);
    await field.fill('1.4');
    await field.blur();
    expect(await typesOf(page)).toEqual(['Basic', 'Merge', 'OverlappingRamp', 'Diverge', 'Basic']);

    // One field edit committed on blur is one undo step, not one per keystroke.
    await page.getByTestId('undo').click();
    expect(await typesOf(page)).toEqual(before);
  });

  test('the editor carries the fields no row column fits, and they reach the derivation', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('example-ep1').click();
    // EP1's weave is the on-ramp that carries an auxiliary lane to the next
    // off-ramp, so its weaving geometry is live rather than dimmed.
    const weaveOn = page.locator('[data-testid="feature-row"]').filter({ hasText: 'aux lane to next' }).first();
    const onId = (await weaveOn.getAttribute('data-feature-id'))!;
    await expandFeature(page, onId);
    for (const field of ['weaving-lanes', 'lc-rf', 'lc-fr', 'ramp-ffs', 'accel']) {
      await expect(page.getByTestId(`${field}-${onId}`)).toBeVisible();
    }
    // The per-ramp demand vector is in the panel as well as in the grid below,
    // and both write to the same document.
    await page.getByTestId(`demand-${onId}-0`).fill('999');
    await page.getByTestId(`demand-${onId}-0`).blur();
    await expect(page.locator(`[data-testid="demand-row"][data-source="${onId}"] input`).first()).toHaveValue('999');
  });

  test('a work zone field committed in the editor moves the segment it produced', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('example-ep4').click();
    const id = (await page.getByTestId('work-zone-marker').getAttribute('data-feature-id'))!;
    await expandFeature(page, id);
    // All ten of the library's WorkZone fields are here, including the ramp
    // density that had no editor anywhere before.
    await expect(page.getByTestId(`wz-ramp-density-${id}`)).toBeVisible();
    await page.getByTestId(`open-lanes-${id}`).fill('3');
    await page.getByTestId(`open-lanes-${id}`).blur();
    // The derived row is the assertion, not the strip: the closure segment is
    // what the engine analyzes.
    await expect(page.locator('[data-testid="strip-seg"][data-seg-wz="yes"]')).toHaveAttribute('data-seg-lanes', '3');
    await expect(page.getByTestId('segment-row').filter({ hasText: 'WZ' }).first()).toBeVisible();
    await page.getByTestId('undo').click();
    await expect(page.locator('[data-testid="strip-seg"][data-seg-wz="yes"]')).toHaveAttribute('data-seg-lanes', '2');
  });

  test('marker and row select each other', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('template-diamond').click();
    const offId = (await page.getByTestId('feature-row').last().getAttribute('data-feature-id'))!;

    // Row to marker: expanding lights the marker on the strip.
    await page.getByTestId(`expand-${offId}`).click();
    await expect(page.locator(`[data-testid="feature-marker"][data-feature-id="${offId}"]`)).toHaveClass(/lit/);

    // Marker to row: a click that moves nothing opens that feature's row and
    // closes the one that was open.
    const onId = (await page.getByTestId('feature-row').first().getAttribute('data-feature-id'))!;
    await page.locator(`[data-testid="feature-marker"][data-feature-id="${onId}"] circle`).click();
    await expect(page.locator(`[data-testid="feature-editor"][data-feature-id="${onId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="feature-editor"][data-feature-id="${offId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="feature-row"][data-feature-id="${onId}"]`)).toHaveAttribute('data-expanded', 'true');
  });

  test('the editor maximizes to the viewport and Escape restores it', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('template-diamond').click();
    const editor = page.getByTestId('builder-editor');
    await expect(editor).toHaveAttribute('data-maximized', 'false');

    await page.getByTestId('maximize-editor').click();
    await expect(editor).toHaveAttribute('data-maximized', 'true');
    await expect(page.getByTestId('maximize-editor')).toHaveAttribute('aria-pressed', 'true');
    // Actually filling the viewport, not just wearing the class.
    const box = await editor.boundingBox();
    const view = page.viewportSize()!;
    expect(box!.width).toBeGreaterThan(view.width * 0.95);

    // The editor keeps working inside the overlay.
    const offId = (await page.getByTestId('feature-row').last().getAttribute('data-feature-id'))!;
    await expandFeature(page, offId);
    await expect(page.getByTestId(`station-${offId}`)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(editor).toHaveAttribute('data-maximized', 'false');
    // And the open row survived the trip, because maximizing is a layout state
    // and not a reset.
    await expect(page.locator(`[data-testid="feature-editor"][data-feature-id="${offId}"]`)).toBeVisible();
  });

  test('a run leaves the maximized editor alone and the results wait below it', async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId('example-ep1').click();
    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('heatmap')).toBeVisible();

    await page.getByTestId('maximize-editor').click();
    await expect(page.getByTestId('builder-editor')).toHaveAttribute('data-maximized', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('overall-speed')).toHaveText('56.9');
    await expect(page.getByTestId('results-stale')).toHaveCount(0);
  });

  // ── Analysis (phase 1b) ────────────────────────────────────────────────
  //
  // The claim these pin is the whole point of the builder: a facility described
  // as ramps at stations, analyzed through the page, reproduces the values the
  // manual prints. The expected numbers are the ones
  // tests/boundary/ch10_freeway_facilities.mjs asserts against the exhibits,
  // read here off the rendered page rather than off the engine, so a correct
  // engine wired to the wrong cell of the grid still fails.
  //
  // tests/builder/analysis.mjs pins the matrices cell by cell under node. What
  // is worth a browser is what the page actually shows.

  async function analyze(page: Page, example: string) {
    await openBuilder(page);
    await page.getByTestId(`example-${example}`).click();
    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('heatmap')).toBeVisible();
  }

  /** The facility LOS row of the summary table, which is the letter sequence
   * Exhibit 25-52 and its siblings print along the bottom. */
  const facilityLos = (page: Page) =>
    page.getByTestId('facility-los-row').locator('td').allInnerTexts();

  /** One row of the heatmap, in segment order, as the page renders it. */
  const heatRow = (page: Page, period: number) =>
    page.locator(`[data-testid="heatmap-cell"][data-period="${period}"]`).evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.value)
    );

  test('Example Problem 1 analyzes to the published Exhibit 25-52 facility values', async ({ page }) => {
    await analyze(page, 'ep1');

    // Exhibit 25-52 totals: 56.9 mi/h over 6.00 mi.
    await expect(page.getByTestId('overall-speed')).toHaveText('56.9');
    // Exhibit 25-52 prints 28.4 veh/mi/ln; the engine computes 28.5, inside the
    // +-0.5 the boundary file allows, so the page is pinned at what it shows.
    await expect(page.getByTestId('overall-density')).toHaveText('28.5');
    expect(await facilityLos(page)).toEqual(['D', 'D', 'E', 'D', 'C']);
    await expect(page.getByTestId('oversaturated-flag')).toContainText('Undersaturated');

    // The grid is the Exhibit 10-10 domain: 11 segments across, 5 periods down.
    await expect(page.getByTestId('heatmap-col')).toHaveCount(11);
    await expect(page.getByTestId('heatmap-row')).toHaveCount(5);
    await expect(page.getByTestId('heatmap-cell')).toHaveCount(55);
    // Period 3 of the segment LOS matrix (Exhibit 25-51), read off the cells.
    expect(await heatRow(page, 3)).toEqual(['D', 'D', 'D', 'D', 'D', 'D', 'E', 'E', 'E', 'D', 'E']);
  });

  test('Example Problem 2 goes oversaturated in period 3 and holds its period-4 letters', async ({ page }) => {
    await analyze(page, 'ep2');

    const flag = page.getByTestId('oversaturated-flag');
    await expect(flag).toContainText('Oversaturated');
    // Exhibit 25-55 puts the first demand-to-capacity ratios above 1.0 in
    // Analysis Period 3. The core's own first_oversat_period has no binding
    // getter, so the page derives it and says what it means.
    await expect(page.getByTestId('first-oversat-period')).toHaveText('period 3');
    expect(await facilityLos(page)).toEqual(['D', 'E', 'F', 'E', 'D']);

    // Exhibit 25-59 period 4, segment 4: LOS E. This cell moved onto its
    // published value when the Equation 25-12 front-clearing test was scoped to
    // a restored bottleneck, so it is the one worth watching.
    await expect(
      page.locator('[data-testid="heatmap-cell"][data-seg="4"][data-period="4"]')
    ).toHaveAttribute('data-value', 'E');
    // VERIFY-HCM: the residual queue-distribution gap keeps the totals off the
    // published 50.5 mi/h and 35.6 veh/mi/ln, so the page is pinned at what the
    // engine measures, exactly as the boundary file pins it.
    await expect(page.getByTestId('overall-speed')).toHaveText('49.3');
    await expect(page.getByTestId('overall-density')).toHaveText('36.5');
  });

  test('Example Problem 3 loses every bottleneck once the lane is carried on', async ({ page }) => {
    await analyze(page, 'ep3');
    await expect(page.getByTestId('oversaturated-flag')).toContainText('Undersaturated');
    // Exhibit 25-68 totals: 57.5 mi/h and 27.7 veh/mi/ln. The overall space mean
    // speed is demand-weighted across periods and computes 57.3, inside the 0.2
    // band the boundary file allows it.
    await expect(page.getByTestId('overall-speed')).toHaveText('57.3');
    await expect(page.getByTestId('overall-density')).toHaveText('27.7');
    expect(await facilityLos(page)).toEqual(['D', 'D', 'D', 'D', 'C']);
    // The added lane is what did it, and the heatmap says which segments moved:
    // Exhibit 25-67 period 5 puts Segments 7, 8, 10 and 11 at LOS B.
    expect(await heatRow(page, 5)).toEqual(['C', 'C', 'C', 'C', 'C', 'C', 'B', 'B', 'C', 'B', 'B']);
  });

  test('Example Problem 4 reproduces the work zone capacity and its 1.26 ratio', async ({ page }) => {
    await analyze(page, 'ep4');
    await expect(page.getByTestId('oversaturated-flag')).toContainText('Oversaturated');
    await expect(page.getByTestId('first-oversat-period')).toHaveText('period 1');

    // Segment 11 in period 1 is the cell the work-zone methodology governs.
    // Exhibit 25-71 prints 4,499 veh/h, which carries only the lane closure;
    // the ratios of Exhibit 25-72 are taken against the post-CAF_wz 4,013, and
    // 1.26 is the published ratio.
    await page.locator('[data-testid="heatmap-cell"][data-seg="11"][data-period="1"]').click();
    const detail = page.getByTestId('cell-detail');
    await expect(detail).toContainText('Segment 11');
    await expect(page.getByTestId('detail-capacity')).toHaveText('4014 veh/h');
    await expect(page.getByTestId('detail-dc')).toHaveText('1.26');
    // Exhibit 25-76: the work zone itself holds LOS E in every period, because
    // it discharges at its own reduced capacity rather than queueing.
    await expect(page.getByTestId('detail-los')).toHaveText('E');
    await expect(page.getByTestId('detail-work-zone')).toBeVisible();
    // And every queued segment upstream of it reaches F by period 3.
    expect(await heatRow(page, 3)).toEqual(['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'E']);
  });

  test('the measure selector re-encodes the same grid without moving a cell', async ({ page }) => {
    await analyze(page, 'ep1');
    const cell = page.locator('[data-testid="heatmap-cell"][data-seg="8"][data-period="3"]');
    await expect(cell).toHaveAttribute('data-value', 'E');

    // Switching measure repaints and relabels every cell; it does not change
    // which cell is which, so the LOS attribute rides along unchanged.
    await page.getByTestId('measure-select').selectOption('density');
    // Exhibit 25-50, Segment 8 period 3: 43.9 veh/mi/ln.
    await expect(cell).toHaveAttribute('data-value', '43.9');
    await expect(cell).toHaveAttribute('data-los', 'E');
    await expect(page.getByTestId('heatmap-legend')).toContainText('veh/mi/ln');

    // Speed is the measure the HCM reads the other way round, and the legend
    // says so by running from the fast end to the slow one.
    await page.getByTestId('measure-select').selectOption('speed');
    await expect(cell).toHaveAttribute('data-value', '50.6');
    const low = Number(await page.getByTestId('legend-low').innerText());
    const high = Number(await page.getByTestId('legend-high').innerText());
    expect(low).toBeGreaterThan(high);

    await page.getByTestId('measure-select').selectOption('dc');
    await expect(page.getByTestId('heatmap-legend')).toContainText('Demand-to-capacity');
    await expect(page.getByTestId('heatmap-cell')).toHaveCount(55);
  });

  test('a heatmap cell opens the full segment-period detail and the grid is keyboard navigable', async ({ page }) => {
    await analyze(page, 'ep1');
    await expect(page.getByTestId('cell-detail')).toHaveCount(0);

    await page.locator('[data-testid="heatmap-cell"][data-seg="6"][data-period="3"]').click();
    // Exhibit 25-49/25-50, Segment 6 (the weave) in period 3: 46.2 mi/h and
    // 34.6 veh/mi/ln at LOS D.
    await expect(page.getByTestId('detail-speed')).toHaveText('46.2 mi/h');
    await expect(page.getByTestId('detail-density')).toHaveText('34.6 veh/mi/ln');
    await expect(page.getByTestId('detail-los')).toHaveText('D');
    await expect(page.getByTestId('cell-detail')).toContainText('Weaving');

    // The grid takes one tab stop and moves on the arrow keys, because 55 tab
    // stops is not navigation. The cell is focused explicitly rather than left
    // focused by the click above: WebKit does not focus a button on a mouse
    // click, so relying on that would make this a chromium-only assertion.
    await page.locator('[data-testid="heatmap-cell"][data-seg="6"][data-period="3"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('cell-detail')).toContainText('Segment 7');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('cell-detail')).toContainText('Period 2');

    await page.getByTestId('close-detail').click();
    await expect(page.getByTestId('cell-detail')).toHaveCount(0);
  });

  test('the reliability panel runs the same facility through Chapter 11', async ({ page }) => {
    await analyze(page, 'ep1');
    // The honesty note is on the panel before the run, not after it.
    await expect(page.getByTestId('reliability-notes')).toContainText('weather matrix');
    await expect(page.getByTestId('reliability-summary')).toHaveCount(0);

    await page.getByTestId('run-reliability').click();
    const summary = page.getByTestId('reliability-summary');
    await expect(summary).toBeVisible();
    // Fixed rng seed and fixed inputs, so these are deterministic. They are the
    // values tests/builder/analysis.mjs measures for the same facility.
    await expect(page.getByTestId('rel-tti-mean')).toHaveText('1.719');
    await expect(page.getByTestId('rel-tti-50')).toHaveText('1.601');
    await expect(page.getByTestId('rel-pti')).toHaveText('2.313');
    await expect(page.getByTestId('rel-rating')).toHaveText('26.4');
    // Chapter 11 assigns no letter, and the discussion says so rather than
    // leaving the reader to notice.
    await expect(page.getByTestId('reliability-panel')).toContainText('no level of service letter is assigned');
  });

  test('a work zone facility says on the reliability panel that the closure crosses', async ({ page }) => {
    await analyze(page, 'ep4');
    const notes = page.getByTestId('reliability-notes');
    await expect(notes.locator('[data-note-id="work-zone-carried"]')).toContainText('crosses into the reliability run');
    await expect(notes.locator('[data-note-id="work-zone-carried"]')).toContainText('every scenario');
  });

  test('a blocking check stops the analysis and a warning does not', async ({ page }) => {
    await openBuilder(page);
    // A lane change to one lane is an error: Chapter 10 needs at least two.
    await page.getByTestId('add-lane-change').click();
    const id = await page.getByTestId('lane-change-marker').getAttribute('data-feature-id');
    await expandFeature(page, id!);
    await page.getByTestId(`lanes-${id}`).fill('1');
    await page.getByTestId(`lanes-${id}`).blur();
    await expect(page.locator('[data-testid="validation-flag"][data-level="error"]')).not.toHaveCount(0);
    await expect(page.getByTestId('analyze')).toBeDisabled();

    // Put it back and make the facility over-long instead, which is a warning.
    await page.getByTestId(`lanes-${id}`).fill('4');
    await page.getByTestId(`lanes-${id}`).blur();
    await page.getByTestId('facility-length').fill('20');
    await page.getByTestId('facility-length').blur();
    await expect(page.locator('[data-testid="validation-flag"][data-flag-id="facility-too-long"]')).toBeVisible();
    await expect(page.getByTestId('analyze')).toBeEnabled();
    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('heatmap')).toBeVisible();
  });

  test('the results belong to the run, and an edit marks them stale rather than moving them', async ({ page }) => {
    await analyze(page, 'ep1');
    await expect(page.getByTestId('overall-speed')).toHaveText('56.9');
    await expect(page.getByTestId('results-stale')).toHaveCount(0);

    // Editing the document leaves the finished run standing, which is what
    // keeps the printed report from quoting numbers the form no longer holds.
    await page.getByTestId('facility-lanes').fill('4');
    await page.getByTestId('facility-lanes').blur();
    await expect(page.getByTestId('results-stale')).toBeVisible();
    await expect(page.getByTestId('overall-speed')).toHaveText('56.9');

    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('results-stale')).toHaveCount(0);
    await expect(page.getByTestId('overall-speed')).not.toHaveText('56.9');
  });

  test('the run joins the printable report with the heatmap as a table of letters', async ({ page }) => {
    await analyze(page, 'ep1');
    await page.getByTestId('open-report').click();
    await expect(page).toHaveURL(/\/report$/);

    await expect(page.locator('.report-page')).toContainText('Example Problem 1');
    // The per-period table, then the time-space domain as letters rather than
    // colours, because a fill does not survive a print.
    const matrix = page.getByTestId('report-matrix');
    await expect(matrix).toBeVisible();
    await expect(matrix.locator('thead th')).toHaveCount(12);
    await expect(matrix.locator('tbody tr')).toHaveCount(5);
    expect(await matrix.locator('tbody tr').nth(2).locator('td').allInnerTexts())
      .toEqual(['3', 'D', 'D', 'D', 'D', 'D', 'D', 'E', 'E', 'E', 'D', 'E']);
    // The discussion rides under the same opt-out toggle every chapter uses.
    await expect(page.getByTestId('report-discussion')).toContainText('governing cell');
  });

  // ── Word export ────────────────────────────────────────────────────────
  //
  // The claim is that the file is a real Word document carrying the whole
  // session's report, built from the frozen run rather than from the form, and
  // that the discussion toggle reaches it. A .docx is a zip, so the assertion
  // reads its document part rather than trusting the byte count.

  test('the report exports every held analysis as a Word file, and the toggle reaches it', async ({ page }) => {
    // One builder run: Example Problem 1, whose published facility speed is
    // 56.9 mi/h (Exhibit 25-52).
    await analyze(page, 'ep1');
    await expect(page.getByTestId('overall-speed')).toHaveText('56.9');

    // One chapter analysis, so the export has two reports to carry.
    await page.goto('/hcm10');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();
    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page).toHaveURL(/\/report$/);
    // Both runs are held side by side, and the page says the Word file carries
    // both while the print carries the one on screen.
    await expect(page.locator('.report-tabs button')).toHaveCount(2);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-docx').click()
    ]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const path = await download.path();
    const bytes = readFileSync(path);
    // A Word file this size is a document, not an empty skeleton.
    expect(bytes.length).toBeGreaterThan(8_000);

    const xml = readZipEntry(bytes, 'word/document.xml');
    // Both analyses are in it, and the builder's numbers are the published ones.
    expect(xml).toContain('56.9');
    expect(xml).toContain('Facility Builder');
    expect(xml).toContain('Chapter 10');
    // The time-space domain rides along as letters.
    expect(xml).toContain('Time-space domain');
    expect(xml).toContain('>Discussion<');

    // Clearing the toggle takes the discussion out of the file as well as off
    // the page, which is the whole point of one control for both.
    await page.getByTestId('include-discussion').uncheck();
    await expect(page.getByTestId('report-discussion')).toHaveCount(0);
    const [second] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-docx').click()
    ]);
    const withoutDiscussion = readZipEntry(readFileSync(await second.path()), 'word/document.xml');
    expect(withoutDiscussion).not.toContain('>Discussion<');
    // And nothing else went with it.
    expect(withoutDiscussion).toContain('56.9');
  });

  test('the builder link is in both navigation menus', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.navbar a[href="/builder"]')).toHaveCount(2);
  });

  // ── Urban street (HCM Chapters 16/17/18) ──────────────────────────────
  //
  // These run through the rendered page rather than through the modules,
  // because the modules are already pinned in tests/builder/urban.mjs. What is
  // being checked here is the half that file cannot see: that the loaders, the
  // mode switch, the derivation and the engine call are wired to each other on
  // the page, and that the published numbers survive the trip to the DOM.
  test.describe('urban street', () => {
    /** Switching the facility type starts a new document, so it is the first
     * thing every urban test does. */
    async function openUrban(page: Page) {
      await openBuilder(page);
      await page.getByTestId('facility-type').selectOption('urban');
      await expect(page.getByTestId('add-signal')).toBeVisible();
    }

    async function loadUrbanExample(page: Page, id: string) {
      await openUrban(page);
      await page.getByTestId(`example-${id}`).click();
      await expect(page.getByTestId('segment-row').first()).toBeVisible();
    }

    const segLengths = (page: Page) =>
      page.getByTestId('strip-seg').evaluateAll((rows) =>
        rows.map((r) => (r as HTMLElement).dataset.segKey)
      );

    test('the urban mode swaps the whole editor, and does not leak freeway controls', async ({ page }) => {
      await openUrban(page);
      // The urban feature set replaces the freeway one rather than joining it.
      await expect(page.getByTestId('add-signal')).toBeVisible();
      await expect(page.getByTestId('add-access-point')).toBeVisible();
      await expect(page.getByTestId('add-on-ramp')).toHaveCount(0);
      await expect(page.getByTestId('template-diamond')).toHaveCount(0);
      // The demand grid is a period axis and the urban engines have none.
      await expect(page.getByTestId('demand-grid')).toHaveCount(0);
      // The urban mainline fields are the Chapter 18 cross section.
      await expect(page.getByTestId('facility-speed-limit')).toBeVisible();
      await expect(page.getByTestId('facility-curb')).toBeVisible();
      await expect(page.getByTestId('facility-ffs')).toHaveCount(0);
    });

    test('Chapter 30 EP1 loads from its signals and reproduces the published Exhibit 30-36 values', async ({ page }) => {
      await loadUrbanExample(page, 'ch30ep1');

      // Four boundary signals give three segments, and the access points are on
      // the strip at their stations rather than spaced by count.
      await expect(page.getByTestId('signal-marker')).toHaveCount(4);
      await expect(page.getByTestId('strip-seg')).toHaveCount(3);
      await expect(page.getByTestId('access-point-marker')).toHaveCount(24);

      await page.getByTestId('analyze').click();
      await expect(page.getByTestId('urban-facility-summary')).toBeVisible();

      // The published Exhibit 30-36 values, read off the rendered page.
      await expect(page.getByTestId('urban-los')).toHaveText('C');
      await expect(page.getByTestId('urban-base-ffs')).toHaveText('40.78');
      await expect(page.getByTestId('urban-travel-speed')).toHaveText('23.67');
      await expect(page.getByTestId('urban-stop-rate')).toHaveText('1.60');
      await expect(page.getByTestId('urban-perception')).toHaveText('2.53');
      await expect(page.getByTestId('urban-poorest-los')).toHaveText('C');

      // The result view is one row, not a grid, because the engines are
      // single-period. The page says so rather than leaving it to be inferred.
      await expect(page.getByTestId('urban-single-period')).toContainText('single-period');
      await expect(page.getByTestId('urban-cell')).toHaveCount(3);
    });

    test('Chapter 29 EP1 loads in measures mode and reproduces the three exact published values', async ({ page }) => {
      await loadUrbanExample(page, 'ch29ep1eb');

      // The loader picks the mode, because what the chapter publishes decides
      // it: Chapter 29 gives per-segment outputs and no input geometry.
      await expect(page.getByTestId('analysis-mode')).toHaveValue('measures');
      await expect(page.getByTestId('mode-note')).toContainText('HCM method output');
      await expect(page.getByTestId('signal-marker')).toHaveCount(6);
      await expect(page.getByTestId('strip-seg')).toHaveCount(5);

      await page.getByTestId('analyze').click();
      await expect(page.getByTestId('urban-facility-summary')).toBeVisible();

      // The three Exhibit 29-49 values the aggregation reproduces exactly.
      await expect(page.getByTestId('urban-los')).toHaveText('C');
      await expect(page.getByTestId('urban-base-ffs')).toHaveText('40.11');
      await expect(page.getByTestId('urban-poorest-los')).toHaveText('D');
      // And the documented fixture artifact, pinned at the boundary suite's own
      // computed value rather than at the published 22.6. Chapter 29 publishes
      // per-segment measures only for Segments 1 and 5, and the fixture copies
      // those into the unpublished Segments 2 through 4.
      await expect(page.getByTestId('urban-travel-speed')).toHaveText('22.13');
      await expect(page.getByTestId('urban-mode-readout')).toContainText('Chapter 18 engine was not run');
    });

    test('the westbound direction carries its own published measures', async ({ page }) => {
      await loadUrbanExample(page, 'ch29ep1wb');
      await page.getByTestId('analyze').click();
      await expect(page.getByTestId('urban-los')).toHaveText('C');
      await expect(page.getByTestId('urban-base-ffs')).toHaveText('40.11');
      await expect(page.getByTestId('urban-poorest-los')).toHaveText('D');
      // 21.54 rather than the eastbound 22.13, so the two directions are not
      // quietly loading the same numbers.
      await expect(page.getByTestId('urban-travel-speed')).toHaveText('21.54');
    });

    test('moving a signal re-derives the segments on both sides of it', async ({ page }) => {
      await loadUrbanExample(page, 'ch30ep1');
      const before = await segLengths(page);
      expect(before).toHaveLength(3);

      // The editor interaction: open the second signal and retype its station.
      // A segment reads its timing from its downstream signal, so moving one
      // boundary changes the segment before it as well as the one after.
      const toggle = page.getByTestId('expand-sig2');
      await toggle.click();
      await expect(page.locator('[data-testid="urban-feature-editor"][data-feature-id="sig2"]')).toBeVisible();
      const station = page.getByTestId('station-sig2');
      await station.fill('0.20');
      await station.blur();

      // 0.20 mi is 1,056 ft, so segment 1 shortens and segment 2 lengthens.
      const rows = page.getByTestId('strip-seg');
      await expect(rows).toHaveCount(3);
      const widths = await rows.evaluateAll((els) =>
        els.map((e) => Number((e.querySelector('rect') as SVGRectElement).getAttribute('width')))
      );
      expect(widths[0]).toBeLessThan(widths[1]);

      // And undo puts it back, since every commit is one history step.
      await page.getByTestId('undo').click();
      await expect(page.getByTestId('station-sig2')).toHaveValue('0.34');
    });

    test('a signal edit changes the analysis, so the editor is wired to the engine', async ({ page }) => {
      await loadUrbanExample(page, 'ch30ep1');
      await page.getByTestId('analyze').click();
      await expect(page.getByTestId('urban-travel-speed')).toHaveText('23.67');

      // Triple the through control delay at every boundary. Chapter 18's travel
      // speed is the segment length over the running time plus the through
      // delay, so a larger delay must slow the facility. The assertion is
      // directional rather than a second published number, because this street
      // is no longer a published one.
      //
      // The delay is edited rather than the effective green, and the reason is
      // worth stating: on this segment the through control delay is a supplied
      // input and the full stop rate is overridden, so the effective green
      // reaches nothing in the Chapter 16 result at all. That inertness is
      // asserted in tests/builder/urban.mjs, where it can be pinned precisely.
      for (const id of ['sig2', 'sig3', 'sig4']) {
        await page.getByTestId(`expand-${id}`).click();
        const delay = page.getByTestId(`delay-${id}`);
        await delay.fill('60');
        await delay.blur();
        await page.getByTestId(`expand-${id}`).click();
      }
      // The old result stands and is marked stale rather than silently updating.
      await expect(page.getByTestId('results-stale')).toBeVisible();
      await page.getByTestId('analyze').click();
      await expect(page.getByTestId('results-stale')).toHaveCount(0);

      const speed = Number(await page.getByTestId('urban-travel-speed').textContent());
      expect(speed).toBeLessThan(23.67);
      // And the letter follows it down, so the change reached the Exhibit 16-3
      // banding and not only the arithmetic.
      await expect(page.getByTestId('urban-los')).toHaveText('E');
    });

    test('the Chapter 17 handoff reproduces Example Problem 4 and says what does not cross', async ({ page }) => {
      test.slow();
      await loadUrbanExample(page, 'ch29ep4');
      await expect(page.getByTestId('signal-marker')).toHaveCount(7);
      await expect(page.getByTestId('strip-seg')).toHaveCount(6);

      await page.getByTestId('analyze').click();
      await expect(page.getByTestId('urban-facility-summary')).toBeVisible();

      // The honesty panel is shown before the run as well as after it.
      const notes = page.getByTestId('urban-reliability-notes');
      await expect(notes).toBeVisible();
      await expect(notes.locator('[data-note-id="snowfall"]')).toContainText('never reads it');
      await expect(notes.locator('[data-note-id="per-scenario"]')).toContainText('summary-only');
      await expect(notes.locator('[data-note-id="atdm"]')).toContainText('1.156');
      await expect(notes.locator('[data-note-id="published-gap"]')).toContainText('Exhibit 29-73');

      await page.getByTestId('run-reliability').click();
      await expect(page.getByTestId('urban-reliability-summary')).toBeVisible({ timeout: 60_000 });

      // The values tests/boundary/ch17_urban_reliability.mjs pins, reached from
      // signals placed on a strip rather than from the fixture.
      await expect(page.getByTestId('urel-scenarios')).toHaveText('3,120');
      await expect(page.getByTestId('urel-tti-mean')).toHaveText('1.545');
      await expect(page.getByTestId('urel-pti')).toHaveText('1.746');
      await expect(page.getByTestId('urel-rating')).toHaveText('98.8');
    });

    test('an urban fixture imports as signals and exports byte-identically', async ({ page }) => {
      await openUrban(page);
      const fixture = join(LIB_CASES, 'UrbanFacilities', 'case3.json');
      await page.getByTestId('import-file').click();
      await page.locator('input[type=file]').setInputFiles(fixture);
      await expect(page.getByTestId('builder-message')).toContainText('boundary signals were recovered');

      // An urban fixture is invertible, so the import has a feature layer:
      // three segments give four boundary intersections.
      await expect(page.getByTestId('signal-marker')).toHaveCount(4);
      await expect(page.getByTestId('strip-seg')).toHaveCount(3);
      // The upstream terminus signal is marked, because no segment ended at it
      // for the fixture to have recorded its timing.
      await page.getByTestId('expand-sig1').click();
      await expect(page.getByTestId('inferred-note-sig1')).toContainText('defaults rather than measurements');

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('download-fixture').click()
      ]);
      const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
      expect(exported).toEqual(JSON.parse(readFileSync(fixture, 'utf8')));
    });

    test('the report and the Word export carry the urban run', async ({ page }) => {
      await loadUrbanExample(page, 'ch30ep1');
      await page.getByTestId('analyze').click();
      await expect(page.getByTestId('urban-los')).toHaveText('C');

      await page.getByTestId('open-report').click();
      await expect(page.locator('.report-title')).toContainText('Facility Builder');
      // The published travel speed rides into the report, and the report names
      // the chapter the run came from rather than the freeway one.
      await expect(page.locator('body')).toContainText('23.67');
      await expect(page.locator('body')).toContainText('Chapter 16');
      // There is no time-space domain on an urban report, because there is no
      // period axis to build one from.
      await expect(page.locator('body')).not.toContainText('Time-space domain');

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('download-docx').click()
      ]);
      const xml = readZipEntry(readFileSync(await download.path()), 'word/document.xml');
      expect(xml).toContain('23.67');
      expect(xml).toContain('Facility Builder');
      expect(xml).toContain('Chapter 16');
    });

    test('an empty urban street blocks the analysis and says why', async ({ page }) => {
      await openUrban(page);
      // No signals means no boundary intersections, so no Chapter 18 segment.
      const flags = page.getByTestId('validation-flag');
      await expect(flags.filter({ hasText: 'boundary intersections' }).first()).toBeVisible();
      await expect(page.getByTestId('analyze')).toBeDisabled();
    });
  });
});
