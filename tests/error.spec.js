// @ts-check
// docs/test-case.md 3.12 異常時（ERR）
const {
  test, expect, open, ui, t, done, KEY, BROKEN_KEY, MSG, BROKEN_JSON, buildTodos, stateJson, validTodo,
  reopenWith, advance, selectTab, expectTitles, expectSections, expectRed, trackDialogs, box,
  expectNotice, expectNoNotice, closeNotice, openNew, typeDetail, saveAndClose, addTodo,
  rawSaved, saved, savedTodos, savedTodo, failWrites, restoreWrites,
} = require('./helpers');

const COMPLETED_AT = '2026-10-07T04:00:00.000Z';

/** 壊れたデータとして扱われる: 警告が出て、元の値が退避され、一覧は空 */
async function expectBroken(page, raw, label = raw) {
  const u = ui(page);
  await expect(u.notice(MSG.loadFailed), label).toBeVisible();
  expect(await rawSaved(page, BROKEN_KEY), label).toBe(raw);
  await selectTab(page, 'すべて');
  await expect(u.emptyMessage('すべて'), label).toBeVisible();
  await expectTitles(page, []);
}

/** 1 テストの中で、壊れたデータを順に入れて開き直す */
async function expectEachBroken(page, raws) {
  await open(page);
  for (const [label, raw] of raws) {
    await reopenWith(page, { [KEY]: raw });
    await expectBroken(page, raw, label);
  }
}

/** 正しい ToDo 1 件の項目を上書きしたデータ: [説明, 保存する文字列] */
const withOverrides = (list) => list.map((o) => [JSON.stringify(o), stateJson([validTodo(o)])]);

/** ERR-14: [新規] → タイトル「A」、詳細「メモ」→ 書き込みを失敗させる → [保存] */
async function failToSaveNew(page) {
  await open(page);
  await openNew(page, 'A');
  await typeDetail(page, 'メモ');
  await failWrites(page);
  await ui(page).saveButton.click();
  await expect(ui(page).notice(MSG.saveFailed)).toBeVisible();
}

/** ERR-17: 書き込みを失敗させる → A の [完了] */
async function failToComplete(page) {
  await open(page, { todos: [t('A')] });
  await failWrites(page);
  await ui(page).completeButton('A').click();
  await expect(ui(page).notice(MSG.saveFailed)).toBeVisible();
}

