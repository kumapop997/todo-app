// @ts-check
// docs/test-case.md 3.4 再判定（TICK）。開いたあと再読み込みをせずに clock を進める。
const {
  test, expect, open, ui, t, jst, selectTab, expectSelectedTab, expectSections, expectSectionOf,
  expectRed, openNew, typeDetail, advance,
} = require('./helpers');

const LATE_NIGHT = jst('2026-10-07 23:59:00');

test.describe('再判定', () => {
  test('TICK-01 締め切りを過ぎると、再読み込みなしで [期限切れ] に移る', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 14:01'), t('B', '10/7 18:00')] });
    await expectSections(page, [['本日中', ['A', 'B']]]);
    await advance(page, 2);
    await expectSections(page, [['期限切れ', ['A']], ['本日中', ['B']]]);
  });

  test('TICK-02 締め切りを過ぎると、締め切り表示が赤字に変わる', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 14:01'), t('B', '10/7 18:00')] });
    const due = ui(page).due('A');
    await expect(due).toHaveText('10月7日 14:01');
    await expectRed(due, false);
    await advance(page, 2);
    await expectRed(due, true);
  });

  test('TICK-03 日付が変わると [明日まで] から [本日中] に移る', async ({ page }) => {
    await open(page, { todos: [t('A', '10/8 9:00')], now: LATE_NIGHT });
    await expectSectionOf(page, 'A', '明日まで');
    await advance(page, 2);
    await expectSectionOf(page, 'A', '本日中');
  });

  test('TICK-04 日付が変わると、前日の日のみ指定は [期限切れ] に移る', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7')], now: LATE_NIGHT });
    await expectSectionOf(page, 'A', '本日中');
    await advance(page, 2);
    await expectSectionOf(page, 'A', '期限切れ');
  });

  test('TICK-05 日付が変わると [それ以外] から [明日まで] に移る', async ({ page }) => {
    await open(page, { todos: [t('A', '10/9')], now: LATE_NIGHT });
    await expectSectionOf(page, 'A', 'それ以外');
    await advance(page, 2);
    await expectSectionOf(page, 'A', '明日まで');
  });

  test('TICK-06 区分が入れ替わると、見出しも入れ替わる', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 14:01')] });
    const u = ui(page);
    await expect(u.sectionHeading('本日中')).toBeVisible();
    await advance(page, 2);
    await expect(u.sectionHeading('期限切れ')).toBeVisible();
    await expect(u.sectionHeading('本日中')).toHaveCount(0);
  });

  test('TICK-07 詳細画面で入力中でも背後の一覧は再判定され、入力は消えない', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 14:01')] });
    const u = ui(page);
    await openNew(page, '入力中');
    await typeDetail(page, 'メモ');
    await advance(page, 2);
    await expectSections(page, [['期限切れ', ['A']]]);
    await expect(u.dialog).toBeVisible();
    await expect(u.titleInput).toHaveValue('入力中');
    await expect(u.editor).toHaveText('メモ');
  });

  test('TICK-08 年が変わると、締め切り表示から年が外れる', async ({ page }) => {
    await open(page, { todos: [t('A', '2027/1/5')], now: jst('2026-12-31 23:59:00') });
    const due = ui(page).due('A');
    await expect(due).toHaveText('2027年1月5日');
    await advance(page, 2);
    await expect(due).toHaveText('1月5日');
  });

  test('TICK-09 再判定しても選択中のタブは変わらない', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 14:01')] });
    await selectTab(page, 'すべて');
    await expectSectionOf(page, 'A', '本日中');
    await advance(page, 2);
    await expectSectionOf(page, 'A', '期限切れ');
    await expectSelectedTab(page, 'すべて');
  });
});
