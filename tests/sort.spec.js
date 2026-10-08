// @ts-check
// docs/test-case.md 3.3 並び順（SORT）
const {
  test, open, t, done, jst, selectTab, expectSections, expectTitles, addTodo, advance,
} = require('./helpers');

test.describe('並び順', () => {
  test('SORT-01 締め切り時点が早い順に並ぶ', async ({ page }) => {
    await open(page, { todos: [t('C', '10/12'), t('A', '10/10 9:00'), t('B', '10/11')] });
    await expectSections(page, [['それ以外', ['A', 'B', 'C']]]);
  });

  test('SORT-02 締め切り時点が同じなら登録が古い順に並ぶ', async ({ page }) => {
    await open(page, {
      todos: [
        t('X', '10/10 9:00', { createdAt: jst('2026-10-02 00:00') }),
        t('Y', '10/10 9:00', { createdAt: jst('2026-10-01 00:00') }),
      ],
    });
    await expectTitles(page, ['Y', 'X']);
  });

  test('SORT-03 同じ日なら時刻指定ありが日のみ指定より前に並ぶ', async ({ page }) => {
    await open(page, { todos: [t('A', '10/7'), t('B', '10/7 23:59'), t('C', '10/7 15:00')] });
    await expectSections(page, [['本日中', ['C', 'B', 'A']]]);
  });

  test('SORT-04 締め切りなしは [それ以外] の最後尾に並ぶ', async ({ page }) => {
    await open(page, { todos: [t('N'), t('A', '2027/1/5'), t('B', '10/9')] });
    await expectSections(page, [['それ以外', ['B', 'A', 'N']]]);
  });

  test('SORT-05 締め切りなし同士は登録が古い順に並ぶ', async ({ page }) => {
    await open(page, {
      todos: [
        t('N2', undefined, { createdAt: jst('2026-10-03 00:00') }),
        t('N1', undefined, { createdAt: jst('2026-10-01 00:00') }),
        t('N3', undefined, { createdAt: jst('2026-10-05 00:00') }),
      ],
    });
    await expectTitles(page, ['N1', 'N2', 'N3']);
  });

  test('SORT-06 [期限切れ] の中も締め切り時点が早い順に並ぶ', async ({ page }) => {
    await open(page, { todos: [t('B', '10/6'), t('C', '10/7 13:00'), t('A', '10/5 9:00')] });
    await expectSections(page, [['期限切れ', ['A', 'B', 'C']]]);
  });

  test('SORT-07 [完了済] は完了した日時が新しい順に並ぶ', async ({ page }) => {
    await open(page, {
      todos: [
        done('A', '10/5', { completedAt: jst('2026-10-07 10:00') }),
        done('B', undefined, { completedAt: jst('2026-10-07 12:00') }),
        done('C', '10/9', { completedAt: jst('2026-10-07 11:00') }),
      ],
    });
    await selectTab(page, '完了済');
    await expectTitles(page, ['B', 'C', 'A']);
  });

  test('SORT-08 [完了済] で完了した日時が同じなら登録が古い順に並ぶ', async ({ page }) => {
    const completedAt = jst('2026-10-07 12:00:00');
    await open(page, {
      todos: [
        done('X', undefined, { createdAt: jst('2026-10-02 00:00'), completedAt }),
        done('Y', undefined, { createdAt: jst('2026-10-01 00:00'), completedAt }),
      ],
    });
    await selectTab(page, '完了済');
    await expectTitles(page, ['Y', 'X']);
  });

  test('SORT-09 [すべて] では完了済みも同じ規則で混ざって並ぶ', async ({ page }) => {
    await open(page, {
      todos: [t('A', '10/7 15:00'), done('B', '10/7 16:00'), t('C', '10/7 17:00'), done('D', '10/7')],
    });
    await selectTab(page, 'すべて');
    await expectSections(page, [['本日中', ['A', 'B', 'C', 'D']]]);
  });

  test('SORT-10 画面から登録した締め切りなしの ToDo は登録した順に並ぶ', async ({ page }) => {
    await open(page);
    await addTodo(page, '一');
    await advance(page, 1);
    await addTodo(page, '二');
    await advance(page, 1);
    await addTodo(page, '三');
    await expectTitles(page, ['一', '二', '三']);
  });
});
