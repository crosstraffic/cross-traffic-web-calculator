import { expect, test, type Page } from '@playwright/test';

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

  test('the site works fully offline once visited', async ({ page, context, browserName }) => {
    // Service-worker + offline emulation is only dependable in chromium.
    test.skip(browserName !== 'chromium', 'service worker test runs on chromium');

    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1500); // precache settles

    await context.setOffline(true);
    // A chapter page never visited in this session: shell, page, and the wasm
    // engine must all come from the cache, and the engine must compute.
    await page.goto('/hcm14');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();
    await expect(page.getByText(/Segment LOS: [A-F]/)).toBeVisible();
    await context.setOffline(false);
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
});

test.describe('chapter 11 freeway reliability calculator', () => {
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

    // No published example fits this page's reduced scope (no weather model, no
    // custom demand multipliers), so this pins the engine's deterministic output
    // for the default facility with rng seed 1: 12 months x 5 weekdays x 4
    // replications = 240 scenarios, 4 periods each = 960 observations, and the
    // exact metric values the seeded run produces. Any engine change that moves
    // these numbers must be deliberate.
    await page.goto('/hcm11');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await calculate.click();

    const cell = (label) => page.locator('tr', { hasText: label }).first().locator('td');
    await expect(cell('Scenarios Evaluated:')).toHaveText('240', { timeout: 60_000 });
    await expect(cell('Travel Time Observations:')).toHaveText('960');
    await expect(cell('Free-Flow Travel Time (min):')).toHaveText('2.28');
    await expect(cell('Mean TTI:')).toHaveText('1.264');
    await expect(cell('50th Percentile TTI:')).toHaveText('1.097');
    await expect(cell('95th Percentile TTI (PTI):')).toHaveText('1.698');
    await expect(page.getByText(/Reliability Rating: 62\.9/)).toBeVisible();
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
    await expect(page.getByText(/26\.[0-9]/)).toBeVisible(); // D ≈ 26.3
    await expect(page.getByText(/53\.[0-9]/).first()).toBeVisible(); // S ≈ 53.1
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
    await expect(page.getByText(/23\.[0-9]/)).toBeVisible(); // D ≈ 23.6
    await expect(page.getByText(/59\.[0-9]/).first()).toBeVisible(); // S_o ≈ 59.32
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
    await expect(page.getByText(/28\.[0-9]/)).toBeVisible(); // D_R ≈ 28.2
    await expect(page.getByText(/5[23]\.[0-9]/).first()).toBeVisible(); // S_R ≈ 53.0
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
    await expect(page.getByText(/32\.[0-9]/)).toBeVisible(); // density ≈ 32.1
    await expect(page.getByText(/55\.[0-9]/).first()).toBeVisible(); // S ≈ 55.1
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
    // interchange ETT of 52.4 s/veh, LOS C, and O-D A at 47.9 s ETT LOS C.
    await page.goto('/hcm23');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });
    await calculate.click();

    const rowA = page.locator('.results-panel tbody tr', { has: page.locator('th:text-is("A")') }).first();
    await expect(rowA).toContainText('47.9');
    await expect(rowA).toContainText('C');
    await expect(page.getByText(/Interchange LOS: C/)).toBeVisible();
    await expect(page.getByText(/52\.4/).first()).toBeVisible();

    await page.getByRole('link', { name: 'Open printable report' }).click();
    await expect(page.locator('.report-title')).toHaveText('Ramp Terminals and Alternative Intersections');
  });

  test('the DDI form loads Example Problem 5 and reproduces its answer', async ({ page }) => {
    // Switching to the diverging diamond loads Chapter 34 Example Problem 5
    // as defaults. The engine's demand-weighted interchange ETT is 34.8 s/veh
    // LOS C against the published 34.9 C (library-documented delta), with the
    // known O-D E band difference recorded in the library suite.
    await page.goto('/hcm23');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FORM_input').selectOption('Ddi');
    await expect(page.locator('#CYCLE_input')).toHaveValue('70');
    await expect(page.locator('.dd-diagram svg')).toHaveAttribute('aria-label', /diverging diamond/);
    await calculate.click();

    await expect(page.getByText(/Interchange LOS: C/)).toBeVisible();
    await expect(page.getByText(/34\.8/).first()).toBeVisible();

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
