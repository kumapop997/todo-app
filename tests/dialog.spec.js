// @ts-check
// docs/test-case.md 3.7 詳細画面の開閉（DLG）
const {
  test, expect, open, ui, t, done, jst, plain, MSG, selectTab, expectSelectedTab, expectTitles,
  trackDialogs, confirmOf, box, openNew, openTodo, setDue, typeDetail, selectAllDetail, saveAndClose,
  CLOSERS, toolbarButton, rawSaved, savedTodos, savedTodo,
} = require('./helpers');

const BOLD_MEMO = { ops: [{ insert: 'メモ', attributes: { bold: true } }, { insert: '\n' }] };
const CLOSE_WAYS = Object.keys(CLOSERS); // [キャンセル] / Esc / 外側クリック

/** フォーカスが詳細画面の中の要素にあるか */
const focusIsInDialog = (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const active = document.activeElement;
    return !!dialog && !!active && active !== document.body && dialog.contains(active);
  });

test.describe('詳細画面の開閉', () => {
  test('DLG-01 [新規] で詳細画面がポップアップで開く', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await u.newButton.click();
    await expect(u.dialog).toBeVisible();
    await expect(u.heading).toBeVisible();
  });

  test('DLG-02 新規の詳細画面は空の状態で開く', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await u.newButton.click();
    await expect(u.titleInput).toHaveValue('');
    await expect(u.radio('なし')).toBeChecked();
    await expect(u.radio('日のみ')).not.toBeChecked();
    await expect(u.radio('日時')).not.toBeChecked();
    await expect(u.editor).toHaveText('');
    await expect(u.counter).toHaveText('0 / 2000');
    await expect(u.saveButton).toBeVisible();
    await expect(u.cancelButton).toBeVisible();
  });

  test('DLG-03 新規の詳細画面はタイトル欄にフォーカスがある', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await u.newButton.click();
    await expect(u.titleInput).toBeFocused();
  });

  test('DLG-04 タイトルをクリックすると、その ToDo の内容が入った詳細画面が開く', async ({ page }) => {
    await open(page, { todos: [t('報告書', '10/7 15:30', { detail: plain('部長に提出') })] });
    const u = ui(page);
    await openTodo(page, '報告書');
    await expect(u.titleInput).toHaveValue('報告書');
    await expect(u.radio('日時')).toBeChecked();
    await expect(u.dtDate).toHaveValue('2026/10/07');
    await expect(u.dtTime).toHaveValue('15:30');
    await expect(u.editor).toHaveText('部長に提出');
  });

  test('DLG-05 完了済みも編集でき、完了の状態は変わらない', async ({ page }) => {
    const completedAt = jst('2026-10-07 12:00');
    await open(page, { todos: [done('A', undefined, { completedAt })] });
    await selectTab(page, '完了済');
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('A2');
    await saveAndClose(page);
    await expectTitles(page, ['A2']);
    const todo = await savedTodo(page, 'A2');
    expect(todo.completed).toBe(true);
    expect(todo.completedAt).toBe(completedAt);
  });

  CLOSE_WAYS.forEach((way, i) => {
    test(`DLG-0${6 + i} 新規を何も変えずに ${way} すると、確認なしで閉じる`, async ({ page }) => {
      await open(page);
      const dialogs = trackDialogs(page, 'dismiss');
      await openNew(page);
      await CLOSERS[way](page);
      await expect(ui(page).dialog).toBeHidden();
      expect(dialogs.list).toEqual([]);
    });
  });

  CLOSE_WAYS.forEach((way, i) => {
    const id = `DLG-${String(9 + i).padStart(2, '0')}`;
    test(`${id} 既存の ToDo を何も変えずに ${way} すると、確認なしで閉じる`, async ({ page }) => {
      await open(page, { todos: [t('A', '10/7 15:30', { detail: BOLD_MEMO })] });
      const dialogs = trackDialogs(page, 'dismiss');
      await openTodo(page, 'A');
      await expect(ui(page).editor).toHaveText('メモ');
      await CLOSERS[way](page);
      await expect(ui(page).dialog).toBeHidden();
      expect(dialogs.list).toEqual([]);
    });
  });

  CLOSE_WAYS.forEach((way, i) => {
    test(`DLG-${12 + i} 変更ありで ${way} すると「変更を破棄しますか？」と確認が出る`, async ({ page }) => {
      await open(page);
      const dialogs = trackDialogs(page, 'dismiss');
      await openNew(page, 'あ');
      await CLOSERS[way](page);
      await expect.poll(() => dialogs.list).toEqual(confirmOf(MSG.discard));
    });
  });

  test('DLG-15 確認で OK すると、変更を破棄して閉じる', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const before = await rawSaved(page);
    const dialogs = trackDialogs(page, 'accept');
    const u = ui(page);
    await openTodo(page, 'A');
    await u.titleInput.fill('B');
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    expect(dialogs.list).toEqual(confirmOf(MSG.discard));
    await expectTitles(page, ['A']);
    expect(await rawSaved(page)).toBe(before);
  });

  test('DLG-16 確認でキャンセルすると、編集に戻る', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const dialogs = trackDialogs(page, 'dismiss');
    const u = ui(page);
    await openTodo(page, 'A');
    await u.titleInput.fill('B');
    await u.cancelButton.click();
    expect(dialogs.list).toEqual(confirmOf(MSG.discard));
    await expect(u.dialog).toBeVisible();
    await expect(u.titleInput).toHaveValue('B');
  });

  test('DLG-17 日時の選択を切り替えただけでも変更として扱う', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const dialogs = trackDialogs(page, 'dismiss');
    await openTodo(page, 'A');
    await setDue(page, 'date');
    await ui(page).cancelButton.click();
    expect(dialogs.list).toEqual(confirmOf(MSG.discard));
  });

  test('DLG-18 詳細に入力すると変更として扱う', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const dialogs = trackDialogs(page, 'dismiss');
    await openTodo(page, 'A');
    await typeDetail(page, 'あ');
    await ui(page).cancelButton.click();
    expect(dialogs.list).toEqual(confirmOf(MSG.discard));
  });

  test('DLG-19 タイトルを変えてから元に戻した場合は、確認なしで閉じる', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    const dialogs = trackDialogs(page, 'dismiss');
    const u = ui(page);
    await openTodo(page, 'A');
    await u.titleInput.fill('AB');
    await u.titleInput.fill('A');
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    expect(dialogs.list).toEqual([]);
  });

  test('DLG-20 詳細に入力してから消した場合は、確認なしで閉じる', async ({ page }) => {
    await open(page, { todos: [t('A', undefined, { detail: plain('メモ') })] });
    const dialogs = trackDialogs(page, 'dismiss');
    const u = ui(page);
    await openTodo(page, 'A');
    await u.editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('あ');
    await expect(u.editor).toHaveText('メモあ');
    await page.keyboard.press('Backspace');
    await expect(u.editor).toHaveText('メモ');
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    expect(dialogs.list).toEqual([]);
  });

  test('DLG-21 文字が同じでも装飾を変えたら変更として扱う', async ({ page }) => {
    await open(page, { todos: [t('A', undefined, { detail: plain('メモ') })] });
    const dialogs = trackDialogs(page, 'dismiss');
    await openTodo(page, 'A');
    await selectAllDetail(page);
    await toolbarButton(page, 'bold').click();
    await ui(page).cancelButton.click();
    expect(dialogs.list).toEqual(confirmOf(MSG.discard));
  });

  test('DLG-22 [すべて] で新規登録して保存しても、タブは [すべて] のまま', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    await selectTab(page, 'すべて');
    await openNew(page, 'B');
    await saveAndClose(page);
    await expectSelectedTab(page, 'すべて');
    await expectTitles(page, ['A', 'B']);
  });

  test('DLG-23 [完了済] で編集して保存しても、タブは [完了済] のまま', async ({ page }) => {
    await open(page, { todos: [done('A')] });
    await selectTab(page, '完了済');
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('A2');
    await saveAndClose(page);
    await expectSelectedTab(page, '完了済');
    await expectTitles(page, ['A2']);
  });

  test('DLG-24 新規登録して保存すると、[未完了] の一覧に現れる', async ({ page }) => {
    await open(page);
    await openNew(page, 'B');
    await saveAndClose(page);
    await expectSelectedTab(page, '未完了');
    await expectTitles(page, ['B']);
  });

  test('DLG-25 詳細画面は画面より小さく、周囲にメイン画面側の領域が見えている', async ({ page }) => {
    await open(page);
    await openNew(page);
    const dialog = await box(ui(page).dialog);
    expect(dialog.x).toBeGreaterThan(0);
    expect(dialog.y).toBeGreaterThan(0);
    expect(dialog.right).toBeLessThan(1280);
    expect(dialog.bottom).toBeLessThan(800);
  });

  test('DLG-26 詳細画面の内側をクリックしても閉じない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await u.titleInput.click();
    await expect(u.dialog).toBeVisible();
    await u.radio('日のみ').click();
    await expect(u.dialog).toBeVisible();
    await u.editor.click();
    await expect(u.dialog).toBeVisible();
  });

  test('DLG-27 破棄して開き直した新規の詳細画面に、前回の入力が残っていない', async ({ page }) => {
    await open(page);
    trackDialogs(page, 'accept');
    const u = ui(page);
    await openNew(page, 'あ');
    await setDue(page, 'date', '2026/10/20');
    await typeDetail(page, 'い');
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    await openNew(page);
    await expect(u.titleInput).toHaveValue('');
    await expect(u.radio('なし')).toBeChecked();
    await expect(u.dateOnly).toHaveValue('');
    await expect(u.dtDate).toHaveValue('');
    await expect(u.editor).toHaveText('');
    await expect(u.counter).toHaveText('0 / 2000');
  });

  test('DLG-28 タイトル欄で Enter を押しても保存されない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page, 'A');
    await u.titleInput.press('Enter');
    await expect(u.dialog).toBeVisible();
    await expect(u.titleInput).toHaveValue('A');
    expect(await savedTodos(page)).toEqual([]);
    for (const message of [MSG.titleRequired, MSG.dateRequired, MSG.timeRequired, MSG.dateInvalid, MSG.timeInvalid]) {
      await expect(u.error(message)).toHaveCount(0);
    }
  });

  test('DLG-29 日付欄・時刻欄で Enter を押しても保存されない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page, 'A');
    await setDue(page, 'datetime', '2026/10/20', '9:05');
    for (const field of [u.dtDate, u.dtTime]) {
      await field.press('Enter');
      await expect(u.dialog).toBeVisible();
      expect(await savedTodos(page)).toEqual([]);
    }
  });

  for (const [id, key] of [['DLG-30', 'Tab'], ['DLG-31', 'Shift+Tab']]) {
    test(`${id} ${key} キーを 40 回押しても、フォーカスは詳細画面の中にある`, async ({ page }) => {
      await open(page, { todos: [t('A'), done('B')] });
      await selectTab(page, 'すべて');
      await openNew(page);
      for (let i = 1; i <= 40; i++) {
        await page.keyboard.press(key);
        expect(await focusIsInDialog(page), `${i} 回目の ${key} のあと`).toBe(true);
      }
    });
  }
});
