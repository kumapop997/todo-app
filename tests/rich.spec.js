// @ts-check
// docs/test-case.md 3.10 詳細（RICH）
// 特に書かない限り、[新規] を押してタイトルに「A」を入力した状態から始める。
const {
  test, expect, open, ui, t, plain, MSG, trackDialogs, openNew, openTodo, typeDetail, selectAllDetail,
  saveAndClose, pasteHtml, pasteText, pasteIntoDetail, detailText, toolbarButton, listButton, pickColor,
  setLink, linkTestText, formatOf, tooltipTexts, expectNoNotice, savedTodo, deltaText, attrsOf, attrKeys, escapeRe,
} = require('./helpers');

const LINK_URL = 'https://example.com/';
const LINK_DETAIL = { ops: [{ insert: 'テスト', attributes: { link: LINK_URL } }, { insert: '\n' }] };
const ERRORS = [MSG.titleRequired, MSG.dateRequired, MSG.timeRequired, MSG.dateInvalid, MSG.timeInvalid];
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

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

/** 保存した A の detail */
const savedDetail = async (page) => (await savedTodo(page, 'A')).detail;

/** 行（改行）に付いた属性の list の値を上から集める */
const listValues = (detail) =>
  detail.ops.filter((op) => op.attributes && op.attributes.list).map((op) => op.attributes.list);

/** example.com へのリクエストに空のページを返す */
const stubExample = (context) =>
  context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>example</title>' }),
  );

/** リンク「テスト」を持つ A を開き、エディタ内の「テスト」をクリックしてプレビューを出す */
async function openLinkPreview(page, context) {
  await stubExample(context);
  await open(page, { todos: [t('A', undefined, { detail: LINK_DETAIL })] });
  await openTodo(page, 'A');
  const u = ui(page);
  await u.editor.getByText('テスト', { exact: true }).click();
  await expect(u.tooltip).toBeVisible();
  return u.tooltip.locator(`a[href="${LINK_URL}"]`);
}

/**
 * RICH-01〜09: 「テスト」と入力して全体を選択し、装飾を付けて保存し、開き直す。
 * apply: 装飾を付ける。saved: 保存内容の判定。shown: 開き直したエディタの判定。
 */
const DECORATIONS = [
  {
    id: 'RICH-01', name: '太字',
    apply: (page) => toolbarButton(page, 'bold').click(),
    saved: (detail) => expect(attrsOf(detail, 'テスト')).toEqual({ bold: true }),
    shown: (format) => expect(format.bold).toBe(true),
  },
  {
    id: 'RICH-02', name: '斜体',
    apply: (page) => toolbarButton(page, 'italic').click(),
    saved: (detail) => expect(attrsOf(detail, 'テスト')).toEqual({ italic: true }),
    shown: (format) => expect(format.italic).toBe(true),
  },
  {
    id: 'RICH-03', name: '下線',
    apply: (page) => toolbarButton(page, 'underline').click(),
    saved: (detail) => expect(attrsOf(detail, 'テスト')).toEqual({ underline: true }),
    shown: (format) => expect(format.underline).toBe(true),
  },
  {
    id: 'RICH-04', name: '取り消し線',
    apply: (page) => toolbarButton(page, 'strike').click(),
    saved: (detail) => expect(attrsOf(detail, 'テスト')).toEqual({ strike: true }),
    shown: (format) => expect(format.strike).toBe(true),
  },
  {
    id: 'RICH-05', name: '文字色（パレットの赤）',
    apply: (page) => pickColor(page, 'color', 'red'),
    saved: (detail, picked) => expect(attrsOf(detail, 'テスト')).toEqual({ color: picked.value }),
    shown: (format, picked) => expect(format.color).toBe(picked.css),
  },
  {
    id: 'RICH-06', name: '背景色（パレットの黄）',
    apply: (page) => pickColor(page, 'background', 'yellow'),
    saved: (detail, picked) => expect(attrsOf(detail, 'テスト')).toEqual({ background: picked.value }),
    shown: (format, picked) => expect(format.background).toBe(picked.css),
  },
  {
    id: 'RICH-07', name: '箇条書き（番号なし）',
    apply: (page) => listButton(page, 'bullet').click(),
    saved: (detail) => expect(listValues(detail)).toEqual(['bullet']),
    shown: (format) => expect(format.list).toBe('bullet'),
  },
  {
    id: 'RICH-08', name: '箇条書き（番号あり）',
    apply: (page) => listButton(page, 'ordered').click(),
    saved: (detail) => expect(listValues(detail)).toEqual(['ordered']),
    shown: (format) => expect(format.list).toBe('ordered'),
  },
  {
    id: 'RICH-09', name: 'リンク',
    apply: (page) => setLink(page, LINK_URL),
    saved: (detail) => expect(attrsOf(detail, 'テスト')).toEqual({ link: LINK_URL }),
    shown: (format) => expect(format.href).toBe(LINK_URL),
  },
];

