// @ts-check
// docs/test-case.md 3.11 保存データ（DATA）
const {
  test, expect, open, ui, t, done, jst, plain, KEY, T0, UUID_RE, selectTab, expectTitles, expectSections,
  trackDialogs, expectNoNotice, openNew, openTodo, setDue, typeDetail, saveAndClose, addTodo, toolbarButton,
  rawSaved, saved, savedTodos, savedTodo,
} = require('./helpers');

const OCT1 = jst('2026-10-01 00:00');
const FIELDS = [
  'completed', 'completedAt', 'createdAt', 'detail', 'dueDate', 'dueTime', 'dueType', 'id', 'title', 'updatedAt',
];

test.describe('保存データ', () => {
  test('DATA-01 キー todo-app.todos に version 1 と todos の配列が保存される', async ({ page }) => {
    await open(page);
    await addTodo(page, 'A');
    const state = JSON.parse(await rawSaved(page));
    expect(state.version).toBe(1);
    expect(Array.isArray(state.todos)).toBe(true);
    expect(state.todos).toHaveLength(1);
  });

  test('DATA-02 ToDo は 6.2 の 10 項目で保存される', async ({ page }) => {
    await open(page);
    await addTodo(page, 'A', { due: ['datetime', '2026/10/07', '15:30'], detail: 'メモ' });
    const [todo] = await savedTodos(page);
    expect(Object.keys(todo).sort()).toEqual(FIELDS);
    expect(todo.id).toMatch(UUID_RE);
    expect(todo).toMatchObject({
      title: 'A',
      dueType: 'datetime',
      dueDate: '2026-10-07',
      dueTime: '15:30',
      completed: false,
      completedAt: null,
      createdAt: T0,
      updatedAt: T0,
    });
  });

  test('DATA-03 登録するたびに異なる id が付く', async ({ page }) => {
    await open(page);
    await addTodo(page, 'A');
    await addTodo(page, 'B');
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(2);
    expect(todos[0].id).not.toBe(todos[1].id);
  });

  test('DATA-04 [完了] で completed・completedAt・updatedAt が更新される', async ({ page }) => {
    await open(page, { todos: [t('A', undefined, { createdAt: OCT1, updatedAt: OCT1 })] });
    const before = await savedTodo(page, 'A');
    await ui(page).completeButton('A').click();
    await expectTitles(page, []);
    const after = await savedTodo(page, 'A');
    expect(after).toMatchObject({ completed: true, completedAt: T0, updatedAt: T0, createdAt: OCT1, id: before.id });
  });

  test('DATA-05 [未完了に戻す] で completed・completedAt・updatedAt が更新される', async ({ page }) => {
    await open(page, { todos: [done('A', undefined, { createdAt: OCT1, updatedAt: OCT1 })] });
    await selectTab(page, '完了済');
    await ui(page).revertButton('A').click();
    await expectTitles(page, []);
    const after = await savedTodo(page, 'A');
    expect(after).toMatchObject({ completed: false, completedAt: null, updatedAt: T0, createdAt: OCT1 });
  });

  test('DATA-06 編集して保存すると updatedAt が更新され、id と createdAt は変わらない', async ({ page }) => {
    await open(page, { todos: [t('A', undefined, { createdAt: OCT1, updatedAt: OCT1 })] });
    const before = await savedTodo(page, 'A');
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('B');
    await saveAndClose(page);
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ title: 'B', updatedAt: T0, createdAt: OCT1, id: before.id });
  });

  test('DATA-07 何も変えずに [保存] しても updatedAt が更新される', async ({ page }) => {
    await open(page, { todos: [t('A', undefined, { createdAt: OCT1, updatedAt: OCT1 })] });
    await openTodo(page, 'A');
    await saveAndClose(page);
    expect((await savedTodo(page, 'A')).updatedAt).toBe(T0);
  });

  test('DATA-08 詳細は HTML ではなく Delta 形式で保存される', async ({ page }) => {
    await open(page);
    await openNew(page, 'A');
    await typeDetail(page, 'メモ');
    await page.keyboard.press('ControlOrMeta+A');
    await toolbarButton(page, 'bold').click();
    await saveAndClose(page);
    const { detail } = await savedTodo(page, 'A');
    expect(typeof detail).toBe('object');
    expect(Array.isArray(detail.ops)).toBe(true);
    expect(detail.ops[0]).toEqual({ insert: 'メモ', attributes: { bold: true } });
    expect(JSON.stringify(detail)).not.toContain('<');
  });

  test('DATA-09 登録した ToDo が再読み込み後も残っている', async ({ page }) => {
    await open(page);
    await addTodo(page, 'A');
    await page.reload();
    await expectTitles(page, ['A']);
  });

  test('DATA-10 編集した内容が再読み込み後も残っている', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    await openTodo(page, 'A');
    const u = ui(page);
    await u.titleInput.fill('B');
    await setDue(page, 'date', '2026/10/20');
    await typeDetail(page, 'メモ');
    await saveAndClose(page);
    await page.reload();
    await expectTitles(page, ['B']);
    await expect(u.due('B')).toHaveText('10月20日');
    await openTodo(page, 'B');
    await expect(u.editor).toHaveText('メモ');
  });

  test('DATA-11 完了の状態が再読み込み後も残っている', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const u = ui(page);
    await u.completeButton('A').click();
    await expectTitles(page, []);
    await page.reload();
    await expect(u.emptyMessage('未完了')).toBeVisible();
    await selectTab(page, '完了済');
    await expectTitles(page, ['A']);
  });

  test('DATA-12 未完了に戻した状態が再読み込み後も残っている', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    await selectTab(page, '完了済');
    await ui(page).revertButton('A').click();
    await expectTitles(page, []);
    await page.reload();
    await expectTitles(page, ['A']);
  });

  test('DATA-13 削除した結果が再読み込み後も残っている', async ({ page }) => {
    await open(page, { todos: [t('A'), t('B')] });
    trackDialogs(page, 'accept');
    await ui(page).deleteButton('A').click();
    await expectTitles(page, ['B']);
    await page.reload();
    await expectTitles(page, ['B']);
  });

  test('DATA-14 [完了済を削除] の結果が再読み込み後も残っている', async ({ page }) => {
    await open(page, { todos: [done('A'), t('B')] });
    trackDialogs(page, 'accept');
    const u = ui(page);
    await u.clearDone.click();
    await expect(u.clearDone).toBeDisabled();
    await page.reload();
    await selectTab(page, 'すべて');
    await expectTitles(page, ['B']);
  });

  test('DATA-15 破棄した編集・登録は保存されない', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const before = await rawSaved(page);
    const dialogs = trackDialogs(page, 'accept');
    const u = ui(page);
    await openTodo(page, 'A');
    await u.titleInput.fill('B');
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    await openNew(page, 'C');
    await page.keyboard.press('Escape');
    await expect(u.dialog).toBeHidden();
    expect(dialogs.list).toHaveLength(2);
    expect(await rawSaved(page)).toBe(before);
  });

  test('DATA-16 ある ToDo の操作で、ほかの ToDo の内容は変わらない', async ({ page }) => {
    await open(page, {
      todos: [
        t('A', '10/7 15:00', { detail: plain('Aの詳細') }),
        done('B', '10/8', { detail: plain('Bの詳細') }),
        t('C', undefined, { detail: plain('Cの詳細') }),
      ],
    });
    const beforeA = await savedTodo(page, 'A');
    const beforeB = await savedTodo(page, 'B');
    await ui(page).completeButton('A').click();
    await expectTitles(page, ['C']);
    await openTodo(page, 'C');
    await ui(page).titleInput.fill('C2');
    await saveAndClose(page);
    expect(await savedTodos(page)).toHaveLength(3);
    expect(await savedTodo(page, 'B')).toEqual(beforeB);
    const afterA = await savedTodo(page, 'A');
    for (const field of ['title', 'dueType', 'dueDate', 'dueTime', 'detail', 'createdAt']) {
      expect(afterA[field], field).toEqual(beforeA[field]);
    }
  });

  test('DATA-17 localStorage のキーは todo-app.todos だけ', async ({ page }) => {
    await open(page);
    trackDialogs(page, 'accept');
    const u = ui(page);
    await addTodo(page, 'A');
    await addTodo(page, 'B');
    for (const name of ['すべて', '完了済', '未完了']) await selectTab(page, name);
    await u.completeButton('A').click();
    await selectTab(page, '完了済');
    await u.revertButton('A').click();
    await selectTab(page, '未完了');
    await u.completeButton('B').click();
    await u.deleteButton('A').click();
    await u.clearDone.click();
    await expectTitles(page, []);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([KEY]);
  });

  test('DATA-18 spec.md 6.1 の JSON 例をそのまま読み込める', async ({ page }) => {
    const example = {
      version: 1,
      todos: [
        {
          id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
          title: '報告書を提出する',
          dueType: 'datetime',
          dueDate: '2026-10-07',
          dueTime: '15:30',
          detail: { ops: [{ insert: '部長に提出\n' }] },
          completed: false,
          completedAt: null,
          createdAt: '2026-10-07T01:23:45.678Z',
          updatedAt: '2026-10-07T01:23:45.678Z',
        },
      ],
    };
    await open(page, { storage: { [KEY]: JSON.stringify(example, null, 2) } });
    const u = ui(page);
    await expectSections(page, [['本日中', ['報告書を提出する']]]);
    await expect(u.due('報告書を提出する')).toHaveText('10月7日 15:30');
    await expectNoNotice(page);
    await openTodo(page, '報告書を提出する');
    await expect(u.editor).toHaveText('部長に提出');
    expect((await saved(page)).todos).toHaveLength(1);
  });
});
