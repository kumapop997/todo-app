// @ts-check
// docs/test-case.md 3.13 複数タブ（TAB）
// 同じブラウザコンテキストで index.html を 2 ページ開く（page = ページ1、page2 = ページ2）。
const {
  test, expect, open, openSecond, ui, t, done, plain, KEY, BROKEN_KEY, T0, selectTab, expectSelectedTab,
  expectTitles, trackDialogs, expectNoNotice, openTodo, setDue, typeDetail, selectAllDetail, saveAndClose,
  addTodo, rawSaved, saved, savedTodos, savedTodo, deltaText, waitForStorageSync,
} = require('./helpers');

/** ページ1 を前提のデータで開き、続けてページ2 を開く */
async function openBoth(page, context, todos) {
  await open(page, todos ? { todos } : {});
  const page2 = await openSecond(context);
  return page2;
}

/** TAB-06: ページ1 で A を編集中に、ページ2 で B を完了にし、A のタイトルを「別」にして保存する */
async function editWhileOtherTabChanges(page, context) {
  const page2 = await openBoth(page, context, [t('A'), t('B')]);
  await openTodo(page, 'A');
  await ui(page).titleInput.fill('編集中');
  await typeDetail(page, 'メモ');
  await ui(page2).completeButton('B').click();
  await openTodo(page2, 'A');
  await ui(page2).titleInput.fill('別');
  await saveAndClose(page2);
  await waitForStorageSync(page2, page);
  return page2;
}

/** 保存内容が正しい形で、A（完了済み）と B（未完了）の 2 件である */
async function expectRewritten(page) {
  const state = await saved(page);
  expect(state.version).toBe(1);
  expect(state.todos).toHaveLength(2);
  expect(await savedTodo(page, 'A')).toMatchObject({ completed: true, completedAt: T0 });
  expect(await savedTodo(page, 'B')).toMatchObject({ completed: false, completedAt: null });
}

