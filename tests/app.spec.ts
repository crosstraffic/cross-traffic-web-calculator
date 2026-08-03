import { expect, test } from '@playwright/test';

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
    await page.goto('/hcm13');
    await expect(page).toHaveURL(/\/hcm13$/);
    await page.goto('/hcm14');
    await expect(page).toHaveURL(/\/hcm14$/);
    await page.goto('/hcm15');
    await expect(page).toHaveURL(/\/hcm15$/);
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
    await expect(nav.locator('a[href="/hcm13"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm14"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm15"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm19"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm20"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm21"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm22"]')).toHaveCount(1);
    await expect(nav.locator('a[href="/hcm23"]')).toHaveCount(1);
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
    // hcm16 and hcm24 exist in the repo but are not in the RELEASED set of
    // src/routes/+layout.js; a direct visit must land on the home page.
    await page.goto('/hcm16');
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/hcm24');
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
});

test.describe('chapter 11 freeway reliability calculator', () => {
  test('default inputs run a deterministic whole-year scenario set', async ({ page }) => {
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

  test('the diamond diagram groups O-Ds, edits demands, and animates', async ({ page }) => {
    await page.goto('/hcm23');
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

test.describe('chapter 15 two-lane highway calculator', () => {
  test('page loads with its segment controls', async ({ page }) => {
    await page.goto('/hcm15');
    await expect(page).toHaveTitle(/Two-Lane Highways/);
    await expect(page.getByRole('heading', { name: 'Segments' })).toBeVisible();
  });
});
