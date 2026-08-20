// "Open in Builder" on the chapter pages the facility builder speaks.
//
// The claim under test is narrow and easy to fake, so each case makes it twice.
// First the segment table on the other side has to hold the same numbers the
// chapter form held, which catches a carrier that lost a field. Then the
// builder's own Analyze has to land on the number the chapter page published,
// which catches a carrier that moved a field to the wrong key or the wrong unit.
// A table that matches and an answer that does not means a unit slipped; an
// answer that matches while the table does not means the run read something
// other than the table.
//
// Every case drives the RENDERED pages rather than the mapping module, because
// the mapping module is not what an analyst clicks. The unit conversions these
// exercise (percent to decimal on four urban fields and two freeway ones, miles
// to feet on the two-lane import, lower-case select values to serde variant
// names on terrain, area type and boundary control) are all invisible in a
// passing form and all produce plausible wrong answers.

import { expect, test, type Page } from '@playwright/test';
import { libCase } from './libCases.mjs';

const HANDOFF_KEY = 'hcm-builder-handoff';

/** Press the affordance and wait for the builder to finish mounting. The button
 * is a link, so the navigation is real and the wasm init on the other side has
 * to complete before the segment table means anything. */
async function openInBuilder(page: Page) {
  await page.getByTestId('open-in-builder').click();
  await expect(page).toHaveURL(/\/builder$/);
  await expect(page.getByTestId('builder-body')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
}

/** The derived segment table as [type, length_ft, lanes] per row. Read off the
 * inputs rather than the cell text, because the table is editable and the text
 * of an editable cell is empty. */
async function segmentTable(page: Page) {
  const rows = page.getByTestId('segment-row');
  const out: string[][] = [];
  for (let i = 0; i < (await rows.count()); i++) {
    const r = rows.nth(i);
    out.push([
      await r.locator('select').inputValue(),
      await r.locator('input[type="number"]').nth(0).inputValue(),
      await r.locator('input[type="number"]').nth(1).inputValue(),
    ]);
  }
  return out;
}

test.describe('open in builder', () => {
  test('chapter 10 carries the published freeway facility and reproduces 56.9 mi/h', async ({ page }) => {
    // HCM Chapter 25 Example Problem 1, filled exactly as the chapter page's
    // own published-example test fills it. The freeway fixture is the one of
    // the three that does not invert, so the builder is expected to show it as
    // segments with no feature layer rather than as placed ramps.
    await page.goto('/hcm10');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#FFS_input').fill('60');
    await page.locator('#HV_input').fill('2.25');
    await page.locator('#PHF_input').fill('1.0');
    await page.locator('#ID_input').fill('0.8');
    await page.locator('#DEMAND_input').fill('4505, 4955, 5225, 4685, 3785');

    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: '+ Add Segment' }).click();
    }

    const spec: [string, string, string, string, string][] = [
      ['Basic', '5280', '3', '', ''],
      ['Merge', '1500', '3', '450, 540, 630, 360, 180', ''],
      ['Basic', '2280', '3', '', ''],
      ['Diverge', '1500', '3', '', '270, 360, 270, 270, 270'],
      ['Basic', '5280', '3', '', ''],
      ['Weaving', '2640', '4', '540, 720, 810, 360, 270', '360, 360, 360, 360, 180'],
      ['Basic', '5280', '3', '', ''],
      ['Merge', '1140', '3', '450, 540, 630, 450, 270', ''],
      ['OverlappingRamp', '360', '3', '', ''],
      ['Diverge', '1140', '3', '', '270, 270, 450, 270, 180'],
      ['Basic', '5280', '3', '', ''],
    ];
    for (const [i, [type, len, lanes, on, off]] of spec.entries()) {
      const row = page.locator('.seg-table tbody tr').nth(i);
      await row.locator('select').selectOption(type);
      await row.locator('td').nth(2).locator('input').fill(len);
      await row.locator('td').nth(3).locator('input').fill(lanes);
      if (on) await row.locator('td').nth(4).locator('input').fill(on);
      if (off) await row.locator('td').nth(5).locator('input').fill(off);
    }
    await page.locator('#SL_input6').fill('1640');
    await page.locator('#NWL_input6').fill('2');
    await page.locator('#LCRF_input6').fill('1');
    await page.locator('#LCFR_input6').fill('1');
    await page.locator('#RR_input6').fill('50, 100, 150, 80, 50');

    await openInBuilder(page);

    // The handoff is consumed by the read, so a later visit to /builder shows
    // the autosaved slot rather than replaying this facility.
    expect(await page.evaluate((k) => sessionStorage.getItem(k), HANDOFF_KEY)).toBeNull();

    // Every segment, in order, with the lengths and lane counts the form held.
    expect(await segmentTable(page)).toEqual(spec.map(([t, l, n]) => [t, l, n]));
    await expect(page.getByTestId('imported-note')).toBeVisible();
    await expect(page.getByTestId('handoff-note')).toContainText('Chapter 10');
    await expect(page.getByTestId('handoff-note')).toContainText('Everything that page holds came across');

    // Exhibit 25-52: 56.9 mi/h over 6.00 mi. The chapter page prints the same
    // number from the same fixture, which is the whole point of the carrier.
    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('overall-speed')).toHaveText('56.9');
    await expect(page.getByTestId('facility-los-row').locator('td')).toHaveText(['D', 'D', 'E', 'D', 'C']);
  });

  test('chapter 10 names the managed lane as the one thing that cannot come across', async ({ page }) => {
    // The builder document has no second lane group, so an enabled managed lane
    // is the page's one genuinely uncarried input. It has to be named on the
    // other side rather than quietly left behind, and the default facility is
    // enough to check that: what is being tested is the disclosure, not the
    // managed lane's numbers.
    await page.goto('/hcm10');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('checkbox', { name: 'Enable managed lane' }).check();

    await openInBuilder(page);
    await expect(page.getByTestId('handoff-note')).toContainText('managed lane');
    await expect(page.getByTestId('handoff-note')).not.toContainText('Everything that page holds came across');
  });

  test('chapter 15 carries a library fixture with its curves and reproduces the facility follower density', async ({
    page,
  }) => {
    // case2.json is Chapter 26 Example Problem 2, EP1 plus eleven horizontal
    // curve subsegments. It is the hardest of the five carriers: the segment
    // length is MILES in the schema and FEET in the builder document, a
    // subsegment length is feet on both sides and must not be converted, and
    // the curves have to survive as curves. Dropping them lands on EP1's flat
    // 10.092, which is a plausible number and not this one.
    await page.goto('/hcm15');
    const calculate = page.getByRole('button', { name: 'Calculate' });
    await expect(calculate).toBeEnabled({ timeout: 30_000 });

    await page.locator('#jsonInput').setInputFiles(libCase('TwoLaneHighways', 'case2.json'));
    await expect(page.locator('#design_radius2')).toHaveValue('450');
    await calculate.click();
    await expect(page.locator('#fdF')).toContainText('10.933');

    await openInBuilder(page);

    // A Chapter 15 fixture inverts, so the highway arrives as placed features
    // and the segment table is derived from them rather than being the import.
    expect(await segmentTable(page)).toEqual([['Passing Constrained', '3960', '1']]);
    await expect(page.getByTestId('handoff-note')).toContainText('Chapter 15');
    // The fixture's eleven subsegments are five real curves and six tangent
    // fillers, and only the curves are features. This is the half of the trip
    // the segment table cannot show, because a curve is a subsegment inside a
    // segment rather than a segment, so the table has one row either way.
    await expect(page.getByTestId('twolane-curve-table').getByTestId('twolane-feature-row')).toHaveCount(5);

    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('twolane-fd')).toHaveText('10.933');
    await expect(page.getByTestId('twolane-los')).toHaveText('D');
  });

  test('an incomplete form refuses the handoff instead of carrying half a facility', async ({ page }) => {
    // /hcm15 opens with one segment and no passing type chosen, which is the
    // state its own Calculate refuses too. The mapping has no honest number to
    // write for it, so the click has to stay on the page and say which field
    // is missing rather than land in a builder holding a guess.
    await page.goto('/hcm15');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });

    await page.getByTestId('open-in-builder').click();
    await expect(page).toHaveURL(/\/hcm15$/);
    await expect(page.getByTestId('open-in-builder-error')).toContainText('passing type for segment 1');
    expect(await page.evaluate((k) => sessionStorage.getItem(k), HANDOFF_KEY)).toBeNull();
  });

  test('chapter 16 carries the segment-inputs facility and reproduces its travel speed', async ({ page }) => {
    // The page's defaults are Chapter 30 Section 8 Example Problem 1 replicated
    // as three identical 1,800-ft segments: base FFS 40.78, travel speed 23.67,
    // LOS C. Four of the carried fields are percentages on the page and
    // decimals in the schema, and each of them moves this number if it is
    // carried as a percent.
    await page.goto('/hcm16');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });

    await openInBuilder(page);

    // An urban fixture inverts: three segments come back as four boundary
    // signals, and the segment table is derived from them.
    expect(await segmentTable(page)).toEqual([
      ['Signalized', '1800', '2'],
      ['Signalized', '1800', '2'],
      ['Signalized', '1800', '2'],
    ]);
    await expect(page.getByTestId('handoff-note')).toContainText('Chapter 16');
    await expect(page.getByTestId('urban-signal-table')).toBeVisible();

    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('urban-travel-speed')).toHaveText('23.67');
    await expect(page.getByTestId('urban-base-ffs')).toHaveText('40.78');
    await expect(page.getByTestId('urban-los')).toHaveText('C');
  });

  test('chapter 16 summary mode offers no handoff and says what it is short of', async ({ page }) => {
    // A summary segment holds a length and five published measures. The library
    // schema requires a through demand on every segment, and the page holds
    // none, so carrying this mode would mean inventing one. The affordance is
    // absent rather than present and broken.
    await page.goto('/hcm16');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByTestId('open-in-builder')).toBeVisible();

    await page.locator('#MODE_input').selectOption('measures');
    await expect(page.getByTestId('open-in-builder')).toHaveCount(0);
    // The whole sentence, not just its opening, because the list of what the
    // mode is short of is interpolated and a lost space either side of the
    // interpolation is invisible in the source and obvious on the page.
    await expect(page.getByText(/does not open in the facility builder/)).toContainText(
      'needs a through demand, a through-lane count and a speed limit per segment',
    );

    // And switching back restores it, so the absence is about the mode rather
    // than about having touched the form.
    await page.locator('#MODE_input').selectOption('inputs');
    await expect(page.getByTestId('open-in-builder')).toBeVisible();
  });

  test('chapter 18 carries one segment as a one-segment facility and reproduces its travel speed', async ({ page }) => {
    // A Chapter 18 segment is not a facility, and this is the one carrier that
    // changes what is being looked at. The segment's own travel speed has to
    // survive the trip unchanged; the facility aggregation over the single
    // segment is what is added.
    await page.goto('/hcm18');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });

    await openInBuilder(page);

    expect(await segmentTable(page)).toEqual([['Signalized', '1800', '2']]);
    await expect(page.getByTestId('handoff-note')).toContainText('Chapter 18');

    await page.getByTestId('analyze').click();
    await expect(page.getByTestId('urban-travel-speed')).toHaveText('23.67');
    await expect(page.getByTestId('urban-los')).toHaveText('C');
  });

  test('chapter 17 offers no handoff, because reliability is not a facility type', async ({ page }) => {
    // Chapter 17 holds six segments' geometry AND a year of weather normals,
    // per-segment crash frequencies, three generator seeds and the ATDM
    // strategies. The builder's urban reliability panel exposes four of those
    // inputs, so a handoff would drop most of what this page holds and could
    // not reproduce its reliability rating. Pinned so the affordance is not
    // added here by symmetry with the other four.
    await page.goto('/hcm17');
    await expect(page.getByRole('button', { name: 'Calculate' })).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByTestId('open-in-builder')).toHaveCount(0);
  });
});
