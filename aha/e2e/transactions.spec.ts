import { test, expect, type Page } from "@playwright/test";

/** 指定URLパターンへの htmx リクエスト完了を待ちつつアクションを実行 */
async function withHtmx(page: Page, urlPattern: string, action: () => Promise<void>) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(urlPattern) && r.ok()),
    action(),
  ]);
}

/** htmx がテーブル本体を読み込むまで待つ */
async function waitForTableLoad(page: Page) {
  await page.waitForResponse((r) => r.url().includes("/api/transactions") && r.ok());
}

/** 品目を先に登録（取引に品目が必要） */
async function ensureItem(page: Page): Promise<{ code: string }> {
  const code = `TX-ITEM-${Date.now()}`;
  await page.goto("/items");
  await page.waitForResponse((r) => r.url().includes("/api/items") && r.ok());

  await page.getByText("＋ 新規追加").click();
  const form = page.locator("form[hx-post='/api/items']");
  await expect(form).toBeVisible();

  await form.locator("input[name='code']").fill(code);
  await form.locator("input[name='name']").fill("取引テスト品目");
  await form.locator("input[name='price']").fill("500");

  await withHtmx(page, "/api/items", () => form.getByText("登録する").click());

  return { code };
}

test.describe("取引管理", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transactions");
    await waitForTableLoad(page);
  });

  test("取引管理ページが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "取引管理", level: 1 })).toBeVisible();
    await expect(page.getByText("＋ 新規追加")).toBeVisible();
    await expect(page.locator("input[name='dateFrom']")).toBeVisible();
    await expect(page.locator("input[name='dateTo']")).toBeVisible();
  });

  test("新規追加フォームの開閉ができる", async ({ page }) => {
    await page.getByText("＋ 新規追加").click();
    await expect(page.getByText("新規取引登録")).toBeVisible();

    await page.getByText("閉じる").click();
    await expect(page.getByText("新規取引登録")).not.toBeVisible();
  });

  test("取引を新規登録できる（品目タイプアヘッド経由）", async ({ page }) => {
    const { code } = await ensureItem(page);
    await page.goto("/transactions");
    await waitForTableLoad(page);

    await page.getByText("＋ 新規追加").click();
    await expect(page.getByText("新規取引登録")).toBeVisible();

    // タイプアヘッド: 品目コードで検索
    const typeahead = page.locator("[data-typeahead]").first();
    const searchInput = typeahead.locator("input[name='q']");
    await withHtmx(page, "/api/items/search", () => searchInput.fill(code));

    // 候補リストの li をクリック
    const listItem = typeahead.locator("li", { hasText: code }).first();
    await withHtmx(page, "/api/items/typeahead", () => listItem.click());

    // 単価・数量を入力
    const form = page.locator("form[hx-post='/api/transactions']");
    await form.locator("input[name='unitPrice']").fill("500");
    await form.locator("input[name='quantity']").fill("3");

    // 登録
    await withHtmx(page, "/api/transactions", () => form.getByText("登録する").click());

    // テーブルに取引が表示される
    await expect(page.locator("#tx-body")).toContainText(code);
  });

  test("選択コピー・選択削除ボタンは未選択時に無効", async ({ page }) => {
    await expect(page.getByText("選択コピー")).toBeDisabled();
    await expect(page.getByText("選択削除")).toBeDisabled();
  });

  test("更新ボタンでテーブルがリロードされる", async ({ page }) => {
    await withHtmx(page, "/api/transactions", () =>
      page.locator("button", { hasText: "更新" }).click(),
    );
    await expect(page.getByRole("heading", { name: "取引管理", level: 1 })).toBeVisible();
  });

  test("日付フィルタが機能する", async ({ page }) => {
    const dateFrom = page.locator("input[name='dateFrom']");
    const dateTo = page.locator("input[name='dateTo']");

    await withHtmx(page, "/api/transactions", () => dateFrom.fill("2099-01-01"));
    await withHtmx(page, "/api/transactions", () => dateTo.fill("2099-12-31"));

    const bodyText = await page.locator("#tx-body").textContent();
    expect(
      bodyText?.includes("取引がありません") || bodyText?.trim() === "",
    ).toBeTruthy();
  });
});
