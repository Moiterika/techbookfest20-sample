import { test, expect, type Page } from "@playwright/test";
import { withHtmx, gotoAndWaitForTable } from "./helpers";

/** 品目を先に登録（取引に品目が必要） */
async function ensureItem(page: Page): Promise<{ code: string }> {
  const code = `TX-ITEM-${Date.now()}`;
  await gotoAndWaitForTable(page, "/品目", "/api/品目");

  await page.getByText("＋ 新規追加").click();
  const form = page.locator("form[hx-post='/api/品目']");
  await expect(form).toBeVisible();

  await form.getByLabel("品目コード").fill(code);
  await form.getByLabel("品目名").fill("取引テスト品目");
  await form.getByLabel("単価").fill("500");

  await withHtmx(page, "/api/品目", () => form.getByText("登録する").click());

  return { code };
}

/** 取引区分を先に登録（取引に取引区分が必要） */
async function ensureTxType(page: Page): Promise<void> {
  await gotoAndWaitForTable(page, "/取引区分", "/api/取引区分");

  // 既に取引区分があればスキップ
  const body = page.locator("#txtypes-body");
  const text = await body.textContent();
  if (text && !text.includes("取引区分がありません") && text.trim() !== "") return;

  await page.getByText("＋ 新規追加").click();
  const form = page.locator("form[hx-post='/api/取引区分']");
  await expect(form).toBeVisible();

  await form.getByLabel("取引区分コード").fill("IN");
  await form.getByLabel("取引区分名称").fill("入庫");
  await form.getByLabel("受払係数").selectOption("1");

  await withHtmx(page, "/api/取引区分", () =>
    form.getByText("登録する").click(),
  );
}

test.describe("取引管理", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndWaitForTable(page, "/取引", "/api/取引");
  });

  test("取引管理ページが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "取引管理", level: 1 })).toBeVisible();
    await expect(page.getByText("＋ 新規追加")).toBeVisible();
    await expect(page.locator("input[name='開始日']")).toBeVisible();
    await expect(page.locator("input[name='終了日']")).toBeVisible();
  });

  test("新規追加フォームの開閉ができる", async ({ page }) => {
    await page.getByText("＋ 新規追加").click();
    await expect(page.getByText("新規取引登録")).toBeVisible();

    await page.getByRole("button", { name: "閉じる", exact: true }).first().click();
    await expect(page.getByText("新規取引登録")).not.toBeVisible();
  });

  test("取引を新規登録できる（品目タイプアヘッド経由）", async ({ page }) => {
    // 取引区分・品目を事前登録
    await ensureTxType(page);
    const { code } = await ensureItem(page);
    await gotoAndWaitForTable(page, "/取引", "/api/取引");

    await page.getByText("＋ 新規追加").click();
    await expect(page.getByText("新規取引登録")).toBeVisible();

    const form = page.locator("form[hx-post='/api/取引']");

    // 取引区分を選択（最初のオプション = index 0）
    await form.getByLabel("取引区分").selectOption({ index: 0 });

    // タイプアヘッド: 品目コードで検索
    const typeahead = page.locator("[data-typeahead]").first();
    const searchInput = typeahead.getByPlaceholder("品目コード or 名前で検索…");
    await withHtmx(page, "/api/品目/search", () => searchInput.fill(code));

    // 候補リストの li をクリック
    const listItem = typeahead.locator("li", { hasText: code }).first();
    await withHtmx(page, "/api/品目/typeahead", () => listItem.click());

    // 単価・数量を入力
    await form.getByLabel("単価").fill("500");
    await form.getByLabel("数量").fill("3");

    // 登録
    await withHtmx(page, "/api/取引", () => form.getByText("登録する").click());

    // テーブルに取引が表示される
    await expect(page.locator("#tx-body")).toContainText(code);
  });

  test("選択コピー・選択削除ボタンは未選択時に無効", async ({ page }) => {
    await expect(page.getByText("選択コピー")).toBeDisabled();
    await expect(page.getByText("選択削除")).toBeDisabled();
  });

  test("更新ボタンでテーブルがリロードされる", async ({ page }) => {
    await withHtmx(page, "/api/取引", () =>
      page.locator("button", { hasText: "更新" }).click(),
    );
    await expect(page.getByRole("heading", { name: "取引管理", level: 1 })).toBeVisible();
  });

  test("日付フィルタが機能する", async ({ page }) => {
    const dateFrom = page.locator("input[name='開始日']");
    const dateTo = page.locator("input[name='終了日']");

    await withHtmx(page, "/api/取引", () => dateFrom.fill("2099-01-01"));
    await withHtmx(page, "/api/取引", () => dateTo.fill("2099-12-31"));

    await expect(page.locator("#tx-body")).toHaveText(/取引がありません|^\s*$/);
  });
});
