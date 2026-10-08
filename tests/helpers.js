// @ts-check
// E2E テスト共通の部品。docs/test-case.md 2 章（共通の前提）をコードにしたもの。
// 要素の特定に使う data-testid などの取り決めは、test-case.md 2.4 を正とする。

const { test: base, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_PATH = path.join(__dirname, '..', 'index.html');
const APP_URL = pathToFileURL(APP_PATH).href;
const KEY = 'todo-app.todos';
const BROKEN_KEY = 'todo-app.todos.broken';

/** T0 = 2026年10月7日 14:00:00（Asia/Tokyo） */
const T0 = '2026-10-07T05:00:00.000Z';

const TABS = ['すべて', '未完了', '完了済'];
const SECTIONS = ['期限切れ', '本日中', '明日まで', 'それ以外'];
const EMPTY = {
  すべて: 'ToDoはありません。[新規]から登録してください。',
  未完了: '未完了のToDoはありません。',
  完了済: '完了済みのToDoはありません。',
};
const MSG = {
  titleRequired: 'タイトルを入力してください。',
  dateRequired: '日付を入力してください。',
  timeRequired: '時刻を入力してください。',
  dateInvalid: '日付を正しく入力してください。',
  timeInvalid: '時刻を正しく入力してください。',
  loadFailed: '保存データを読み込めませんでした。',
  saveFailed: '保存できませんでした。',
  quillFailed: 'エディタを読み込めませんでした。インターネット接続を確認してください。',
  discard: '変更を破棄しますか？',
};
const BROKEN_JSON = '{"version":1,"todos":[';
const LONG_TITLE = 'abcdefghij0123456789'.repeat(5); // 空白を含まない英数字 100 文字
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// フィクスチャ: 全ケース共通の合格条件（test-case.md 2.2）
// ---------------------------------------------------------------------------

const test = base.extend({
  /** true にすると file:// 以外へのリクエストをすべて失敗させる（Quill 読み込み失敗の再現） */
  blockQuill: [false, { option: true }],

  /** ページ内の例外と console.error を集め、テストの最後に 0 件であることを確かめる */
  problems: [
    async ({ context, blockQuill }, use) => {
      /** @type {string[]} */
      const problems = [];
      context.on('weberror', (e) => problems.push(`pageerror: ${e.error().message}`));
      context.on('console', (m) => {
        if (m.type() !== 'error') return;
        // 遮断した Quill の読み込み失敗そのもののログだけ除く
        if (blockQuill && m.text().includes('Failed to load resource')) return;
        problems.push(`console.error: ${m.text()}`);
      });
      if (blockQuill) {
        await context.route((url) => url.protocol !== 'file:', (route) => route.abort());
      }
      await use(problems);
      expect(problems, 'ページ内の例外・console.error が 0 件であること').toEqual([]);
    },
    { auto: true },
  ],
});

// ---------------------------------------------------------------------------
// データの用意（test-case.md 2.3）
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

/** `2026-10-07 14:00[:ss]` を Asia/Tokyo の時刻として ISO 文字列にする */
function jst(s) {
  const [d, tm = '00:00'] = s.split(' ');
  const [y, m, day] = d.split(/[-/]/).map(Number);
  const [h, mi, sec = 0] = tm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, day, h - 9, mi, sec)).toISOString();
}

/**
 * 未完了の ToDo。due は `10/7 15:30`（日時）、`10/7`（日のみ）、省略（なし）。年を省いたら 2026 年。
 * @param {string} title
 * @param {string} [due]
 * @param {object} [extra] createdAt / updatedAt / completedAt / detail / id などの上書き
 */
function t(title, due, extra = {}) {
  return { title, due, ...extra };
}

/** 完了済みの ToDo（✓）。completedAt は指定がなければ T0 の 1 時間前 */
function done(title, due, extra = {}) {
  return { title, due, completed: true, ...extra };
}

