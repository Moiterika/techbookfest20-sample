import type { Page } from "@playwright/test";

/** URL をデコードしてからパターンを含むか判定 */
function urlIncludes(url: string, pattern: string): boolean {
  return decodeURIComponent(url).includes(pattern);
}

/** 指定URLパターンへの htmx リクエスト完了を待ちつつアクションを実行 */
export async function withHtmx(page: Page, urlPattern: string, action: () => Promise<void>) {
  await Promise.all([
    page.waitForResponse((r) => urlIncludes(r.url(), urlPattern) && r.ok()),
    action(),
  ]);
}

/** htmx がテーブル本体を読み込むまで待つ */
export async function waitForTableLoad(page: Page, apiPath: string) {
  await page.waitForResponse((r) => urlIncludes(r.url(), apiPath) && r.ok());
}

/** ページ遷移してテーブル読み込みを待つ（リスナーを先に登録してレースを防ぐ） */
export async function gotoAndWaitForTable(page: Page, path: string, apiPath: string) {
  const tableLoaded = page.waitForResponse((r) => urlIncludes(r.url(), apiPath) && r.ok());
  await page.goto(path);
  await tableLoaded;
}
