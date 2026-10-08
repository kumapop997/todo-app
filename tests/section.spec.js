// @ts-check
// docs/test-case.md 3.2 区分（SEC）
const {
  test, expect, open, ui, t, done, jst, TABS, SECTIONS, selectTab, expectSections,
} = require('./helpers');

const FOUR = [t('D'), t('C', '10/8'), t('B', '10/7 15:00'), t('A', '10/6')];

/** 開く（[未完了]）だけで区分を確かめるケース: [ID, 説明, 前提, 期待する区分, 今] */
const CASES = [
  ['SEC-01', '10/7 13:00 は [期限切れ]', [t('A', '10/7 13:00')], [['期限切れ', ['A']]]],
  ['SEC-02', '10/6（日のみ）は [期限切れ]', [t('A', '10/6')], [['期限切れ', ['A']]]],
  ['SEC-03', '10/7 15:30 は [本日中]', [t('A', '10/7 15:30')], [['本日中', ['A']]]],
  ['SEC-04', '10/7（日のみ）は [本日中]', [t('A', '10/7')], [['本日中', ['A']]]],
  ['SEC-05', '10/8 9:00 は [明日まで]', [t('A', '10/8 9:00')], [['明日まで', ['A']]]],
  ['SEC-06', '10/9（日のみ）は [それ以外]', [t('A', '10/9')], [['それ以外', ['A']]]],
  ['SEC-07', '締め切りなしは [それ以外]', [t('A')], [['それ以外', ['A']]]],
  ['SEC-08', '締め切り時点が今ちょうど（10/7 14:00）は [本日中]', [t('A', '10/7 14:00')], [['本日中', ['A']]]],
  ['SEC-09', '10/7 13:59 は [期限切れ]', [t('A', '10/7 13:59')], [['期限切れ', ['A']]]],
  ['SEC-10', '10/7 23:59 は [本日中]', [t('A', '10/7 23:59')], [['本日中', ['A']]]],
  ['SEC-11', '10/8 0:00 は [明日まで]', [t('A', '10/8 0:00')], [['明日まで', ['A']]]],
  ['SEC-12', '10/8 23:59 は [明日まで]', [t('A', '10/8 23:59')], [['明日まで', ['A']]]],
  ['SEC-13', '10/8（日のみ）は [明日まで]', [t('A', '10/8')], [['明日まで', ['A']]]],
  ['SEC-14', '10/9 0:00 は [それ以外]', [t('A', '10/9 0:00')], [['それ以外', ['A']]]],
  ['SEC-15', '今が 23:59:30 でも当日の日のみ指定は [本日中]', [t('A', '10/7')], [['本日中', ['A']]], jst('2026-10-07 23:59:30')],
  ['SEC-16', '翌日 0:00:00 になると前日の日のみ指定は [期限切れ]', [t('A', '10/7')], [['期限切れ', ['A']]], jst('2026-10-08 00:00:00')],
  [
    'SEC-17', '月をまたいでも [明日まで] と [それ以外] を判定できる',
    [t('A', '11/1 9:00'), t('B', '11/2')],
    [['明日まで', ['A']], ['それ以外', ['B']]],
    jst('2026-10-31 14:00'),
  ],
  [
    'SEC-18', '年をまたいでも [明日まで] と [それ以外] を判定できる',
    [t('A', '2027/1/1'), t('B', '2027/1/2 0:00')],
    [['明日まで', ['A']], ['それ以外', ['B']]],
    jst('2026-12-31 14:00'),
  ],
  [
    'SEC-19', 'うるう年の 2/29 を [明日まで] と判定できる',
    [t('A', '2028/2/29'), t('B', '2028/3/1')],
    [['明日まで', ['A']], ['それ以外', ['B']]],
    jst('2028-02-28 14:00'),
  ],
  [
    'SEC-20', '区分は [期限切れ] [本日中] [明日まで] [それ以外] の順に並ぶ',
    FOUR,
    [['期限切れ', ['A']], ['本日中', ['B']], ['明日まで', ['C']], ['それ以外', ['D']]],
  ],
];

test.describe('区分', () => {
  for (const [id, name, todos, expected, now] of CASES) {
    test(`${id} ${name}`, async ({ page }) => {
      await open(page, { todos, now });
      await expectSections(page, expected);
    });
  }

  test('SEC-21 0 件の区分は見出しを表示しない', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 15:00')] });
    await expectSections(page, [['本日中', ['A']]]);
    const u = ui(page);
    await expect(u.sectionHeading('本日中')).toBeVisible();
    for (const name of ['期限切れ', '明日まで', 'それ以外']) {
      await expect(u.sectionHeading(name)).toHaveCount(0);
    }
  });

  test('SEC-22 [すべて] では完了済みも同じ区分に入る', async ({ page }) => {
    await open(page, { todos: [done('A', '10/6'), t('B', '10/7 15:00'), done('C')] });
    await selectTab(page, 'すべて');
    await expectSections(page, [['期限切れ', ['A']], ['本日中', ['B']], ['それ以外', ['C']]]);
  });

  test('SEC-25 4 つの見出しそれぞれの直後に hr が 1 本ずつある', async ({ page }) => {
    await open(page, { todos: FOUR });
    const u = ui(page);
    await expect(u.list.locator('hr')).toHaveCount(4);
    for (const name of SECTIONS) {
      const next = u.sectionHeading(name).locator('xpath=following-sibling::*[1]');
      await expect(next).toHaveJSProperty('tagName', 'HR');
      await expect(next).toBeVisible();
    }
  });

  test('SEC-26 区分が 1 つなら hr は 1 本で、見出しの直後にある', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 15:00'), t('B', '10/7 16:00')] });
    const u = ui(page);
    await expectSections(page, [['本日中', ['A', 'B']]]);
    await expect(u.list.locator('hr')).toHaveCount(1);
    const next = u.sectionHeading('本日中').locator('xpath=following-sibling::*[1]');
    await expect(next).toHaveJSProperty('tagName', 'HR');
  });

  test('SEC-27 [完了済] の一覧には hr がない', async ({ page }) => {
    await open(page, { todos: [done('A', '10/6'), done('B')] });
    await selectTab(page, '完了済');
    const u = ui(page);
    await expect(u.titles).toHaveCount(2);
    await expect(u.list.locator('hr')).toHaveCount(0);
  });

  test('SEC-28 空の一覧には、どのタブでも hr がない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    for (const name of TABS) {
      await selectTab(page, name);
      await expect(u.emptyMessage(name)).toBeVisible();
      await expect(u.list.locator('hr')).toHaveCount(0);
    }
  });
});

test.describe('区分（タイムゾーン America/Los_Angeles）', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('SEC-23 日付を UTC として解釈せず、現地の日付で区分を判定する', async ({ page }) => {
    await open(page, {
      todos: [t('A', '10/7'), t('B', '10/8'), t('C', '10/6')],
      now: '2026-10-07T14:00:00-07:00',
    });
    await expectSections(page, [['期限切れ', ['C']], ['本日中', ['A']], ['明日まで', ['B']]]);
  });

  test('SEC-24 夏時間が終わる 25 時間の日でも、日付の境目で区分を判定する', async ({ page }) => {
    await open(page, {
      todos: [t('A', '11/1 23:30'), t('B', '11/2'), t('C', '11/3 0:00')],
      now: '2026-11-01T00:30:00-07:00',
    });
    await expectSections(page, [['本日中', ['A']], ['明日まで', ['B']], ['それ以外', ['C']]]);
  });
});