test.describe('詳細', () => {
  for (const { id, name, apply, saved, shown } of DECORATIONS) {
    test(`${id} ${name}を付けて保存でき、開き直すと再現される`, async ({ page }) => {
      await start(page);
      await typeDetail(page, 'テスト');
      await page.keyboard.press('ControlOrMeta+A');
      const picked = await apply(page);
      await saveAndClose(page);
      const detail = await savedDetail(page);
      expect(deltaText(detail)).toBe('テスト\n');
      saved(detail, picked);
      await openTodo(page, 'A');
      await expect(ui(page).editor).toHaveText('テスト');
      shown(await formatOf(page, 'テスト'), picked);
    });
  }

  test('RICH-10 書式クリアで装飾を外して保存できる', async ({ page }) => {
    const detail = { ops: [{ insert: 'テスト', attributes: { bold: true, color: '#e60000' } }, { insert: '\n' }] };
    await open(page, { todos: [t('A', undefined, { detail })] });
    await openTodo(page, 'A');
    await selectAllDetail(page);
    await toolbarButton(page, 'clean').click();
    await saveAndClose(page);
    const saved = await savedDetail(page);
    expect(deltaText(saved)).toBe('テスト\n');
    expect(attrKeys(saved)).toEqual([]);
  });

  test('RICH-11 ツールバーには許可した装飾の操作だけがある', async ({ page }) => {
    await start(page);
    const { toolbar } = ui(page);
    const allowed = [
      'button.ql-bold', 'button.ql-italic', 'button.ql-underline', 'button.ql-strike',
      '.ql-picker.ql-color', '.ql-picker.ql-background',
      'button.ql-list[value="bullet"]', 'button.ql-list[value="ordered"]',
      'button.ql-link', 'button.ql-clean',
    ];
    for (const selector of allowed) await expect(toolbar.locator(selector), selector).toBeVisible();
    for (const name of ['image', 'video', 'formula', 'code-block']) {
      await expect(toolbar.locator(`.ql-${name}`), name).toHaveCount(0);
    }
  });

  test('RICH-12 画像を含む HTML を貼り付けても、画像は入らない', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await u.editor.click();
    await pasteHtml(page, '<p>画像<img src="data:image/png;base64,iVBORw0KGgo="></p>', '画像');
    await expect(u.editor).toContainText('画像');
    await expect(u.editor.locator('img')).toHaveCount(0);
    await saveAndClose(page);
    const detail = await savedDetail(page);
    expect(detail.ops.every((op) => typeof op.insert === 'string')).toBe(true);
  });

  test('RICH-13 貼り付けでは、許可した装飾以外の書式を取り除く', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await u.editor.click();
    await pasteHtml(
      page,
      '<h1>見出し</h1><blockquote>引用</blockquote><p style="font-size:40px;text-align:center"><b>太字</b></p><pre>コード</pre>',
      '見出し\n引用\n太字\nコード',
    );
    for (const text of ['見出し', '引用', '太字', 'コード']) await expect(u.editor).toContainText(text);
    await saveAndClose(page);
    const detail = await savedDetail(page);
    for (const text of ['見出し', '引用', '太字', 'コード']) expect(deltaText(detail)).toContain(text);
    expect(attrKeys(detail)).toEqual(['bold']);
    expect(attrsOf(detail, '太字')).toEqual({ bold: true });
  });

  test('RICH-14 [新規] を押した直後の文字数表示は 0 / 2000', async ({ page }) => {
    await open(page);
    await openNew(page);
    await expect(ui(page).counter).toHaveText('0 / 2000');
  });

  test('RICH-15 入力した文字数が表示される', async ({ page }) => {
    await start(page);
    await typeDetail(page, 'あいう');
    await expect(ui(page).counter).toHaveText('3 / 2000');
  });

  test('RICH-16 改行は 1 文字と数え、末尾の自動改行は数えない', async ({ page }) => {
    await start(page);
    await typeDetail(page, 'あ');
    await page.keyboard.press('Enter');
    await page.keyboard.type('い');
    await expect(ui(page).counter).toHaveText('3 / 2000');
  });

  test('RICH-17 装飾を付けても文字数は変わらない', async ({ page }) => {
    await start(page);
    await typeDetail(page, 'あいう');
    await page.keyboard.press('ControlOrMeta+A');
    await toolbarButton(page, 'bold').click();
    await pickColor(page, 'color', 'red');
    await setLink(page, LINK_URL);
    const format = await formatOf(page, 'あいう');
    expect(format.bold).toBe(true);
    expect(format.href).toBe(LINK_URL);
    await expect(ui(page).counter).toHaveText('3 / 2000');
  });

  test('RICH-18 保存済みの詳細を開くと、その文字数が表示される', async ({ page }) => {
    await open(page, { todos: [t('A', undefined, { detail: plain('部長に提出') })] });
    await openTodo(page, 'A');
    await expect(ui(page).counter).toHaveText('5 / 2000');
  });

  test('RICH-19 2000 文字ちょうどは貼り付けて保存できる', async ({ page }) => {
    await start(page);
    await pasteIntoDetail(page, 'あ'.repeat(2000));
    await expect(ui(page).counter).toHaveText('2000 / 2000');
    await saveAndClose(page);
    expect(deltaText(await savedDetail(page)).replace(/\n$/, '')).toBe('あ'.repeat(2000));
  });

  test('RICH-20 2000 文字のあとには、キーボードから入力できない', async ({ page }) => {
    await start(page);
    await pasteIntoDetail(page, 'あ'.repeat(2000));
    await expect(ui(page).counter).toHaveText('2000 / 2000');
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('い');
    await expect(ui(page).counter).toHaveText('2000 / 2000');
    await expect.poll(() => detailText(page)).toBe('あ'.repeat(2000));
  });

  test('RICH-21 2000 文字を超える貼り付けは、超えた分を切り捨てる', async ({ page }) => {
    await start(page);
    await pasteIntoDetail(page, 'あ'.repeat(2000) + 'い'.repeat(500));
    await expect(ui(page).counter).toHaveText('2000 / 2000');
    await expect.poll(() => detailText(page)).toBe('あ'.repeat(2000));
  });

  test('RICH-22 末尾への貼り付けで上限を超えると、入る分だけ入る', async ({ page }) => {
    await start(page);
    await pasteIntoDetail(page, 'あ'.repeat(1990));
    await expect(ui(page).counter).toHaveText('1990 / 2000');
    await page.keyboard.press('ControlOrMeta+End');
    await pasteText(page, 'い'.repeat(20));
    await expect(ui(page).counter).toHaveText('2000 / 2000');
    await expect.poll(() => detailText(page)).toBe('あ'.repeat(1990) + 'い'.repeat(10));
  });

  test('RICH-23 詳細が空でも保存でき、Delta 形式で保存される', async ({ page }) => {
    await start(page);
    await saveAndClose(page);
    const detail = await savedDetail(page);
    expect(typeof detail).toBe('object');
    expect(Array.isArray(detail.ops)).toBe(true);
  });

  test('RICH-24 https のリンクを設定でき、新しいタブで開く指定になる', async ({ page }) => {
    await start(page);
    await linkTestText(page, LINK_URL);
    const link = ui(page).editor.locator('a');
    await expect(link).toHaveText('テスト');
    await expect(link).toHaveAttribute('href', LINK_URL);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('RICH-25 http のリンクを設定できる', async ({ page }) => {
    await start(page);
    await linkTestText(page, 'http://example.com/');
    const link = ui(page).editor.locator('a');
    await expect(link).toHaveAttribute('href', 'http://example.com/');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('RICH-26 mailto のリンクを設定できる', async ({ page }) => {
    await start(page);
    await linkTestText(page, 'mailto:a@example.com');
    await expect(ui(page).editor.locator('a')).toHaveAttribute('href', 'mailto:a@example.com');
  });

  for (const [id, url] of [['RICH-27', 'javascript:alert(1)'], ['RICH-28', 'example.com']]) {
    test(`${id} ${url} はリンクにならず、文字のまま残る`, async ({ page }) => {
      await start(page);
      await linkTestText(page, url);
      const u = ui(page);
      await expect(u.editor).toHaveText('テスト');
      await expect(u.editor.locator('a')).toHaveCount(0);
      await saveAndClose(page);
      // 保存できて閉じる（エラーにしない）。画面上部のメッセージも出ない
      for (const message of ERRORS) await expect(page.getByText(message, { exact: true })).toHaveCount(0);
      await expectNoNotice(page);
      const detail = await savedDetail(page);
      expect(deltaText(detail)).toBe('テスト\n');
      expect(attrKeys(detail)).not.toContain('link');
    });
  }

  test('RICH-29 貼り付けたリンクも、許可したスキームだけがリンクになる', async ({ page }) => {
    await start(page);
    const u = ui(page);
    await u.editor.click();
    await pasteHtml(page, `<a href="javascript:alert(1)">悪</a><a href="${LINK_URL}">良</a>`, '悪良');
    await expect(u.editor).toContainText('悪良');
    await expect(u.editor.locator('a')).toHaveText(['良']);
    await expect(u.editor.locator('a')).toHaveAttribute('href', LINK_URL);
    await saveAndClose(page);
    const detail = await savedDetail(page);
    expect(attrsOf(detail, '悪').link).toBeUndefined();
    expect(attrsOf(detail, '良').link).toBe(LINK_URL);
  });

  test('RICH-30 data・file・ftp・vbscript のスキームはリンクにならない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    const urls = [
      'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'ftp://example.com/', 'vbscript:msgbox(1)',
    ];
    for (const url of urls) {
      await restart(page);
      await linkTestText(page, url);
      await expect(u.editor, url).toHaveText('テスト');
      await expect(u.editor.locator('a'), url).toHaveCount(0);
    }
  });

  test('RICH-31 複数の装飾を組み合わせて保存でき、開き直すと再現される', async ({ page }) => {
    await start(page);
    // 2 行入力し、2 行目を番号ありの箇条書きにしてから、1 行目の「テスト」を装飾する
    await typeDetail(page, 'テスト');
    await page.keyboard.press('Enter');
    await page.keyboard.type('項目');
    await listButton(page, 'ordered').click();
    await page.keyboard.press('ControlOrMeta+Home');
    await page.keyboard.press('Shift+End');
    await toolbarButton(page, 'bold').click();
    await toolbarButton(page, 'underline').click();
    const picked = await pickColor(page, 'color', 'red');
    await setLink(page, LINK_URL);
    await saveAndClose(page);

    const detail = await savedDetail(page);
    expect(deltaText(detail)).toBe('テスト\n項目\n');
    expect(attrsOf(detail, 'テスト')).toEqual({ bold: true, underline: true, color: picked.value, link: LINK_URL });
    expect(attrsOf(detail, '項目')).toEqual({});
    expect(listValues(detail)).toEqual(['ordered']);

    await openTodo(page, 'A');
    await expect(ui(page).editor).toContainText('項目');
    const text = await formatOf(page, 'テスト');
    expect(text).toMatchObject({ bold: true, underline: true, color: picked.css, href: LINK_URL, list: null });
    const item = await formatOf(page, '項目');
    expect(item).toMatchObject({ bold: false, href: null, list: 'ordered' });
  });

  test('RICH-32 エディタ内のリンクをクリックすると、プレビューが出る（まだ開かない）', async ({ page, context }) => {
    const preview = await openLinkPreview(page, context);
    await expect(preview).toBeVisible();
    expect(context.pages()).toHaveLength(1);
  });

  test('RICH-33 プレビューのリンクを押すと、新しいタブで開く', async ({ page, context }) => {
    const preview = await openLinkPreview(page, context);
    const [popup] = await Promise.all([context.waitForEvent('page'), preview.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(LINK_URL);
    expect(context.pages()).toHaveLength(2);
    await expect(ui(page).dialog).toBeVisible();
    expect(page.url()).not.toBe(LINK_URL);
  });

  test('RICH-34 プレビューを出しただけでは変更にならず、確認なしで閉じる', async ({ page, context }) => {
    const dialogs = trackDialogs(page, 'dismiss');
    await openLinkPreview(page, context);
    const u = ui(page);
    await u.cancelButton.click();
    await expect(u.dialog).toBeHidden();
    expect(dialogs.list).toEqual([]);
  });

  test('RICH-35 文の途中への貼り付けで上限を超えると、貼り付けた分の後ろを切り捨てる', async ({ page }) => {
    await start(page);
    await pasteIntoDetail(page, 'あ'.repeat(1990));
    await expect(ui(page).counter).toHaveText('1990 / 2000');
    await page.keyboard.press('ControlOrMeta+Home');
    await pasteText(page, 'い'.repeat(20));
    await expect(ui(page).counter).toHaveText('2000 / 2000');
    await expect.poll(() => detailText(page)).toBe('い'.repeat(10) + 'あ'.repeat(1990));
  });

  test('RICH-36 絵文字は 2 文字と数える', async ({ page }) => {
    await start(page);
    await pasteIntoDetail(page, '😀');
    await expect(ui(page).editor).toHaveText('😀');
    await expect(ui(page).counter).toHaveText('2 / 2000');
  });

  test('RICH-37 上限で絵文字が半分に切れる場合は、その絵文字ごと切り捨てる', async ({ page }) => {
    await start(page);
    await pasteIntoDetail(page, 'あ'.repeat(1999));
    await expect(ui(page).counter).toHaveText('1999 / 2000');
    await page.keyboard.press('ControlOrMeta+End');
    await pasteText(page, '😀');
    await expect(ui(page).counter).toHaveText('1999 / 2000');
    await expect.poll(() => detailText(page)).toBe('あ'.repeat(1999));
    await saveAndClose(page);
    const text = deltaText(await savedDetail(page));
    expect(text).toBe('あ'.repeat(1999) + '\n');
    expect(LONE_SURROGATE.test(text)).toBe(false);
  });

  test('RICH-38 スキームが大文字のリンクも許可される', async ({ page }) => {
    await open(page);
    const u = ui(page);
    for (const url of ['HTTPS://example.com/', 'Http://example.com/', 'MAILTO:a@example.com']) {
      await restart(page);
      await linkTestText(page, url);
      await expect(u.editor.locator('a'), url).toHaveText('テスト');
      // スキームの大文字と小文字は区別しない（保存時の表記までは問わない）
      const sameUrl = new RegExp(`^${escapeRe(url)}$`, 'i');
      await expect(u.editor.locator('a'), url).toHaveAttribute('href', sameUrl);
    }
  });

  test('RICH-39 スキームが大文字の javascript もリンクにならない', async ({ page }) => {
    await open(page);
    const u = ui(page);
    for (const url of ['JAVASCRIPT:alert(1)', 'JavaScript:alert(1)']) {
      await restart(page);
      await linkTestText(page, url);
      await expect(u.editor, url).toHaveText('テスト');
      await expect(u.editor.locator('a'), url).toHaveCount(0);
    }
  });

  test('RICH-40 リンクのプレビューの文言が日本語で表示される', async ({ page, context }) => {
    await openLinkPreview(page, context);
    await expect.poll(() => tooltipTexts(page)).toContain('リンク先:');
    const texts = await tooltipTexts(page);
    for (const text of ['リンク先:', '編集', '削除']) expect(texts).toContain(text);
    for (const text of ['Visit URL:', 'Edit', 'Remove']) expect(texts).not.toContain(text);
  });

  test('RICH-41 リンクの入力欄の文言が日本語で表示される', async ({ page }) => {
    await start(page);
    await typeDetail(page, 'テスト');
    await page.keyboard.press('ControlOrMeta+A');
    await toolbarButton(page, 'link').click();
    await expect(ui(page).tooltip.locator('input[type="text"]')).toBeVisible();
    await expect.poll(() => tooltipTexts(page)).toContain('リンクを入力:');
    const texts = await tooltipTexts(page);
    for (const text of ['リンクを入力:', '保存']) expect(texts).toContain(text);
    for (const text of ['Enter link:', 'Save']) expect(texts).not.toContain(text);
  });
});
