// @ts-check
// docs/test-case.md 3.5 一覧の行・締め切りの書式（ROW）
const {
  test, expect, open, ui, t, done, LONG_TITLE, selectTab, expectTitles, expectSectionOf,
  expectRed, expectGray, expectStrike, rgbOf, box, expectNoHScroll, reopenWithTodos,
} = require('./helpers');

/** 締め切りの書式: [ID, 締め切り, 表示] */
const FORMATS = [
  ['ROW-01', '10/7 15:30', '10月7日 15:30'],
  ['ROW-02', '10/7', '10月7日'],
  ['ROW-03', '2027/1/5 09:05', '2027年1月5日 9:05'],
  ['ROW-04', '2027/1/5', '2027年1月5日'],
  ['ROW-05', '2025/12/31 23:59', '2025年12月31日 23:59'],
  ['ROW-06', '10/8 00:05', '10月8日 0:05'],
];

test.describe('一覧の行・締め切りの書式', () => {
  for (const [id, due, text] of FORMATS) {
    test(`${id} 締め切り ${due} は「${text}」と表示される`, async ({ page }) => {
      await open(page, { todos: [t('A', due)] });
      await expect(ui(page).due('A')).toHaveText(text);
    });
  }

  test('ROW-07 締め切りなしの行は締め切り表示が空', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const u = ui(page);
    await expect(u.row('A')).toBeVisible();
    await expect(u.due('A')).toHaveText('');
  });

  test('ROW-08 未完了の期限切れは締め切り表示が赤字', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 13:00')] });
    await expectRed(ui(page).due('A'), true);
  });

  test('ROW-09 期限切れでない行の締め切り表示は赤字でない', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 15:00'), t('B', '10/8'), t('C', '10/9')] });
    const u = ui(page);
    for (const title of ['A', 'B', 'C']) {
      await expect(u.due(title)).not.toHaveText('');
      await expectRed(u.due(title), false);
    }
  });

  test('ROW-10 完了済みの期限切れは [期限切れ] に並ぶが赤字にしない', async ({ page }) => {
    await open(page, { todos: [done('A', '10/6')] });
    await selectTab(page, 'すべて');
    await expectSectionOf(page, 'A', '期限切れ');
    await expectRed(ui(page).due('A'), false);
  });

  test('ROW-11 完了済みのタイトルには取り消し線が付く', async ({ page }) => {
    await open(page, { todos: [t('A', '10/8'), done('B', '10/8')] });
    await selectTab(page, 'すべて');
    const u = ui(page);
    await expectStrike(u.title('B'), true);
    await expectStrike(u.title('A'), false);
  });

  test('ROW-12 完了済みの行はタイトルと締め切り表示がグレー', async ({ page }) => {
    await open(page, { todos: [t('A', '10/8'), done('B', '10/8')] });
    await selectTab(page, 'すべて');
    const u = ui(page);
    const normal = await rgbOf(u.title('A'));
    await expectGray(u.title('B'), normal);
    await expectGray(u.due('B'), normal);
    // A はグレーでない（完了済みの行と色が違う）
    expect((await rgbOf(u.title('A'))).join()).not.toBe((await rgbOf(u.title('B'))).join());
    expect((await rgbOf(u.due('A'))).join()).not.toBe((await rgbOf(u.due('B'))).join());
  });

  test('ROW-13 未完了の行には [完了] と [削除] がある', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const u = ui(page);
    await expect(u.completeButton('A')).toBeVisible();
    await expect(u.deleteButton('A')).toBeVisible();
    await expect(u.revertButton('A')).toHaveCount(0);
  });

  test('ROW-14 完了済みの行には [未完了に戻す] と [削除] がある', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    await selectTab(page, '完了済');
    const u = ui(page);
    await expect(u.revertButton('A')).toBeVisible();
    await expect(u.deleteButton('A')).toBeVisible();
    await expect(u.completeButton('A')).toHaveCount(0);
  });

  test('ROW-15 [未完了] で [完了] を押すと、その行だけ一覧から消える', async ({ page }) => {
    await open(page, { todos: [t('A'), t('B')] });
    await ui(page).completeButton('A').click();
    await expectTitles(page, ['B']);
  });

  test('ROW-16 [すべて] で [完了] を押すと、同じ区分に残って完了済みの見た目になる', async ({ page }) => {
    await open(page, { todos: [t('A', '10/8')] });
    await selectTab(page, 'すべて');
    const u = ui(page);
    const normal = await rgbOf(u.title('A'));
    await u.completeButton('A').click();
    await expectSectionOf(page, 'A', '明日まで');
    await expectStrike(u.title('A'), true);
    await expectGray(u.title('A'), normal);
    await expect(u.revertButton('A')).toBeVisible();
    await expect(u.completeButton('A')).toHaveCount(0);
  });

  test('ROW-17 [完了済] で [未完了に戻す] を押すと、その行だけ消えて [未完了] に現れる', async ({ page }) => {
    await open(page, { todos: [done('A'), done('B')] });
    await selectTab(page, '完了済');
    await ui(page).revertButton('A').click();
    await expectTitles(page, ['B']);
    await selectTab(page, '未完了');
    await expectTitles(page, ['A']);
  });

  test('ROW-18 [すべて] で [未完了に戻す] を押すと、完了済みの見た目が外れる', async ({ page }) => {
    await open(page, { todos: [done('A', '10/8')] });
    await selectTab(page, 'すべて');
    const u = ui(page);
    await expectStrike(u.title('A'), true);
    const completedColor = await rgbOf(u.title('A'));
    await u.revertButton('A').click();
    await expect(u.completeButton('A')).toBeVisible();
    await expect(u.revertButton('A')).toHaveCount(0);
    await expectStrike(u.title('A'), false);
    await expect.poll(async () => (await rgbOf(u.title('A'))).join()).not.toBe(completedColor.join());
  });

  test('ROW-19 最後の 1 件を [完了] にすると、空メッセージが表示される', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const u = ui(page);
    await u.completeButton('A').click();
    await expectTitles(page, []);
    await expect(u.emptyMessage('未完了')).toBeVisible();
  });

  test('ROW-20 タイトルをクリックすると、その ToDo の詳細画面が開く', async ({ page }) => {
    await open(page, { todos: [t('A'), t('B')] });
    const u = ui(page);
    await u.title('B').click();
    await expect(u.dialog).toBeVisible();
    await expect(u.titleInput).toHaveValue('B');
  });

  test('ROW-21 長いタイトルは全文を折り返して表示し、横スクロールしない', async ({ page }) => {
    await open(page, { todos: [t(LONG_TITLE)] });
    const u = ui(page);
    await expect(u.title(LONG_TITLE)).toHaveText(LONG_TITLE);
    await expectNoHScroll(page);
    const long = await box(u.row(LONG_TITLE));
    // 比べる相手として、短いタイトルの行の高さを測る
    await reopenWithTodos(page, [t('A')]);
    const short = await box(u.row('A'));
    expect(long.height).toBeGreaterThan(short.height);
  });

  test('ROW-22 完了済みの期限切れを未完了に戻すと、締め切り表示が赤字になる', async ({ page }) => {
    await open(page, { todos: [done('A', '10/6')] });
    await selectTab(page, 'すべて');
    const u = ui(page);
    await expectRed(u.due('A'), false);
    await u.revertButton('A').click();
    await expect(u.completeButton('A')).toBeVisible();
    await expectRed(u.due('A'), true);
  });
});
