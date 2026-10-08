// @ts-check
// docs/test-case.md 3.8 タイトル（TITLE）
const {
  test, expect, open, ui, t, MSG, expectTitles, trackDialogs, box, expectRed, openNew, openTodo,
  setDue, saveAndClose, pasteIntoInput, savedTodos,
} = require('./helpers');

const A100 = 'あ'.repeat(100);
const EMOJI50 = '😀'.repeat(50);

/** タイトルのエラーが出て、詳細画面は開いたまま、保存されていない */
async function expectTitleRejected(page) {
  const u = ui(page);
  await expect(u.error(MSG.titleRequired)).toBeVisible();
  await expect(u.dialog).toBeVisible();
  expect(await savedTodos(page)).toEqual([]);
}

test.describe('タイトル', () => {
  test('TITLE-01 100 文字のタイトルを保存できる', async ({ page }) => {
    await open(page);
    await openNew(page, A100);
    await saveAndClose(page);
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe(A100);
  });

  test('TITLE-02 100 文字を超えてキーボードから入力できない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page, A100);
    await u.titleInput.press('End');
    await page.keyboard.type('い');
    await expect(u.titleInput).toHaveValue(A100);
  });

  test('TITLE-03 150 文字を貼り付けると、先頭の 100 文字だけ入る', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    const text = 'あ'.repeat(100) + 'い'.repeat(50);
    await pasteIntoInput(page, u.titleInput, text);
    await expect(u.titleInput).toHaveValue(text.slice(0, 100));
  });

  test('TITLE-04 保存時に前後の空白（半角・全角）を取り除く', async ({ page }) => {
    await open(page);
    await openNew(page, '  報告書　');
    await saveAndClose(page);
    expect((await savedTodos(page)).map((todo) => todo.title)).toEqual(['報告書']);
    await expectTitles(page, ['報告書']);
  });

  test('TITLE-05 タイトルが空だと保存できず、エラーが表示される', async ({ page }) => {
    await open(page);
    await openNew(page);
    await ui(page).saveButton.click();
    await expectTitleRejected(page);
  });

  test('TITLE-06 タイトルが空白だけだと保存できず、エラーが表示される', async ({ page }) => {
    await open(page);
    await openNew(page, '   ');
    await ui(page).saveButton.click();
    await expectTitleRejected(page);
  });

  test('TITLE-07 タイトルのエラーは赤字で、日時の項目より上に表示される', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await u.saveButton.click();
    const error = u.error(MSG.titleRequired);
    await expect(error).toBeVisible();
    await expectRed(error, true);
    expect((await box(error)).y).toBeLessThan((await box(u.radio('なし'))).y);
  });

  test('TITLE-08 エラーは入力を直しても表示されたまま', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await u.saveButton.click();
    await expect(u.error(MSG.titleRequired)).toBeVisible();
    await u.titleInput.fill('あ');
    await expect(u.error(MSG.titleRequired)).toBeVisible();
  });

  test('TITLE-09 入力を直してもう一度 [保存] すると保存される', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await u.saveButton.click();
    await expect(u.error(MSG.titleRequired)).toBeVisible();
    await u.titleInput.fill('あ');
    await saveAndClose(page);
    await expectTitles(page, ['あ']);
  });

  test('TITLE-10 詳細画面を開き直すと、エラーは表示されない', async ({ page }) => {
    await open(page);
    const dialogs = trackDialogs(page, 'accept');
    const u = ui(page);
    await openNew(page);
    await u.saveButton.click();
    await expect(u.error(MSG.titleRequired)).toBeVisible();
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    expect(dialogs.list).toEqual([]);
    await openNew(page);
    await expect(u.error(MSG.titleRequired)).toHaveCount(0);
  });

  test('TITLE-11 タイトルを編集して保存すると、一覧に反映される', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    await openTodo(page, 'A');
    await ui(page).titleInput.fill('B');
    await saveAndClose(page);
    await expectTitles(page, ['B']);
    expect(await savedTodos(page)).toHaveLength(1);
  });

  test('TITLE-12 もう一度 [保存] すると、直した項目のエラーだけが消える', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await setDue(page, 'date');
    await u.saveButton.click();
    await expect(u.error(MSG.titleRequired)).toBeVisible();
    await expect(u.error(MSG.dateRequired)).toBeVisible();
    await u.titleInput.fill('あ');
    await u.saveButton.click();
    await expect(u.error(MSG.titleRequired)).toHaveCount(0);
    await expect(u.error(MSG.dateRequired)).toBeVisible();
    await expect(u.dialog).toBeVisible();
    expect(await savedTodos(page)).toEqual([]);
  });

  test('TITLE-13 絵文字は 2 文字と数え、50 個（100 文字）まで保存できる', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await pasteIntoInput(page, u.titleInput, EMOJI50);
    await expect(u.titleInput).toHaveValue(EMOJI50);
    await saveAndClose(page);
    const todos = await savedTodos(page);
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe(EMOJI50);
    expect(todos[0].title.length).toBe(100);
  });

  test('TITLE-14 絵文字 50 個のあとには、キーボードから入力できない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await pasteIntoInput(page, u.titleInput, EMOJI50);
    await expect(u.titleInput).toHaveValue(EMOJI50);
    await u.titleInput.press('End');
    await page.keyboard.type('い');
    await expect(u.titleInput).toHaveValue(EMOJI50);
  });
});
