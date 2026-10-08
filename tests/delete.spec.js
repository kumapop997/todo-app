// @ts-check
// docs/test-case.md 3.6 削除（DEL）
const {
  test, expect, open, ui, t, done, TABS, selectTab, expectTitles, trackDialogs, confirmOf,
  rawSaved, savedTodos,
} = require('./helpers');

const DONE_TWO = [done('A'), done('B'), t('C')];

test.describe('削除', () => {
  test('DEL-01 行の [削除] でタイトル入りの確認が出る', async ({ page }) => {
    await open(page, { todos: [t('報告書')] });
    const dialogs = trackDialogs(page, 'dismiss');
    await ui(page).deleteButton('報告書').click();
    expect(dialogs.list).toEqual(confirmOf('『報告書』を削除しますか？'));
  });

  test('DEL-02 確認で OK すると、その 1 件だけ削除される', async ({ page }) => {
    await open(page, { todos: [t('A'), t('B')] });
    trackDialogs(page, 'accept');
    await ui(page).deleteButton('A').click();
    await expectTitles(page, ['B']);
    expect((await savedTodos(page)).map((todo) => todo.title)).toEqual(['B']);
  });

  test('DEL-03 確認でキャンセルすると何も起きない', async ({ page }) => {
    await open(page, { todos: [t('A'), t('B')] });
    const before = await rawSaved(page);
    const dialogs = trackDialogs(page, 'dismiss');
    await ui(page).deleteButton('A').click();
    expect(dialogs.list).toHaveLength(1);
    await expectTitles(page, ['A', 'B']);
    expect(await rawSaved(page)).toBe(before);
  });

  test('DEL-04 完了済みの行も [削除] できる', async ({ page }) => {
    await open(page, { todos: [done('A'), t('B')] });
    await selectTab(page, '完了済');
    const dialogs = trackDialogs(page, 'accept');
    await ui(page).deleteButton('A').click();
    expect(dialogs.list).toEqual(confirmOf('『A』を削除しますか？'));
    await expectTitles(page, []);
    expect((await savedTodos(page)).map((todo) => todo.title)).toEqual(['B']);
  });

  test('DEL-05 [完了済を削除] で件数入りの確認が出る', async ({ page }) => {
    await open(page, { todos: DONE_TWO });
    const dialogs = trackDialogs(page, 'dismiss');
    await ui(page).clearDone.click();
    expect(dialogs.list).toEqual(confirmOf('完了済みの 2 件を削除しますか？'));
  });

  test('DEL-06 [完了済を削除] で OK すると、完了済みだけが消える', async ({ page }) => {
    await open(page, { todos: DONE_TWO });
    trackDialogs(page, 'accept');
    const u = ui(page);
    await u.clearDone.click();
    await expectTitles(page, ['C']);
    expect((await savedTodos(page)).map((todo) => todo.title)).toEqual(['C']);
    await selectTab(page, '完了済');
    await expect(u.emptyMessage('完了済')).toBeVisible();
  });

  test('DEL-07 [完了済を削除] でキャンセルすると何も起きない', async ({ page }) => {
    await open(page, { todos: DONE_TWO });
    const before = await rawSaved(page);
    const dialogs = trackDialogs(page, 'dismiss');
    await ui(page).clearDone.click();
    expect(dialogs.list).toHaveLength(1);
    expect(await rawSaved(page)).toBe(before);
    await selectTab(page, '完了済');
    await expectTitles(page, ['A', 'B']);
  });

  test('DEL-08 完了済みが 0 件のとき [完了済を削除] は無効', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    await expectTitles(page, ['A']);
    await expect(ui(page).clearDone).toBeDisabled();
  });

  test('DEL-09 完了済みがあれば、どのタブでも [完了済を削除] が表示されて有効', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    const u = ui(page);
    for (const name of TABS) {
      await selectTab(page, name);
      await expect(u.clearDone).toBeVisible();
      await expect(u.clearDone).toBeEnabled();
    }
  });

  test('DEL-10 [完了] を押すと [完了済を削除] が有効に変わる', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const u = ui(page);
    await expect(u.clearDone).toBeDisabled();
    await u.completeButton('A').click();
    await expect(u.clearDone).toBeEnabled();
  });

  test('DEL-11 [完了済を削除] で全件消すと無効になる', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    trackDialogs(page, 'accept');
    const u = ui(page);
    await expect(u.clearDone).toBeEnabled();
    await u.clearDone.click();
    await expect(u.clearDone).toBeDisabled();
  });

  test('DEL-12 完了済みを未完了に戻して 0 件になると無効になる', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    await selectTab(page, '完了済');
    const u = ui(page);
    await expect(u.clearDone).toBeEnabled();
    await u.revertButton('A').click();
    await expect(u.clearDone).toBeDisabled();
  });
});
