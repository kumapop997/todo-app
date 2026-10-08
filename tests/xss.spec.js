// @ts-check
// docs/test-case.md 3.14 HTML の無害化（XSS）
const {
  test, expect, open, ui, t, done, selectTab, expectTitles, trackDialogs, confirmOf, openNew, openTodo,
  typeDetail, saveAndClose, addTodo, pasteHtml, formatOf,
} = require('./helpers');

const SCRIPT = '<script>window.__xss=1</script>';
const IMG = '<img src=x onerror="window.__xss=1">';
const BOLD = '<b>太字</b>';

const xssFlag = (page) => page.evaluate(() => /** @type {any} */ (window).__xss);

test.describe('HTML の無害化', () => {
  test('XSS-01 タイトルの script タグは文字として表示され、実行されない', async ({ page }) => {
    await open(page);
    await addTodo(page, SCRIPT);
    await expectTitles(page, [SCRIPT]);
    await expect(ui(page).list.locator('script')).toHaveCount(0);
    expect(await xssFlag(page)).toBeUndefined();
  });

  test('XSS-02 タイトルの img タグは文字として表示され、要素にならない', async ({ page }) => {
    await open(page);
    await addTodo(page, IMG);
    await expectTitles(page, [IMG]);
    await expect(ui(page).list.locator('img')).toHaveCount(0);
    expect(await xssFlag(page)).toBeUndefined();
  });

  test('XSS-03 タイトルの b タグは文字として表示され、要素にならない', async ({ page }) => {
    await open(page);
    await addTodo(page, BOLD);
    await expectTitles(page, [BOLD]);
    await expect(ui(page).list.locator('b')).toHaveCount(0);
  });

  test('XSS-04 保存データのタイトルにタグがあっても、一覧と詳細画面で文字のまま表示される', async ({ page }) => {
    // 3 つのタブのどれにも行が出るよう、3 件目だけ完了済みにしておく
    await open(page, { todos: [t(SCRIPT), t(IMG), done(BOLD)] });
    const u = ui(page);
    const shown = { 未完了: [SCRIPT, IMG], すべて: [SCRIPT, IMG, BOLD], 完了済: [BOLD] };
    for (const [tab, titles] of Object.entries(shown)) {
      await selectTab(page, tab);
      await expectTitles(page, titles);
      await expect(u.list.locator('script, img, b')).toHaveCount(0);
      for (const title of titles) {
        await openTodo(page, title);
        await expect(u.titleInput).toHaveValue(title);
        await u.cancelButton.click();
        await expect(u.dialog).toBeHidden();
      }
    }
    expect(await xssFlag(page)).toBeUndefined();
  });

  test('XSS-05 削除の確認メッセージにもタイトルがそのまま入る', async ({ page }) => {
    await open(page, { todos: [t('<b>x</b>')] });
    const dialogs = trackDialogs(page, 'dismiss');
    await ui(page).deleteButton('<b>x</b>').click();
    expect(dialogs.list).toEqual(confirmOf('『<b>x</b>』を削除しますか？'));
  });

  test('XSS-06 詳細に入力したタグは文字として保存・表示され、実行されない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page, 'A');
    await typeDetail(page, SCRIPT + IMG);
    await saveAndClose(page);
    await openTodo(page, 'A');
    await expect(u.editor).toHaveText(SCRIPT + IMG);
    await expect(u.editor.locator('script, img')).toHaveCount(0);
    expect(await xssFlag(page)).toBeUndefined();
  });

  test('XSS-07 HTML として貼り付けたタグと属性は取り除かれる', async ({ page }) => {
    await open(page);
    const u = ui(page);
    await openNew(page);
    await u.editor.click();
    await pasteHtml(
      page,
      `${SCRIPT}${IMG}<iframe src="https://example.com/"></iframe><p onclick="window.__xss=1">本文</p>`,
      '本文',
    );
    await expect(u.editor).toContainText('本文');
    await expect(u.editor.locator('script, img, iframe')).toHaveCount(0);
    await expect(u.dialog.locator('[onclick]')).toHaveCount(0);
    await u.editor.getByText('本文').click();
    expect(await xssFlag(page)).toBeUndefined();
  });

  test('XSS-08 保存データに画像・動画の埋め込みがあっても表示せず、読み込みもしない', async ({ page, context }) => {
    /** @type {string[]} */
    const requests = [];
    context.on('request', (request) => {
      if (new URL(request.url()).hostname === 'example.com') requests.push(request.url());
    });
    await context.route('**://example.com/**', (route) => route.abort());
    const detail = {
      ops: [
        { insert: { image: 'https://example.com/x.png' } },
        { insert: { video: 'https://example.com/v' } },
        { insert: '本文\n' },
      ],
    };
    await open(page, { todos: [t('A', undefined, { detail })] });
    const u = ui(page);
    await openTodo(page, 'A');
    await expect(u.editor).toContainText('本文');
    await expect(u.editor.locator('img, iframe, video')).toHaveCount(0);
    expect(requests).toEqual([]);
  });

  test('XSS-09 保存データの javascript: リンクはリンクにせず、文字として表示する', async ({ page }) => {
    const detail = {
      ops: [{ insert: '悪', attributes: { link: 'javascript:window.__xss=1' } }, { insert: '\n' }],
    };
    await open(page, { todos: [t('A', undefined, { detail })] });
    const u = ui(page);
    await openTodo(page, 'A');
    await expect(u.editor).toHaveText('悪');
    await u.editor.getByText('悪').click();
    await expect(page.locator('[href^="javascript:" i]')).toHaveCount(0);
    await expect(u.editor.locator('a')).toHaveCount(0);
    expect(await xssFlag(page)).toBeUndefined();
  });

  test('XSS-10 保存データに許可していない書式があっても反映しない', async ({ page }) => {
    const detail = {
      ops: [
        { insert: '文字', attributes: { size: 'huge', font: 'monospace', script: 'super' } },
        { insert: '\n', attributes: { header: 1, align: 'center' } },
        { insert: 'コード' },
        { insert: '\n', attributes: { 'code-block': true } },
      ],
    };
    await open(page, { todos: [t('A', undefined, { detail })] });
    const u = ui(page);
    await openTodo(page, 'A');
    await expect(u.editor).toContainText('文字');
    await expect(u.editor).toContainText('コード');
    await expect(
      u.editor.locator(
        'h1, h2, h3, h4, h5, h6, pre, code, sup, sub, .ql-code-block, [class*="ql-size-"], [class*="ql-font-"], [class*="ql-align-"]',
      ),
    ).toHaveCount(0);
    for (const text of ['文字', 'コード']) {
      const format = await formatOf(page, text);
      expect(format.sameFontSize, `${text} の文字サイズ`).toBe(true);
      expect(format.sameFontFamily, `${text} のフォント`).toBe(true);
      expect(format.textAlign, `${text} の揃え`).not.toBe('center');
      expect(format.verticalAlign, `${text} の上付き`).not.toBe('super');
    }
  });
});
