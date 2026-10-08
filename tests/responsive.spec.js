// @ts-check
// docs/test-case.md 3.16 画面幅（RESP）。PC 幅（1280×800）で実行する。
const {
  test, expect, open, ui, t, done, MSG, LONG_TITLE, TABS, selectTab, box, expectNoHScroll, openNew,
  openTodo, setDue, saveAndClose, pasteIntoDetail, savedTodo, deltaText,
} = require('./helpers');

/** 多めのデータ: 4 区分それぞれに 3 件ずつ、うち 1 件は 100 文字のタイトル、完了済みを 3 件含む */
const MANY = [
  t('期限切れ1', '10/5 9:00'), t('期限切れ2', '10/6'), done('期限切れ3', '10/7 13:00'),
  t(LONG_TITLE, '10/7 15:00'), t('本日中2', '10/7 18:00'), done('本日中3', '10/7'),
  t('明日まで1', '10/8 9:00'), t('明日まで2', '10/8'), done('明日まで3', '10/8 23:59'),
  t('それ以外1', '10/9'), t('それ以外2', '2027/1/5 9:05'), t('それ以外3'),
];

/** inner が outer の内側に収まっている */
function expectInside(inner, outer, label) {
  expect(inner.x, `${label} の左`).toBeGreaterThanOrEqual(outer.x - 1);
  expect(inner.y, `${label} の上`).toBeGreaterThanOrEqual(outer.y - 1);
  expect(inner.right, `${label} の右`).toBeLessThanOrEqual(outer.right + 1);
  expect(inner.bottom, `${label} の下`).toBeLessThanOrEqual(outer.bottom + 1);
}

test.describe('画面幅', () => {
  test('RESP-01 データが多くても、どのタブでも横スクロールしない', async ({ page }) => {
    await open(page, { todos: MANY });
    const count = { すべて: 12, 未完了: 9, 完了済: 3 };
    for (const name of TABS) {
      await selectTab(page, name);
      await expect(ui(page).titles).toHaveCount(count[name]);
      await expectNoHScroll(page);
    }
  });

  test('RESP-02 詳細画面の項目とボタンが、詳細画面の内側に収まっている', async ({ page }) => {
    await open(page);
    await openNew(page);
    const u = ui(page);
    await expectNoHScroll(page);
    const dialog = await box(u.dialog);
    const parts = {
      タイトル欄: u.titleInput,
      なし: u.radio('なし'),
      日のみ: u.radio('日のみ'),
      日時: u.radio('日時'),
      ツールバー: u.toolbar,
      文字数表示: u.counter,
      保存: u.saveButton,
      キャンセル: u.cancelButton,
    };
    for (const [label, locator] of Object.entries(parts)) {
      await expect(locator, label).toBeVisible();
      expectInside(await box(locator), dialog, label);
    }
  });

  test('RESP-03 行のタイトル・締め切り・ボタンが横に並ぶ', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7 15:30')] });
    const u = ui(page);
    const boxes = [];
    for (const locator of [u.title('A'), u.due('A'), u.completeButton('A'), u.deleteButton('A')]) {
      boxes.push(await box(locator));
    }
    // 縦の位置が重なっている
    expect(Math.max(...boxes.map((b) => b.y))).toBeLessThan(Math.min(...boxes.map((b) => b.bottom)));
  });

  test('RESP-04 詳細が 2000 文字あっても横スクロールせず、[保存] を押して保存できる', async ({ page }) => {
    await open(page, { todos: [t('A')] });
    await openTodo(page, 'A');
    await setDue(page, 'datetime', '2026/10/20', '9:05');
    await pasteIntoDetail(page, 'あ'.repeat(2000));
    await expect(ui(page).counter).toHaveText('2000 / 2000');
    await expectNoHScroll(page);
    await saveAndClose(page);
    await expectNoHScroll(page);
    const todo = await savedTodo(page, 'A');
    expect(todo).toMatchObject({ dueType: 'datetime', dueDate: '2026-10-20', dueTime: '09:05' });
    expect(deltaText(todo.detail)).toBe('あ'.repeat(2000) + '\n');
  });

  test('RESP-05 エラー文言が 3 つ表示されても横スクロールしない', async ({ page }) => {
    await open(page);
    await openNew(page);
    const u = ui(page);
    await setDue(page, 'datetime');
    await u.saveButton.click();
    for (const message of [MSG.titleRequired, MSG.dateRequired, MSG.timeRequired]) {
      await expect(u.error(message)).toBeVisible();
    }
    await expectNoHScroll(page);
  });
});
