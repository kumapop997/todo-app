// @ts-check
// docs/test-case.md 3.9 日時（DUE）
// 特に書かない限り、[新規] を押してタイトルに「A」を入力した状態から始める。
const {
  test, expect, open, ui, t, MSG, expectSectionOf, expectRed, box, openNew, openTodo, setDue,
  saveAndClose, savedTodos, savedTodo,
} = require('./helpers');

/** 開いて、[新規] → タイトル「A」 */
async function start(page) {
  await open(page);
  await openNew(page, 'A');
}

/** 再読み込みして入力をやり直す（1 テストで複数の値を試すとき。何も保存されていない前提） */
async function restart(page) {
  await page.reload();
  await openNew(page, 'A');
}

const dueOf = ({ dueType, dueDate, dueTime }) => ({ dueType, dueDate, dueTime });

/** 詳細画面が開いたままで、保存されていない */
async function expectNotSaved(page) {
  await expect(ui(page).dialog).toBeVisible();
  expect(await savedTodos(page)).toEqual([]);
}

test.describe('日時', () => {
  test('DUE-01 「なし」で保存でき、開き直すと「なし」が選択されている', async ({ page }) => {
    await start(page);
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'none', dueDate: null, dueTime: null });
    await openTodo(page, 'A');
    await expect(ui(page).radio('なし')).toBeChecked();
  });

  test('DUE-02 「日のみ」で保存でき、開き直すと同じ日付が表示される', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2026/10/20');
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'date', dueDate: '2026-10-20', dueTime: null });
    await openTodo(page, 'A');
    await expect(ui(page).radio('日のみ')).toBeChecked();
    await expect(ui(page).dateOnly).toHaveValue('2026/10/20');
  });

  test('DUE-03 「日時」で保存でき、開き直すと同じ日付と時刻が表示される', async ({ page }) => {
    await start(page);
    await setDue(page, 'datetime', '2026/10/20', '09:05');
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'datetime', dueDate: '2026-10-20', dueTime: '09:05' });
    await openTodo(page, 'A');
    const u = ui(page);
    await expect(u.radio('日時')).toBeChecked();
    await expect(u.dtDate).toHaveValue('2026/10/20');
    await expect(u.dtTime).toHaveValue('09:05');
  });

  test('DUE-04 「なし」を選んでいる間、日付欄と時刻欄はすべて無効', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await expect(u.radio('なし')).toBeChecked();
    await expect(u.dateOnly).toBeDisabled();
    await expect(u.dtDate).toBeDisabled();
    await expect(u.dtTime).toBeDisabled();
  });

  test('DUE-05 「日のみ」を選ぶと、「日のみ」の日付欄だけが有効になる', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'date');
    await expect(u.dateOnly).toBeEnabled();
    await expect(u.dtDate).toBeDisabled();
    await expect(u.dtTime).toBeDisabled();
  });

  test('DUE-06 「日時」を選ぶと、「日時」の日付欄と時刻欄だけが有効になる', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'datetime');
    await expect(u.dtDate).toBeEnabled();
    await expect(u.dtTime).toBeEnabled();
    await expect(u.dateOnly).toBeDisabled();
  });

  test('DUE-07 「日のみ」で日付が空だと保存できない', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'date');
    await u.saveButton.click();
    await expect(u.error(MSG.dateRequired)).toBeVisible();
    await expect(u.error(MSG.dateInvalid)).toHaveCount(0);
    await expectNotSaved(page);
  });

  test('DUE-08 「日時」で日付だけ空だと、日付のエラーだけが出る', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'datetime', undefined, '10:00');
    await u.saveButton.click();
    await expect(u.error(MSG.dateRequired)).toBeVisible();
    await expect(u.error(MSG.timeRequired)).toHaveCount(0);
    await expectNotSaved(page);
  });

  test('DUE-09 「日時」で時刻だけ空だと、時刻のエラーだけが出る', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'datetime', '2026/10/20');
    await u.saveButton.click();
    await expect(u.error(MSG.timeRequired)).toBeVisible();
    await expect(u.error(MSG.dateRequired)).toHaveCount(0);
    await expectNotSaved(page);
  });

  test('DUE-10 「日時」で日付も時刻も空だと、両方のエラーが出る', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'datetime');
    await u.saveButton.click();
    await expect(u.error(MSG.dateRequired)).toBeVisible();
    await expect(u.error(MSG.timeRequired)).toBeVisible();
  });

  test('DUE-11 タイトルも日付も空だと、両方のエラーが出る', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await u.titleInput.fill('');
    await setDue(page, 'date');
    await u.saveButton.click();
    await expect(u.error(MSG.titleRequired)).toBeVisible();
    await expect(u.error(MSG.dateRequired)).toBeVisible();
  });

  test('DUE-12 「日のみ」で入力した日付は「日時」に切り替えても引き継ぐ', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2026/10/20');
    await setDue(page, 'datetime');
    await expect(ui(page).dtDate).toHaveValue('2026/10/20');
  });

  test('DUE-13 「日時」で入力した日付は「日のみ」に切り替えても引き継ぐ', async ({ page }) => {
    await start(page);
    await setDue(page, 'datetime', '2026/10/21');
    await setDue(page, 'date');
    await expect(ui(page).dateOnly).toHaveValue('2026/10/21');
  });

  test('DUE-14 「なし」に切り替えて戻しても、入力した日付は残る', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2026/10/20');
    await setDue(page, 'none');
    await setDue(page, 'date');
    await expect(ui(page).dateOnly).toHaveValue('2026/10/20');
  });

  test('DUE-15 過去の日時で保存でき、[期限切れ] に赤字で表示される', async ({ page }) => {
    await start(page);
    await setDue(page, 'datetime', '2026/10/07', '13:00');
    await saveAndClose(page);
    await expectSectionOf(page, 'A', '期限切れ');
    await expectRed(ui(page).due('A'), true);
  });

  test('DUE-16 過去の日付（日のみ）で保存でき、[期限切れ] に表示される', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2026/10/06');
    await saveAndClose(page);
    await expectSectionOf(page, 'A', '期限切れ');
  });

  test('DUE-17 「日時」から「日のみ」に変えて保存すると、時刻が消える', async ({ page }) => {
    await open(page, { todos: [t('A', '10/20 09:05')] });
    await openTodo(page, 'A');
    await setDue(page, 'date');
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'date', dueDate: '2026-10-20', dueTime: null });
    await expect(ui(page).due('A')).toHaveText('10月20日');
  });

  test('DUE-18 「なし」に変えて保存すると、締め切りが消えて [それ以外] に移る', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 13:00')] });
    await expectSectionOf(page, 'A', '期限切れ');
    await openTodo(page, 'A');
    await setDue(page, 'none');
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'none', dueDate: null, dueTime: null });
    await expectSectionOf(page, 'A', 'それ以外');
    await expect(ui(page).due('A')).toHaveText('');
  });

  test('DUE-19 日付欄と時刻欄はテキスト入力（ブラウザ標準のピッカーを使わない）', async ({ page }) => {
    await start(page);
    const u = ui(page);
    for (const field of [u.dateOnly, u.dtDate, u.dtTime]) {
      await expect(field).toHaveJSProperty('tagName', 'INPUT');
      await expect(field).toHaveJSProperty('type', 'text');
    }
  });

  test('DUE-20 日付のエラーは赤字で、タイトル欄より下に表示される', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'date');
    await u.saveButton.click();
    const error = u.error(MSG.dateRequired);
    await expect(error).toBeVisible();
    await expectRed(error, true);
    expect((await box(error)).y).toBeGreaterThan((await box(u.titleInput)).y);
  });

  test('DUE-21 日付のエラーは入力を直しても残り、もう一度 [保存] すると保存される', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'date');
    await u.saveButton.click();
    await expect(u.error(MSG.dateRequired)).toBeVisible();
    await u.dateOnly.fill('2026/10/20');
    await expect(u.error(MSG.dateRequired)).toBeVisible();
    await saveAndClose(page);
    expect((await savedTodo(page, 'A')).dueDate).toBe('2026-10-20');
  });

  test('DUE-22 日付を入力したあと「なし」に切り替えて保存すると、締め切りなしになる', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2026/10/20');
    await setDue(page, 'none');
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'none', dueDate: null, dueTime: null });
  });

  test('DUE-23 ゼロ埋めなしの日付で保存でき、開き直すとゼロ埋めで表示される', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2026/1/5');
    await saveAndClose(page);
    expect((await savedTodo(page, 'A')).dueDate).toBe('2026-01-05');
    await openTodo(page, 'A');
    await expect(ui(page).dateOnly).toHaveValue('2026/01/05');
  });

  test('DUE-24 ゼロ埋めなしの時刻で保存でき、開き直すとゼロ埋めで表示される', async ({ page }) => {
    await start(page);
    await setDue(page, 'datetime', '2026/10/20', '9:05');
    await saveAndClose(page);
    expect((await savedTodo(page, 'A')).dueTime).toBe('09:05');
    await expect(ui(page).due('A')).toHaveText('10月20日 9:05');
    await openTodo(page, 'A');
    await expect(ui(page).dtTime).toHaveValue('09:05');
  });

  test('DUE-25 時刻は 0:00 から 23:59 まで保存できる', async ({ page }) => {
    await open(page);
    for (const [input, stored] of [['0:00', '00:00'], ['00:00', '00:00'], ['23:59', '23:59']]) {
      await page.evaluate(() => localStorage.clear());
      await restart(page);
      await setDue(page, 'datetime', '2026/10/20', input);
      await saveAndClose(page);
      expect((await savedTodo(page, 'A')).dueTime, `時刻 ${input}`).toBe(stored);
    }
  });

  test('DUE-26 存在しない月の日付では保存できない', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'date', '2026/14/30');
    await u.saveButton.click();
    await expect(u.error(MSG.dateInvalid)).toBeVisible();
    await expect(u.error(MSG.dateRequired)).toHaveCount(0);
    await expectNotSaved(page);
  });

  test('DUE-27 存在しない日付では保存できない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    const values = ['2026/02/30', '2026/02/29', '2026/04/31', '2026/00/10', '2026/13/01', '2026/10/00', '2026/10/32'];
    for (const value of values) {
      await restart(page);
      await setDue(page, 'date', value);
      await u.saveButton.click();
      await expect(u.error(MSG.dateInvalid), `日付 ${value}`).toBeVisible();
      await expectNotSaved(page);
    }
  });

  test('DUE-28 うるう年の 2/29 は保存できる', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2028/02/29');
    await saveAndClose(page);
    expect((await savedTodo(page, 'A')).dueDate).toBe('2028-02-29');
  });

  test('DUE-29 形式の違う日付では保存できない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    const values = [
      '2026-10-07', '26/10/07', '10/7', '20261007', '2026/10', '2026/10/07 15:30', '明日', '２０２６/１０/０７',
    ];
    for (const value of values) {
      await restart(page);
      await setDue(page, 'date', value);
      await u.saveButton.click();
      await expect(u.error(MSG.dateInvalid), `日付 ${value}`).toBeVisible();
      await expectNotSaved(page);
    }
  });

  test('DUE-30 形式の違う時刻・存在しない時刻では保存できない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    for (const value of ['24:00', '25:00', '12:60', '9:5', '1530', '12:30:00', '9時', '-1:00']) {
      await restart(page);
      await setDue(page, 'datetime', '2026/10/20', value);
      await u.saveButton.click();
      await expect(u.error(MSG.timeInvalid), `時刻 ${value}`).toBeVisible();
      await expect(u.error(MSG.timeRequired)).toHaveCount(0);
      await expectNotSaved(page);
    }
  });

  test('DUE-31 日付も時刻も正しくないと、両方のエラーが出る', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await setDue(page, 'datetime', '2026/14/30', '25:00');
    await u.saveButton.click();
    await expect(u.error(MSG.dateInvalid)).toBeVisible();
    await expect(u.error(MSG.timeInvalid)).toBeVisible();
  });

  test('DUE-32 日付と時刻の前後の空白は無視する', async ({ page }) => {
    await start(page);
    await setDue(page, 'datetime', ' 2026/10/20 ', ' 9:05 ');
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'datetime', dueDate: '2026-10-20', dueTime: '09:05' });
  });

  test('DUE-33 無効な入力欄の値は検証しない', async ({ page }) => {
    await start(page);
    await setDue(page, 'date', '2026/14/30');
    await setDue(page, 'none');
    await saveAndClose(page);
    expect(dueOf(await savedTodo(page, 'A'))).toEqual({ dueType: 'none', dueDate: null, dueTime: null });
  });
});