test.describe('異常時（保存データの読み込み）', () => {
  test('ERR-01 データがなければ、空の一覧でメッセージなしに起動する', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await expect(u.emptyMessage('未完了')).toBeVisible();
    await expectTitles(page, []);
    await expectNoNotice(page);
    expect(await rawSaved(page, BROKEN_KEY)).toBeNull();
  });

  test('ERR-02 壊れたデータがあると、画面上部に警告が表示される', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    await expectNotice(page, MSG.loadFailed);
  });

  test('ERR-03 壊れた内容が todo-app.todos.broken に退避される', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    await expect(ui(page).notice(MSG.loadFailed)).toBeVisible();
    expect(await rawSaved(page, BROKEN_KEY)).toBe(BROKEN_JSON);
  });

  test('ERR-04 壊れたデータのあとでも登録でき、再読み込み後は警告が出ない', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    await expect(ui(page).notice(MSG.loadFailed)).toBeVisible();
    await expectTitles(page, []);
    await addTodo(page, 'A');
    await page.reload();
    await expectTitles(page, ['A']);
    await expectNoNotice(page);
  });

  test('ERR-05 全体がオブジェクトでないデータは壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(page, [
      ['null', 'null'], ['[]', '[]'], ['"abc"', '"abc"'], ['123', '123'], ['空文字列', ''],
    ]);
  });

  test('ERR-06 version が 1 でないデータは壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(page, [
      ['version 2', '{"version":2,"todos":[]}'], ['version なし', '{"todos":[]}'],
    ]);
  });

  test('ERR-07 todos が配列でないデータは壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(page, [
      ['todos なし', '{"version":1}'], ['todos がオブジェクト', '{"version":1,"todos":{}}'],
    ]);
  });

  test('ERR-08 項目が 1 つでも欠けた ToDo は壊れたデータとして扱う', async ({ page }) => {
    const fields = Object.keys(validTodo());
    expect(fields).toHaveLength(10);
    await expectEachBroken(
      page,
      fields.map((field) => {
        const todo = validTodo();
        delete todo[field];
        return [`${field} なし`, stateJson([todo])];
      }),
    );
  });

  test('ERR-09 項目の型が違う ToDo は壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(
      page,
      withOverrides([
        { title: 123 }, { completed: 'yes' }, { detail: '<p>x</p>' }, { dueDate: 20261007 }, { createdAt: null }, { id: 1 },
      ]),
    );
  });

  test('ERR-10 dueType が 3 つの値のどれでもない ToDo は壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(page, withOverrides([{ dueType: 'weekly' }]));
  });

  test('ERR-11 不正な ToDo が 1 件でもあれば、全体を壊れたデータとして扱う', async ({ page }) => {
    const [third, b, a] = buildTodos([t('A'), t('B'), t('C')]);
    delete third.title;
    const raw = stateJson([third, b, a]);
    await open(page, { storage: { [KEY]: raw } });
    await expectBroken(page, raw);
    await selectTab(page, '未完了');
    await expectTitles(page, []);
  });

  test('ERR-12 警告は [×] で閉じられ、そのあとも一覧の操作が使える', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    await expectNotice(page, MSG.loadFailed);
    await closeNotice(page, MSG.loadFailed);
    await expectNoNotice(page);
    await addTodo(page, 'A');
    await expectTitles(page, ['A']);
    await ui(page).completeButton('A').click();
    await expectTitles(page, []);
  });

  test('ERR-13 警告は時間が経っても自動では消えない', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    await expectNotice(page, MSG.loadFailed);
    await advance(page, 10);
    await expectNotice(page, MSG.loadFailed);
  });

  test('ERR-31 title が空または 101 文字の ToDo は壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(page, [
      ['title が空', stateJson([validTodo({ title: '' })])],
      ['title が 101 文字', stateJson([validTodo({ title: 'あ'.repeat(101) })])],
    ]);
  });

  test('ERR-32 dueType と dueDate / dueTime の組み合わせが合わない ToDo は壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(
      page,
      withOverrides([
        { dueType: 'none', dueDate: '2026-10-07', dueTime: null },
        { dueType: 'date', dueDate: null, dueTime: null },
        { dueType: 'date', dueDate: '2026-10-07', dueTime: '09:00' },
        { dueType: 'datetime', dueDate: '2026-10-07', dueTime: null },
        { dueType: 'datetime', dueDate: null, dueTime: '15:30' },
      ]),
    );
  });

  test('ERR-33 dueDate / dueTime の形や値が正しくない ToDo は壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(
      page,
      withOverrides([
        { dueDate: '2026-13-45' }, { dueDate: '2026-02-30' }, { dueDate: '2026/10/07' }, { dueDate: '2026-10-7' },
        { dueTime: '25:00' }, { dueTime: '12:60' }, { dueTime: '9:05' }, { dueTime: '09:05:00' },
      ]),
    );
  });

  test('ERR-34 完了の状態や日時が正しくない ToDo は壊れたデータとして扱う', async ({ page }) => {
    await expectEachBroken(
      page,
      withOverrides([
        { completed: true, completedAt: null },
        { completed: false, completedAt: COMPLETED_AT },
        { createdAt: 'abc' },
        { updatedAt: 'abc' },
        { completed: true, completedAt: 'abc' },
      ]),
    );
  });

  test('ERR-35 余分な項目があるだけなら読み込み、次の保存では書き出さない', async ({ page }) => {
    const raw = stateJson([{ ...buildTodos([t('A')])[0], priority: 1 }], { theme: 'x' });
    await open(page, { storage: { [KEY]: raw } });
    await expectTitles(page, ['A']);
    await expectNoNotice(page);
    expect(await rawSaved(page, BROKEN_KEY)).toBeNull();
    await ui(page).completeButton('A').click();
    await expectTitles(page, []);
    const state = await saved(page);
    expect(state).not.toHaveProperty('theme');
    expect(state.todos).toHaveLength(1);
    expect(state.todos[0]).not.toHaveProperty('priority');
    expect(state.todos[0]).toMatchObject({ title: 'A', completed: true });
  });

  test('ERR-36 退避先にすでに値があれば上書きする', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON, [BROKEN_KEY]: 'old' } });
    await expect(ui(page).notice(MSG.loadFailed)).toBeVisible();
    expect(await rawSaved(page, BROKEN_KEY)).toBe(BROKEN_JSON);
  });

  test('ERR-37 退避したあと、すぐに空のリストで書き直す', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    await expect(ui(page).notice(MSG.loadFailed)).toBeVisible();
    expect(await saved(page)).toEqual({ version: 1, todos: [] });
    await page.reload();
    await expect(ui(page).emptyMessage('未完了')).toBeVisible();
    await expectNoNotice(page);
    expect(await rawSaved(page, BROKEN_KEY)).toBe(BROKEN_JSON);
  });
});

