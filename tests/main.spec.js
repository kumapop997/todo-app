// @ts-check
// docs/test-case.md 3.1 メイン画面の構成・タブ・空の状態（MAIN）
const {
  test, expect, open, ui, t, done, TABS, SECTIONS, EMPTY,
  selectTab, expectSelectedTab, expectTitles, box,
} = require('./helpers');

test.describe('メイン画面の構成・タブ・空の状態', () => {
  test('MAIN-01 見出し・[新規]・タブ・[完了済を削除]・一覧が上から順に表示される', async ({ page }) => {
    await open(page);
    const u = ui(page);
    const tabs = TABS.map((name) => u.tab(name));
    for (const locator of [u.heading, u.newButton, ...tabs, u.clearDone, u.list]) {
      await expect(locator).toBeVisible();
    }
    const heading = await box(u.heading);
    const newButton = await box(u.newButton);
    const clearDone = await box(u.clearDone);
    const list = await box(u.list);
    expect(heading.bottom).toBeLessThanOrEqual(newButton.y + 1);
    for (const tab of tabs) {
      const b = await box(tab);
      expect(newButton.bottom).toBeLessThanOrEqual(b.y + 1);
      expect(b.bottom).toBeLessThanOrEqual(list.y + 1);
      // [完了済を削除] はタブより上には来ない（同じ段の右寄せは可）
      expect(clearDone.bottom).toBeGreaterThan(b.y);
    }
    expect(newButton.bottom).toBeLessThanOrEqual(clearDone.y + 1);
    expect(clearDone.bottom).toBeLessThanOrEqual(list.y + 1);
    await expect(u.dialog).toBeHidden();
  });

  test('MAIN-02 起動時は [未完了] タブだけが選択中', async ({ page }) => {
    await open(page);
    await expectSelectedTab(page, '未完了');
  });

  test('MAIN-03 [すべて] を選んで再読み込みすると [未完了] が選択中に戻る', async ({ page }) => {
    await open(page);
    await selectTab(page, 'すべて');
    await page.reload();
    await expectSelectedTab(page, '未完了');
  });

  test('MAIN-04 タブを選ぶたびに、選んだタブだけが選択中になる', async ({ page }) => {
    await open(page);
    for (const name of ['すべて', '完了済', '未完了']) {
      await ui(page).tab(name).click();
      await expectSelectedTab(page, name);
    }
  });

  test('MAIN-05 [未完了] は未完了だけを表示する', async ({ page }) => {
    await open(page, { todos: [t('A'), done('B')] });
    await expectSelectedTab(page, '未完了');
    await expectTitles(page, ['A']);
  });

  test('MAIN-06 [すべて] は全件を表示する', async ({ page }) => {
    await open(page, { todos: [t('A'), done('B')] });
    await selectTab(page, 'すべて');
    await expectTitles(page, ['A', 'B']);
  });

  test('MAIN-07 [完了済] は完了済みだけを表示する', async ({ page }) => {
    await open(page, { todos: [t('A'), done('B')] });
    await selectTab(page, '完了済');
    await expectTitles(page, ['B']);
  });

  test('MAIN-08 [完了済] は区分の見出しを表示しない', async ({ page }) => {
    await open(page, { todos: [done('A', '10/6'), done('B', '10/7 15:00'), done('C', '10/8'), done('D')] });
    await selectTab(page, '完了済');
    const u = ui(page);
    await expect(u.titles).toHaveCount(4);
    for (const name of SECTIONS) await expect(u.sectionHeading(name)).toHaveCount(0);
  });

  test('MAIN-09 データなしの [未完了] に空メッセージが表示される', async ({ page }) => {
    await open(page);
    await expect(ui(page).emptyMessage('未完了')).toBeVisible();
  });

  test('MAIN-10 データなしの [すべて] に空メッセージが表示される', async ({ page }) => {
    await open(page);
    await selectTab(page, 'すべて');
    await expect(ui(page).emptyMessage('すべて')).toBeVisible();
  });

  test('MAIN-11 データなしの [完了済] に空メッセージが表示される', async ({ page }) => {
    await open(page);
    await selectTab(page, '完了済');
    await expect(ui(page).emptyMessage('完了済')).toBeVisible();
  });

  test('MAIN-12 完了済みしかないとき [未完了] に空メッセージが表示される', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    await expect(ui(page).emptyMessage('未完了')).toBeVisible();
    await expectTitles(page, []);
  });

  test('MAIN-13 未完了しかないとき [完了済] に空メッセージが表示される', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    await selectTab(page, '完了済');
    await expect(ui(page).emptyMessage('完了済')).toBeVisible();
    await expectTitles(page, []);
  });

  test('MAIN-14 表示する ToDo があるタブでは、空メッセージはどれも表示されない', async ({ page }) => {
    await open(page, { todos: [t('A'), done('B')] });
    const shown = { すべて: ['A', 'B'], 未完了: ['A'], 完了済: ['B'] };
    for (const name of TABS) {
      await selectTab(page, name);
      await expectTitles(page, shown[name]);
      for (const message of Object.values(EMPTY)) {
        await expect(page.getByText(message, { exact: true })).toHaveCount(0);
      }
    }
  });

  test('MAIN-15 [完了済を削除] は右寄せ（左端が画面の中央より右）', async ({ page }) => {
    await open(page);
    const clearDone = await box(ui(page).clearDone);
    expect(clearDone.x).toBeGreaterThan(1280 / 2);
  });
});
