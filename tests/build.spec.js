// @ts-check
// docs/test-case.md 3.15 構成（BUILD）
const {
  test, expect, open, ui, APP_URL, selectTab, expectTitles, trackDialogs, openTodo, saveAndClose, addTodo,
} = require('./helpers');

/** index.html が外部から読み込む script と link */
const externalResources = (page) =>
  page.locator('script[src], link[href]').evaluateAll((elements) =>
    elements.map((el) => ({
      tag: el.tagName.toLowerCase(),
      url: /** @type {any} */ (el).src || /** @type {any} */ (el).href,
      integrity: el.getAttribute('integrity'),
      crossorigin: el.getAttribute('crossorigin'),
    })),
  );

/** リクエストを記録しながら、登録・編集・完了・削除を一通り行う */
async function recordRequests(page, context) {
  /** @type {URL[]} */
  const requests = [];
  context.on('request', (request) => requests.push(new URL(request.url())));
  await open(page);
  trackDialogs(page, 'accept');
  const u = ui(page);
  await addTodo(page, 'A', { due: ['datetime', '2026/10/20', '9:05'], detail: 'メモ' });
  await addTodo(page, 'B');
  await openTodo(page, 'A');
  await u.titleInput.fill('A2');
  await saveAndClose(page);
  await u.completeButton('A2').click();
  for (const name of ['すべて', '完了済', '未完了']) await selectTab(page, name);
  await u.deleteButton('B').click();
  await u.clearDone.click();
  await expectTitles(page, []);
  return requests;
}

test.describe('構成', () => {
  test('BUILD-01 外部から読み込むのは Quill だけで、バージョン固定・integrity・crossorigin が付いている', async ({ page }) => {
    await open(page);
    const resources = await externalResources(page);
    expect(resources.some((r) => r.tag === 'script')).toBe(true);
    for (const resource of resources) {
      expect(resource.url, 'CDN から読み込む').toMatch(/^https:\/\//);
      expect(resource.url, 'Quill のもの').toMatch(/quill/i);
      expect(resource.url, 'URL にバージョン番号が入っている').toMatch(/\d+\.\d+\.\d+/);
      expect(resource.integrity, `${resource.url} の integrity`).toMatch(/^sha(256|384|512)-/);
      expect(resource.crossorigin, `${resource.url} の crossorigin`).not.toBeNull();
    }
  });

  test('BUILD-02 file:// のリクエストは index.html の 1 件だけ', async ({ page, context }) => {
    const requests = await recordRequests(page, context);
    const files = requests.filter((url) => url.protocol === 'file:').map((url) => url.href);
    expect(files).toEqual([APP_URL]);
  });

  test('BUILD-03 file:// 以外のリクエスト先は、Quill を配信する CDN の 1 ホストだけ', async ({ page, context }) => {
    const requests = await recordRequests(page, context);
    const hosts = new Set(requests.filter((url) => /^https?:$/.test(url.protocol)).map((url) => url.host));
    const quillHosts = new Set((await externalResources(page)).map((r) => new URL(r.url).host));
    expect([...quillHosts]).toHaveLength(1);
    expect([...hosts]).toEqual([...quillHosts]);
  });
});