test.describe('異常時（書き込みの失敗）', () => {
  test('ERR-14 詳細画面からの保存に失敗すると、警告が出て入力が残る', async ({ page }) => {
    await failToSaveNew(page);
    const u = ui(page);
    await expectNotice(page, MSG.saveFailed);
    await expect(u.dialog).toBeVisible();
    await expect(u.titleInput).toHaveValue('A');
    await expect(u.editor).toHaveText('メモ');
  });

  test('ERR-15 保存できなかった ToDo は、破棄したあとの一覧に現れない', async ({ page }) => {
    await failToSaveNew(page);
    trackDialogs(page, 'accept');
    const u = ui(page);
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    await expectTitles(page, []);
  });

  test('ERR-16 書き込みが元に戻れば保存でき、警告が消える', async ({ page }) => {
    await failToSaveNew(page);
    await restoreWrites(page);
    await saveAndClose(page);
    await expectTitles(page, ['A']);
    await expectNoNotice(page, MSG.saveFailed);
    expect((await savedTodos(page)).map((todo) => todo.title)).toEqual(['A']);
  });

  test('ERR-17 [完了] の書き込みに失敗すると、警告が出て操作前の状態に戻る', async ({ page }) => {
    await failToComplete(page);
    const u = ui(page);
    await expectNotice(page, MSG.saveFailed);
    await expectTitles(page, ['A']);
    await expect(u.completeButton('A')).toBeVisible();
    await selectTab(page, '完了済');
    await expect(u.emptyMessage('完了済')).toBeVisible();
  });

  test('ERR-18 [未完了に戻す] の書き込みに失敗すると、警告が出て操作前の状態に戻る', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    await selectTab(page, '完了済');
    await failWrites(page);
    const u = ui(page);
    await u.revertButton('A').click();
    await expectNotice(page, MSG.saveFailed);
    await expectTitles(page, ['A']);
    await expect(u.revertButton('A')).toBeVisible();
  });

  test('ERR-19 [削除] の書き込みに失敗すると、警告が出て行が残る', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const dialogs = trackDialogs(page, 'accept');
    await failWrites(page);
    await ui(page).deleteButton('A').click();
    expect(dialogs.list).toHaveLength(1);
    await expectNotice(page, MSG.saveFailed);
    await expectTitles(page, ['A']);
  });

  test('ERR-20 [完了済を削除] の書き込みに失敗すると、警告が出て完了済みが残る', async ({ page }) => {
    await open(page, { todos: [done('A'), done('B')] });
    const dialogs = trackDialogs(page, 'accept');
    await failWrites(page);
    const u = ui(page);
    await u.clearDone.click();
    expect(dialogs.list).toHaveLength(1);
    await expectNotice(page, MSG.saveFailed);
    await selectTab(page, '完了済');
    await expectTitles(page, ['A', 'B']);
    await expect(u.clearDone).toBeEnabled();
  });

  test('ERR-21 「保存できませんでした。」は [×] で閉じられる', async ({ page }) => {
    await failToComplete(page);
    await closeNotice(page, MSG.saveFailed);
    await expectNoNotice(page);
  });

  test('ERR-22 次に書き込みが成功すると「保存できませんでした。」が消える', async ({ page }) => {
    await failToComplete(page);
    await restoreWrites(page);
    await ui(page).completeButton('A').click();
    await expectTitles(page, []);
    await expectNoNotice(page, MSG.saveFailed);
    expect(await savedTodo(page, 'A')).toMatchObject({ completed: true });
  });

  test('ERR-40 同じ文言のメッセージは 1 つだけ表示する', async ({ page }) => {
    await open(page, { todos: [t('A'), t('B')] });
    await failWrites(page);
    const u = ui(page);
    await u.completeButton('A').click();
    await expect(u.notice(MSG.saveFailed)).toHaveCount(1);
    await u.completeButton('B').click();
    await expectTitles(page, ['A', 'B']);
    await expect(u.notice(MSG.saveFailed)).toHaveCount(1);
    await expect(u.notices).toHaveCount(1);
  });
});

