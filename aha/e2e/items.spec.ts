import { test, expect, type Page } from "@playwright/test";
import { withHtmx, gotoAndWaitForTable } from "./helpers";

/** 品目を追加するヘルパー */
async function addItem(
  page: Page,
  data: { code: string; name: string; category?: string; price?: string },
) {
  await page.getByText("＋ 新規追加").click();

  const form = page.locator("form[hx-post='/api/items']");
  await expect(form).toBeVisible();

  await form.getByLabel("品目コード").fill(data.code);
  await form.getByLabel("品目名").fill(data.name);
  if (data.category) {
    await form.getByLabel("カテゴリ").fill(data.category);
  }
  if (data.price) {
    await form.getByLabel("単価").fill(data.price);
  }

  await withHtmx(page, "/api/items", () => form.getByText("登録する").click());
}

test.describe("品目管理", () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndWaitForTable(page, "/items", "/api/items");
  });

  test("品目管理ページが表示される", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "品目管理", level: 1 })).toBeVisible();
    await expect(page.getByText("＋ 新規追加")).toBeVisible();
    await expect(
      page.getByPlaceholder("品目コード・品目名で検索…"),
    ).toBeVisible();
  });

  test("新規追加フォームの開閉ができる", async ({ page }) => {
    await page.getByText("＋ 新規追加").click();
    await expect(page.getByText("新規品目登録")).toBeVisible();

    await page.getByText("閉じる").click();
    await expect(page.getByText("新規品目登録")).not.toBeVisible();
  });

  test("品目を新規登録できる", async ({ page }) => {
    const code = `TEST-${Date.now()}`;
    await addItem(page, {
      code,
      name: "テスト品目",
      category: "テストカテゴリ",
      price: "1000",
    });

    await expect(page.locator("#items-body")).toContainText(code);
    await expect(page.locator("#items-body")).toContainText("テスト品目");
  });

  test("品目をインライン編集できる", async ({ page }) => {
    const code = `EDIT-${Date.now()}`;
    await addItem(page, { code, name: "編集前品目", price: "500" });

    const row = page.locator("#items-body tr", { hasText: code });
    await withHtmx(page, "/edit", () =>
      row.getByRole("button", { name: "編集" }).click(),
    );

    // 編集行の name input が出現するのを待つ
    const nameInput = page.locator(`#items-body input[name='name'][value='編集前品目']`);
    await expect(nameInput).toBeVisible();
    await nameInput.fill("編集後品目");

    await withHtmx(page, "/api/items/", () =>
      page.locator("#items-body").getByRole("button", { name: "保存" }).click(),
    );

    await expect(page.locator("#items-body")).toContainText("編集後品目");
  });

  test("品目を個別削除できる", async ({ page }) => {
    const code = `DEL-${Date.now()}`;
    await addItem(page, { code, name: "削除対象品目" });

    page.on("dialog", (dialog) => dialog.accept());

    const row = page.locator("#items-body tr", { hasText: code });
    // ケバブメニューを開く
    await row.locator("[x-data] > button").click();
    // 削除ボタンが見えるまで待つ
    const deleteBtn = row.getByRole("button", { name: "削除" });
    await expect(deleteBtn).toBeVisible();

    await withHtmx(page, "/api/items/", () => deleteBtn.click());

    await expect(page.locator("#items-body")).not.toContainText(code);
  });

  test("検索フィルタで品目を絞り込める", async ({ page }) => {
    const prefix = `SRCH-${Date.now()}`;
    await addItem(page, { code: `${prefix}-A`, name: "りんご", category: "果物" });
    await addItem(page, { code: `${prefix}-B`, name: "にんじん", category: "野菜" });

    const searchInput = page.getByPlaceholder("品目コード・品目名で検索…");
    await withHtmx(page, "/api/items", () => searchInput.fill("りんご"));

    await expect(page.locator("#items-body")).toContainText("りんご");
    await expect(page.locator("#items-body")).not.toContainText("にんじん");
  });

  test("カテゴリで絞り込める", async ({ page }) => {
    const tag = `UC-${Date.now()}`;
    await addItem(page, { code: `CAT-${tag}`, name: "カテゴリテスト品目", category: tag });

    // 検索欄をクリアしてからカテゴリで絞り込む
    // clear() + カテゴリ fill を1つの htmx レスポンスで待つ
    const searchInput = page.getByPlaceholder("品目コード・品目名で検索…");
    await searchInput.clear();

    const categoryInput = page.getByPlaceholder("カテゴリ");
    await withHtmx(page, "/api/items", () => categoryInput.fill(tag));

    await expect(page.locator("#items-body")).toContainText("カテゴリテスト品目");
  });

  test("選択コピー・選択削除ボタンは未選択時に無効", async ({ page }) => {
    await expect(page.getByText("選択コピー")).toBeDisabled();
    await expect(page.getByText("選択削除")).toBeDisabled();
  });

  test("行を選択すると選択コピー・選択削除が有効になる", async ({ page }) => {
    const code = `SEL-${Date.now()}`;
    await addItem(page, { code, name: "選択テスト品目" });

    const row = page.locator("#items-body tr", { hasText: code });
    await row.getByRole("checkbox").check();

    await expect(page.getByText("選択コピー")).toBeEnabled();
    await expect(page.getByText("選択削除")).toBeEnabled();
  });

  test("更新ボタンでテーブルがリロードされる", async ({ page }) => {
    await withHtmx(page, "/api/items", () =>
      page.locator("button", { hasText: "更新" }).click(),
    );
    await expect(page.getByRole("heading", { name: "品目管理", level: 1 })).toBeVisible();
  });
});
