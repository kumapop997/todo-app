// @ts-check
const { defineConfig } = require('@playwright/test');

// 実行条件は docs/test-case.md 2.1 の通り（Chromium のみ・PC 幅・Asia/Tokyo）。
// index.html を file:// で直接開くので、webServer は設定しない。
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    timezoneId: 'Asia/Tokyo',
    locale: 'ja-JP',
    // タイトル欄への貼り付け（TITLE-03 など）で実際のクリップボードを使う
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});