test.describe('複数タブ', () => {
  test('TAB-01 別タブで登録した ToDo が、再読み込みなしで一覧に現れる', async ({ page, context }) => {
    const page2 = await openBoth(page, context);
    await addTodo(page2, 'A');
    await expectTitles(page, ['A']);
  });

  test('TAB-02 別タブで完了にすると、[未完了] の一覧から消える', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), t('B')]);
    await expectTitles(page, ['A', 'B']);
    await ui(page2).completeButton('A').click();
    await expectTitles(page, ['B']);
  });

  test('TAB-03 別タブで削除すると、一覧から消える', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), t('B')]);
    await expectTitles(page, ['A', 'B']);
    trackDialogs(page2, 'accept');
    await ui(page2).deleteButton('A').click();
    await expectTitles(page, ['B']);
  });

  test('TAB-04 別タブで編集した内容が一覧に反映される', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A')]);
    await openTodo(page2, 'A');
    await ui(page2).titleInput.fill('A2');
    await setDue(page2, 'date', '2026/10/20');
    await saveAndClose(page2);
    await expectTitles(page, ['A2']);
    await expect(ui(page).due('A2')).toHaveText('10月20日');
  });

  test('TAB-05 別タブの変更を反映しても、選択中のタブは変わらない', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), done('B')]);
    await selectTab(page, 'すべて');
    await addTodo(page2, 'C');
    await expectTitles(page, ['A', 'B', 'C']);
    await expectSelectedTab(page, 'すべて');
  });

  test('TAB-06 別タブで変更されても、詳細画面で編集中の内容は書き換えない', async ({ page, context }) => {
    await editWhileOtherTabChanges(page, context);
    const u = ui(page);
    await expect(u.dialog).toBeVisible();
    await expect(u.titleInput).toHaveValue('編集中');
    await expect(u.editor).toHaveText('メモ');
  });

  test('TAB-07 編集を破棄すると、別タブの変更が反映された一覧が見える', async ({ page, context }) => {
    await editWhileOtherTabChanges(page, context);
    trackDialogs(page, 'accept');
    const u = ui(page);
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    await expectTitles(page, ['別']);
  });

  test('TAB-08 編集中の ToDo が別タブで削除されても、保存すると同じ ID で登録し直される', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A')]);
    const { id, createdAt } = await savedTodo(page, 'A');
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('復活');
    trackDialogs(page2, 'accept');
    await ui(page2).deleteButton('A').click();
    await expectTitles(page2, []);
    await waitForStorageSync(page2, page);
    await saveAndClose(page);
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ id, createdAt, title: '復活' });
    await expectTitles(page, ['復活']);
  });

  test('TAB-09 編集中に別タブで登録された ToDo を、保存で消さない', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A')]);
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('A2');
    await addTodo(page2, 'B');
    await waitForStorageSync(page2, page);
    await saveAndClose(page);
    expect((await savedTodos(page)).map((todo) => todo.title).sort()).toEqual(['A2', 'B']);
  });

  test('TAB-10 別タブで完了済みを全件削除すると、[完了済を削除] が無効になる', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [done('A')]);
    await expect(ui(page).clearDone).toBeEnabled();
    trackDialogs(page2, 'accept');
    await ui(page2).clearDone.click();
    await expect(ui(page).clearDone).toBeDisabled();
  });

  test('TAB-11 編集中に別タブで完了にされても、保存で完了の状態を保つ', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A')]);
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('A2');
    await ui(page2).completeButton('A').click();
    await expectTitles(page2, []);
    await waitForStorageSync(page2, page);
    await saveAndClose(page);
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ title: 'A2', completed: true, completedAt: T0 });
  });

  test('TAB-12 編集中に別タブで未完了に戻されても、保存でその状態を保つ', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [done('A')]);
    await selectTab(page, '完了済');
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('A2');
    await selectTab(page2, '完了済');
    await ui(page2).revertButton('A').click();
    await expectTitles(page2, []);
    await waitForStorageSync(page2, page);
    await saveAndClose(page);
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ title: 'A2', completed: false, completedAt: null });
  });

  test('TAB-13 編集中に別タブで変更されても、入力項目は編集中の内容で上書きする', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A', undefined, { detail: plain('元') })]);
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('一');
    await selectAllDetail(page);
    await page.keyboard.type('一の詳細');

    await openTodo(page2, 'A');
    await ui(page2).titleInput.fill('二');
    await setDue(page2, 'date', '2026/10/20');
    await selectAllDetail(page2);
    await page2.keyboard.type('二の詳細');
    await saveAndClose(page2);
    await waitForStorageSync(page2, page);

    await saveAndClose(page);
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ title: '一', dueType: 'none', dueDate: null, dueTime: null });
    expect(deltaText(todos[0].detail)).toBe('一の詳細\n');
  });

  test('TAB-14 別タブから壊れたデータが書き込まれても、一覧は変わらない', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), t('B')]);
    await page2.evaluate((key) => localStorage.setItem(key, '{壊れ'), KEY);
    await waitForStorageSync(page2, page);
    await expectTitles(page, ['A', 'B']);
    await expectNoNotice(page);
    expect(await rawSaved(page, BROKEN_KEY)).toBeNull();
  });

  test('TAB-15 壊れたデータが書き込まれたあとの保存で、正しい形に書き直す', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), t('B')]);
    await page2.evaluate((key) => localStorage.setItem(key, '{壊れ'), KEY);
    await waitForStorageSync(page2, page);
    await ui(page).completeButton('A').click();
    await expectTitles(page, ['B']);
    await expectRewritten(page);
  });

  test('TAB-16 別タブで保存データのキーが消されても、一覧は変わらない', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), t('B')]);
    await page2.evaluate((key) => localStorage.removeItem(key), KEY);
    await waitForStorageSync(page2, page);
    await expectTitles(page, ['A', 'B']);
    await expectNoNotice(page);
  });

  test('TAB-17 キーが消されたあとの保存で、今の一覧の内容でキーを作り直す', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), t('B')]);
    await page2.evaluate((key) => localStorage.removeItem(key), KEY);
    await waitForStorageSync(page2, page);
    await ui(page).completeButton('A').click();
    await expectTitles(page, ['B']);
    await expectRewritten(page);
  });

  test('TAB-18 別タブで localStorage が全消去されても、一覧は変わらない', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), t('B')]);
    await page2.evaluate(() => localStorage.clear());
    await waitForStorageSync(page2, page);
    await expectTitles(page, ['A', 'B']);
    await expectNoNotice(page);
  });

  test('TAB-19 別タブでアプリの操作によって全件が削除されたら、一覧に反映する', async ({ page, context }) => {
    const page2 = await openBoth(page, context, [t('A'), done('B')]);
    await expectTitles(page, ['A']);
    trackDialogs(page2, 'accept');
    await ui(page2).deleteButton('A').click();
    await ui(page2).clearDone.click();
    await expect(ui(page2).clearDone).toBeDisabled();
    const u = ui(page);
    await expect(u.emptyMessage('未完了')).toBeVisible();
    await expectTitles(page, []);
    await selectTab(page, 'すべて');
    await expect(u.emptyMessage('すべて')).toBeVisible();
  });
});