test.describe('異常時（Quill を読み込めない）', () => {
  test.use({ blockQuill: true });

  const TODOS = [t('A', '10/7 13:00'), t('B', '10/8'), done('C')];

  test('ERR-23 Quill を読み込めないと、画面上部に警告が表示される', async ({ page }) => {
    await open(page, { todos: TODOS });
    await expectNotice(page, MSG.quillFailed);
  });

  test('ERR-24 Quill を読み込めなくても、一覧は区分と赤字つきで表示される', async ({ page }) => {
    await open(page, { todos: TODOS });
    await expectSections(page, [['期限切れ', ['A']], ['明日まで', ['B']]]);
    await expectRed(ui(page).due('A'), true);
  });

  test('ERR-25 Quill を読み込めないと [新規] は無効', async ({ page }) => {
    await open(page, { todos: TODOS });
    await expect(ui(page).notice(MSG.quillFailed)).toBeVisible();
    await expect(ui(page).newButton).toBeDisabled();
  });

  test('ERR-26 Quill を読み込めないと、タイトルをクリックしても詳細画面は開かない', async ({ page }) => {
    await open(page, { todos: TODOS });
    const u = ui(page);
    await expect(u.notice(MSG.quillFailed)).toBeVisible();
    await u.title('A').click();
    await expect(u.dialog).toBeHidden();
  });

  test('ERR-27 Quill を読み込めなくても、完了と未完了に戻すは使える', async ({ page }) => {
    await open(page, { todos: TODOS });
    const u = ui(page);
    await u.completeButton('A').click();
    await expectTitles(page, ['B']);
    expect(await savedTodo(page, 'A')).toMatchObject({ completed: true });
    await selectTab(page, '完了済');
    await u.revertButton('A').click();
    await expectTitles(page, ['C']);
    expect(await savedTodo(page, 'A')).toMatchObject({ completed: false, completedAt: null });
  });

  test('ERR-28 Quill を読み込めなくても、削除と完了済を削除は使える', async ({ page }) => {
    await open(page, { todos: TODOS });
    trackDialogs(page, 'accept');
    const u = ui(page);
    await u.deleteButton('A').click();
    await expectTitles(page, ['B']);
    await u.clearDone.click();
    await expect(u.clearDone).toBeDisabled();
    expect((await savedTodos(page)).map((todo) => todo.title)).toEqual(['B']);
  });

  test('ERR-29 Quill を読み込めなくても、タブの切り替えは使える', async ({ page }) => {
    await open(page, { todos: TODOS });
    await expectTitles(page, ['A', 'B']);
    await selectTab(page, 'すべて');
    await expectTitles(page, ['A', 'B', 'C']);
    await selectTab(page, '完了済');
    await expectTitles(page, ['C']);
    await selectTab(page, '未完了');
    await expectTitles(page, ['A', 'B']);
  });

  test('ERR-30 Quill を読み込めない状態で一通り操作しても、例外が発生しない', async ({ page, problems }) => {
    await open(page, { todos: TODOS });
    trackDialogs(page, 'accept');
    const u = ui(page);
    await expectSections(page, [['期限切れ', ['A']], ['明日まで', ['B']]]);
    await expect(u.newButton).toBeDisabled();
    await u.title('A').click();
    await expect(u.dialog).toBeHidden();
    for (const name of ['すべて', '完了済', '未完了']) await selectTab(page, name);
    await u.completeButton('A').click();
    await selectTab(page, '完了済');
    await u.revertButton('A').click();
    await selectTab(page, '未完了');
    await u.deleteButton('A').click();
    await u.clearDone.click();
    await expectTitles(page, ['B']);
    expect(problems.filter((p) => p.startsWith('pageerror'))).toEqual([]);
  });

  test('ERR-38 メッセージが複数あるときは、縦に並べてすべて表示する', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    const u = ui(page);
    await expectNotice(page, MSG.loadFailed);
    await expectNotice(page, MSG.quillFailed);
    await expect(u.notices).toHaveCount(2);
    const [first, second] = [await box(u.notices.nth(0)), await box(u.notices.nth(1))];
    expect(second.y).toBeGreaterThanOrEqual(first.bottom - 1);
  });

  test('ERR-39 メッセージは個別に閉じられる', async ({ page }) => {
    await open(page, { storage: { [KEY]: BROKEN_JSON } });
    await expectNotice(page, MSG.loadFailed);
    await expectNotice(page, MSG.quillFailed);
    await closeNotice(page, MSG.loadFailed);
    await expectNoNotice(page, MSG.loadFailed);
    await expectNotice(page, MSG.quillFailed);
  });
});