function parseDue(due) {
  if (!due || due === 'なし') return { dueType: 'none', dueDate: null, dueTime: null };
  const [d, tm] = due.split(' ');
  const parts = d.split('/').map(Number);
  if (parts.length === 2) parts.unshift(2026);
  const dueDate = `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
  if (!tm) return { dueType: 'date', dueDate, dueTime: null };
  const [h, mi] = tm.split(':').map(Number);
  return { dueType: 'datetime', dueDate, dueTime: `${pad(h)}:${pad(mi)}` };
}

const plain = (text) => ({ ops: [{ insert: `${text}\n` }] });
const EMPTY_DETAIL = { ops: [{ insert: '\n' }] };

/**
 * 「前提」に書いた順の ToDo を、保存形式の配列にする。
 * createdAt は書いた順に 2026-10-01 00:00 から 1 分刻み。配列は書いた順とは逆順にする。
 */
function buildTodos(specs) {
  const start = Date.parse(jst('2026-10-01 00:00'));
  return specs
    .map((spec, i) => {
      const { title, due, completed = false, ...extra } = spec;
      const createdAt = new Date(start + i * 60_000).toISOString();
      return {
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        title,
        ...parseDue(due),
        detail: EMPTY_DETAIL,
        completed,
        completedAt: completed ? new Date(Date.parse(T0) - 3_600_000).toISOString() : null,
        createdAt,
        updatedAt: createdAt,
        ...extra,
      };
    })
    .reverse();
}

const stateJson = (todos, extra = {}) => JSON.stringify({ version: 1, todos, ...extra });

/** 正しい ToDo 1 件（異常系のデータを作る元にする） */
function validTodo(overrides = {}) {
  return { ...buildTodos([t('A', '10/7 15:30')])[0], ...overrides };
}

// ---------------------------------------------------------------------------
// ページを開く
// ---------------------------------------------------------------------------

/**
 * 現在時刻を固定し、localStorage を用意してから index.html を開く。
 * @param {import('@playwright/test').Page} page
 * @param {{ todos?: object[], storage?: Record<string, string>, now?: string }} [options]
 *   todos: t() / done() の配列。storage: localStorage へそのまま入れる値。now: 現在時刻（ISO）
 */
async function open(page, { todos, storage, now = T0 } = {}) {
  // install した時計は実時間で進む。pauseAt は過去へ戻れないので、少し前の時刻から始めて now まで進めて止める
  await page.clock.install({ time: new Date(Date.parse(now) - 3_600_000) });
  await page.clock.pauseAt(new Date(now));
  const seed = { ...(storage || {}) };
  if (todos) seed[KEY] = stateJson(buildTodos(todos));
  if (Object.keys(seed).length > 0) {
    // 再読み込みで入れ直さないよう、タブごとに初回だけ入れる
    await page.addInitScript((data) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    }, seed);
  }
  await page.goto(APP_URL);
}

/** 同じブラウザコンテキストで 2 ページ目（別タブ）を開く */
async function openSecond(context) {
  const page2 = await context.newPage();
  await page2.goto(APP_URL);
  return page2;
}

/** localStorage を指定の内容に入れ替えて再読み込みする（1 テストの中で複数のデータを試すとき） */
async function reopenWith(page, storage = {}) {
  await page.evaluate((data) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, storage);
  await page.reload();
}

const reopenWithTodos = (page, todos) => reopenWith(page, { [KEY]: stateJson(buildTodos(todos)) });

/** clock を進める（タイマーも発火する） */
const advance = (page, minutes) => page.clock.runFor(minutes * 60_000);

// ---------------------------------------------------------------------------
// 要素の特定
// ---------------------------------------------------------------------------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactly = (s) => new RegExp(`^\\s*${escapeRe(s)}\\s*$`);

/** @param {import('@playwright/test').Page} page */
function ui(page) {
  const dialog = page.getByRole('dialog');
  const list = page.getByTestId('todo-list');
  const row = (title) =>
    list.getByTestId('todo-row').filter({ has: page.getByTestId('todo-title').filter({ hasText: exactly(title) }) });
  const button = (root, name) => root.getByRole('button', { name, exact: true });
  return {
    heading: page.getByRole('heading', { name: 'ToDoリスト', exact: true }),
    newButton: button(page, '新規'),
    tab: (name) => page.getByRole('tab', { name, exact: true }),
    clearDone: button(page, '完了済を削除'),
    list,
    rows: list.getByTestId('todo-row'),
    titles: list.getByTestId('todo-title'),
    row,
    title: (title) => row(title).getByTestId('todo-title'),
    due: (title) => row(title).getByTestId('todo-due'),
    completeButton: (title) => button(row(title), '完了'),
    revertButton: (title) => button(row(title), '未完了に戻す'),
    deleteButton: (title) => button(row(title), '削除'),
    sectionHeading: (name) => list.getByRole('heading', { name, exact: true }),
    emptyMessage: (tab) => list.getByText(EMPTY[tab], { exact: true }),
    notices: page.getByTestId('notice'),
    notice: (text) => page.getByTestId('notice').filter({ hasText: text }),
    dialog,
    titleInput: dialog.getByRole('textbox', { name: 'タイトル', exact: true }),
    radio: (name) => dialog.getByRole('radio', { name, exact: true }),
    dateOnly: dialog.getByTestId('due-date-only'),
    dtDate: dialog.getByTestId('due-datetime-date'),
    dtTime: dialog.getByTestId('due-datetime-time'),
    editor: dialog.locator('.ql-editor'),
    toolbar: dialog.locator('.ql-toolbar'),
    counter: dialog.getByText(/^\s*\d+ \/ 2000\s*$/),
    saveButton: button(dialog, '保存'),
    cancelButton: button(dialog, 'キャンセル'),
    error: (message) => dialog.getByText(message, { exact: true }),
    tooltip: page.locator('.ql-tooltip'),
  };
}

// ---------------------------------------------------------------------------
// メイン画面の操作と判定
// ---------------------------------------------------------------------------

async function expectSelectedTab(page, name) {
  for (const tab of TABS) {
    await expect(ui(page).tab(tab)).toHaveAttribute('aria-selected', tab === name ? 'true' : 'false');
  }
}

async function selectTab(page, name) {
  await ui(page).tab(name).click();
  await expectSelectedTab(page, name);
}

/** 一覧のタイトルを上から順に比べる */
async function expectTitles(page, titles) {
  const u = ui(page);
  if (titles.length === 0) await expect(u.titles).toHaveCount(0);
  else await expect(u.titles).toHaveText(titles);
}

/** 一覧を上から読み、[見出し, その下のタイトルの配列] の並びにする。見出しの前の行は見出し null */
function readSections(page) {
  return ui(page).list.evaluate((root) => {
    const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    /** @type {[string | null, string[]][]} */
    const out = [];
    const marks = root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],[data-testid="todo-title"]');
    for (const el of marks) {
      if (!visible(el)) continue;
      const text = (el.textContent || '').trim();
      if (el.matches('[data-testid="todo-title"]')) {
        if (out.length === 0) out.push([null, []]);
        out[out.length - 1][1].push(text);
      } else {
        out.push([text, []]);
      }
    }
    return out;
  });
}

/**
 * 区分の見出しと、その下に並ぶタイトルを上から順に比べる。
 * @param {[string, string[]][]} expected 例: [['期限切れ', ['A']], ['本日中', ['B', 'C']]]
 */
async function expectSections(page, expected) {
  await expect.poll(() => readSections(page)).toEqual(expected);
}

/** タイトルの ToDo が入っている区分の見出し */
async function sectionOf(page, title) {
  const found = (await readSections(page)).find(([, titles]) => titles.includes(title));
  return found ? found[0] : undefined;
}

const expectSectionOf = (page, title, section) => expect.poll(() => sectionOf(page, title)).toBe(section);

/** 確認ダイアログを記録し、OK（accept）かキャンセル（dismiss）で答える。1 ページにつき 1 回だけ呼ぶ */
function trackDialogs(page, action = 'accept') {
  const log = {
    action,
    /** @type {{ type: string, message: string }[]} */
    list: [],
  };
  page.on('dialog', async (dialog) => {
    log.list.push({ type: dialog.type(), message: dialog.message() });
    if (log.action === 'accept') await dialog.accept();
    else await dialog.dismiss();
  });
  return log;
}

const confirmOf = (message) => [{ type: 'confirm', message }];

async function rgbOf(locator) {
  const color = await locator.evaluate((el) => getComputedStyle(el).color);
  return (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
}
const isRed = ([r, g, b]) => r > g && r > b;
const isGrayish = ([r, g, b]) => Math.abs(r - g) <= 16 && Math.abs(g - b) <= 16 && Math.abs(r - b) <= 16;

const expectRed = (locator, red = true) => expect.poll(async () => isRed(await rgbOf(locator))).toBe(red);

/** グレー: 成分の差が 16 以下で、未完了の行のタイトルの色（normal）と異なる */
async function expectGray(locator, normal) {
  await expect
    .poll(async () => {
      const rgb = await rgbOf(locator);
      return isGrayish(rgb) && rgb.join() !== normal.join();
    })
    .toBe(true);
}

const STRIKE = /line-through/;
const expectStrike = (locator, on = true) =>
  on
    ? expect(locator).toHaveCSS('text-decoration-line', STRIKE)
    : expect(locator).not.toHaveCSS('text-decoration-line', STRIKE);

async function box(locator) {
  const b = await locator.boundingBox();
  expect(b, '要素が表示されていること').not.toBeNull();
  return { ...b, right: b.x + b.width, bottom: b.y + b.height };
}

const expectNoHScroll = (page) =>
  expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);

// ---------------------------------------------------------------------------
// 画面上部のメッセージ
// ---------------------------------------------------------------------------

/** メッセージが 1 つだけ表示され、[×]（閉じる）を持ち、[新規] より上にある */
async function expectNotice(page, text) {
  const u = ui(page);
  const notice = u.notice(text);
  await expect(notice).toHaveCount(1);
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('button', { name: '閉じる', exact: true })).toBeVisible();
  expect((await box(notice)).bottom).toBeLessThanOrEqual((await box(u.newButton)).y + 1);
}

const expectNoNotice = (page, text) =>
  text ? expect(ui(page).notice(text)).toHaveCount(0) : expect(ui(page).notices).toHaveCount(0);

const closeNotice = (page, text) =>
  ui(page).notice(text).getByRole('button', { name: '閉じる', exact: true }).click();

// ---------------------------------------------------------------------------
// 詳細画面の操作
// ---------------------------------------------------------------------------

/** [新規] で詳細画面を開く。title を渡すとタイトルも入力する */
async function openNew(page, title) {
  const u = ui(page);
  await u.newButton.click();
  await expect(u.dialog).toBeVisible();
  if (title !== undefined) await u.titleInput.fill(title);
}

/** 一覧のタイトルをクリックして詳細画面を開く */
async function openTodo(page, title) {
  const u = ui(page);
  await u.title(title).click();
  await expect(u.dialog).toBeVisible();
}

/**
 * 日時の選択肢を選び、入力欄を埋める（undefined の欄は触らない）。
 * @param {'none' | 'date' | 'datetime'} type
 */
async function setDue(page, type, date, time) {
  const u = ui(page);
  if (type === 'none') {
    await u.radio('なし').check();
  } else if (type === 'date') {
    await u.radio('日のみ').check();
    if (date !== undefined) await u.dateOnly.fill(date);
  } else {
    await u.radio('日時').check();
    if (date !== undefined) await u.dtDate.fill(date);
    if (time !== undefined) await u.dtTime.fill(time);
  }
}

/** エディタにフォーカスを置いてキーボードで入力する */
async function typeDetail(page, text) {
  await ui(page).editor.click();
  await page.keyboard.type(text);
}

/** エディタの中身を全選択する */
async function selectAllDetail(page) {
  await ui(page).editor.click();
  await page.keyboard.press('ControlOrMeta+A');
}

/** [保存] を押し、詳細画面が閉じるのを待つ */
async function saveAndClose(page) {
  const u = ui(page);
  await u.saveButton.click();
  await expect(u.dialog).toBeHidden();
}

/** 画面から 1 件登録する */
async function addTodo(page, title, { due, detail } = {}) {
  await openNew(page, title);
  if (due) await setDue(page, due[0], due[1], due[2]);
  if (detail) await typeDetail(page, detail);
  await saveAndClose(page);
}

/** ポップアップの外の領域をクリックする */
const clickOutside = (page) => page.mouse.click(5, 5);

/** [キャンセル]・Esc・外側クリックの 3 通りの閉じ方 */
const CLOSERS = {
  '[キャンセル]': (page) => ui(page).cancelButton.click(),
  Esc: (page) => page.keyboard.press('Escape'),
  外側クリック: clickOutside,
};

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** フォーカスのある要素（エディタ）に、text/html と text/plain を持つ paste イベントを発生させる */
async function pasteHtml(page, html, text) {
  await page.evaluate(
    ({ html, text }) => {
      const data = new DataTransfer();
      data.setData('text/html', html);
      data.setData('text/plain', text);
      const target = document.activeElement || document.body;
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    },
    { html, text },
  );
}

const pasteText = (page, text) => pasteHtml(page, escapeHtml(text), text);

/** エディタをクリックしてフォーカスを置き、貼り付ける */
async function pasteIntoDetail(page, text) {
  await ui(page).editor.click();
  await pasteText(page, text);
}

/** input 欄には合成の paste イベントが効かないので、実際のクリップボードから貼り付ける */
async function pasteIntoInput(page, locator, text) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await locator.focus();
  await page.keyboard.press('ControlOrMeta+V');
}

/** エディタの文字（末尾の改行を除く） */
const detailText = (page) => ui(page).editor.evaluate((el) => (el.innerText || '').replace(/\n$/, ''));

const toolbarButton = (page, name) => ui(page).toolbar.locator(`button.ql-${name}`);
const listButton = (page, value) => ui(page).toolbar.locator(`button.ql-list[value="${value}"]`);

/**
 * 文字色（color）か背景色（background）のパレットから、赤か黄を選ぶ。
 * @param {'color' | 'background'} kind
 * @param {'red' | 'yellow'} want
 * @returns {Promise<{ value: string, css: string }>} value: Delta に入る値、css: 計算後の色
 */
async function pickColor(page, kind, want) {
  const picker = ui(page).toolbar.locator(`.ql-picker.ql-${kind}`);
  await picker.locator('.ql-picker-label').click();
  const found = await picker.locator('.ql-picker-item').evaluateAll((items, want) => {
    for (const item of items) {
      const value = item.getAttribute('data-value');
      const css = getComputedStyle(item).backgroundColor;
      const [r, g, b] = (css.match(/[\d.]+/g) || []).map(Number);
      const ok = want === 'red' ? r >= 200 && g <= 80 && b <= 80 : r >= 200 && g >= 200 && b <= 80;
      if (value && ok) return { value, css };
    }
    return null;
  }, want);
  expect(found, `パレットに ${want} があること`).not.toBeNull();
  await picker.locator(`.ql-picker-item[data-value="${found.value}"]`).click();
  return found;
}

/** 選択中の文字に、ツールバーのリンクから URL を設定する */
async function setLink(page, url) {
  const u = ui(page);
  await toolbarButton(page, 'link').click();
  await u.tooltip.locator('input[type="text"]').fill(url);
  await u.tooltip.locator('.ql-action').click();
}

/** 詳細に「テスト」と入力して全体を選択し、リンクを設定する（RICH-24 以降の「同じ手順」） */
async function linkTestText(page, url) {
  await typeDetail(page, 'テスト');
  await page.keyboard.press('ControlOrMeta+A');
  await setLink(page, url);
}

/**
 * エディタの中で text を含む文字の見た目を調べる。見つからなければ null。
 * 下線と取り消し線は継承されないので、エディタまでの祖先をたどって集める。
 */
function formatOf(page, text) {
  return ui(page).editor.evaluate((root, text) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !(node.nodeValue || '').includes(text)) node = walker.nextNode();
    if (!node || !node.parentElement) return null;
    const el = node.parentElement;
    const style = getComputedStyle(el);
    const chain = [];
    for (let e = el; e && e !== root; e = e.parentElement) chain.push(e);
    const lines = chain.map((e) => getComputedStyle(e).textDecorationLine).join(' ');
    const backgrounds = chain.map((e) => getComputedStyle(e).backgroundColor);
    const link = el.closest('a');
    const item = el.closest('li');
    const base = getComputedStyle(root);
    return {
      bold: Number(style.fontWeight) >= 600,
      italic: style.fontStyle === 'italic',
      underline: lines.includes('underline'),
      strike: lines.includes('line-through'),
      color: style.color,
      background: backgrounds.find((c) => c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') || null,
      href: link ? link.getAttribute('href') : null,
      target: link ? link.getAttribute('target') : null,
      list: item ? item.getAttribute('data-list') || (item.parentElement?.tagName === 'UL' ? 'bullet' : 'ordered') : null,
      sameFontSize: style.fontSize === base.fontSize,
      sameFontFamily: style.fontFamily === base.fontFamily,
      textAlign: style.textAlign,
      verticalAlign: style.verticalAlign,
    };
  }, text);
}

/** Quill のリンク用ポップアップに見えている文言（疑似要素の content を含む）をつなげた文字列 */
function tooltipTexts(page) {
  return ui(page).tooltip.evaluate((root) => {
    const parts = [];
    const pseudo = (el, which) => {
      const content = getComputedStyle(el, which).content;
      if (content && content !== 'none' && content !== 'normal') parts.push(content.replace(/^["']|["']$/g, ''));
    };
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.getClientRects().length === 0) continue;
      pseudo(el, '::before');
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && (child.nodeValue || '').trim()) parts.push((child.nodeValue || '').trim());
      }
      pseudo(el, '::after');
    }
    return parts.join(' | ');
  });
}

// ---------------------------------------------------------------------------
// 保存内容
// ---------------------------------------------------------------------------

/** localStorage の値そのもの（キーがなければ null） */
const rawSaved = (page, key = KEY) => page.evaluate((k) => localStorage.getItem(k), key);

/** 保存内容（JSON.parse した値）。キーがなければ null */
async function saved(page) {
  const raw = await rawSaved(page);
  return raw === null ? null : JSON.parse(raw);
}

/** 保存されている ToDo の配列。キーがなければ空 */
async function savedTodos(page) {
  const state = await saved(page);
  return state ? state.todos : [];
}

/** タイトルで 1 件取り出す */
async function savedTodo(page, title) {
  return (await savedTodos(page)).find((todo) => todo.title === title);
}

/** Delta の文字をつなげる（埋め込みは除く） */
const deltaText = (detail) => detail.ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');

/** Delta の中で text を含む挿入の属性（なければ空のオブジェクト） */
function attrsOf(detail, text) {
  const op = detail.ops.find((o) => typeof o.insert === 'string' && o.insert.includes(text));
  expect(op, `detail に「${text}」があること`).toBeTruthy();
  return op.attributes || {};
}

/** Delta に出てくる属性名をすべて集める */
const attrKeys = (detail) => [...new Set(detail.ops.flatMap((op) => Object.keys(op.attributes || {})))].sort();

/** 書き込みを失敗させる（test-case.md 2.4） */
const failWrites = (page) =>
  page.evaluate(() => {
    const w = /** @type {any} */ (window);
    if (!w.__setItem) w.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };
  });

/** 書き込みを元に戻す */
const restoreWrites = (page) =>
  page.evaluate(() => {
    Storage.prototype.setItem = /** @type {any} */ (window).__setItem;
  });

/**
 * from での localStorage の変更が to に届ききるのを待つ（「変わらない」ことを確かめる前に使う）。
 * storage イベントは順に届くので、目印のキーの通知が届けば、それより前の変更も届いている。
 */
async function waitForStorageSync(from, to) {
  await to.evaluate(() => {
    /** @type {any} */ (window).__synced = new Promise((resolve) => {
      window.addEventListener('storage', function handler(e) {
        if (e.key !== '__sync') return;
        window.removeEventListener('storage', handler);
        resolve(true);
      });
    });
  });
  await from.evaluate(() => {
    localStorage.setItem('__sync', '1');
    localStorage.removeItem('__sync');
  });
  await to.evaluate(() => /** @type {any} */ (window).__synced);
}

module.exports = {
  test,
  expect,
  APP_PATH,
  APP_URL,
  KEY,
  BROKEN_KEY,
  T0,
  TABS,
  SECTIONS,
  EMPTY,
  MSG,
  BROKEN_JSON,
  LONG_TITLE,
  UUID_RE,
  jst,
  t,
  done,
  plain,
  EMPTY_DETAIL,
  buildTodos,
  stateJson,
  validTodo,
  open,
  openSecond,
  reopenWith,
  reopenWithTodos,
  advance,
  ui,
  expectSelectedTab,
  selectTab,
  expectTitles,
  readSections,
  expectSections,
  sectionOf,
  expectSectionOf,
  trackDialogs,
  confirmOf,
  rgbOf,
  isRed,
  isGrayish,
  expectRed,
  expectGray,
  expectStrike,
  box,
  expectNoHScroll,
  expectNotice,
  expectNoNotice,
  closeNotice,
  openNew,
  openTodo,
  setDue,
  typeDetail,
  selectAllDetail,
  saveAndClose,
  addTodo,
  clickOutside,
  CLOSERS,
  pasteHtml,
  pasteText,
  pasteIntoDetail,
  pasteIntoInput,
  detailText,
  toolbarButton,
  listButton,
  pickColor,
  setLink,
  linkTestText,
  formatOf,
  tooltipTexts,
  rawSaved,
  saved,
  savedTodos,
  savedTodo,
  deltaText,
  attrsOf,
  attrKeys,
  failWrites,
  restoreWrites,
  waitForStorageSync,
  escapeRe,
};
