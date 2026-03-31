import { test, expect, type Page } from "@playwright/test";
import { withHtmx, gotoAndWaitForTable } from "./helpers";

/** 品目を作成して返す */
async function ensureItem(
  page: Page,
  suffix: string,
): Promise<{ code: string; name: string }> {
  const code = `BOM-ITEM-${suffix}-${Date.now()}`;
  const name = `BOMテスト品目${suffix}`;
  await gotoAndWaitForTable(page, "/品目", "/api/品目");

  await page.getByText("＋ 新規追加").click();
  const form = page.locator("form[hx-post='/api/品目']");
  await expect(form).toBeVisible();

  await form.getByLabel("品目コード").fill(code);
  await form.getByLabel("品目名").fill(name);
  await form.getByLabel("単価").fill("100");

  await withHtmx(page, "/api/品目", () => form.getByText("登録する").click());
  await expect(form).not.toBeVisible();
  return { code, name };
}

/** BOM を作成し、編集ページの URL を返す */
async function createBOM(
  page: Page,
  itemCode: string,
  data: { code: string; version: string; name: string },
): Promise<string> {
  await page.goto("/BOM/new");
  await expect(
    page.getByRole("heading", { name: "BOM登録", level: 1 }),
  ).toBeVisible();

  const form = page.locator("form[hx-post='/api/BOM']");

  // ヘッダー入力
  await form.locator("input[name='コード']").fill(data.code);
  await form.locator("input[name='版']").fill(data.version);
  await form.locator("input[name='名称']").fill(data.name);

  // 製造品目セクション（section=0）に行追加
  await withHtmx(page, "/api/BOM/line-row", () =>
    page.locator("button[hx-get*='section=0']").click(),
  );

  // タイプアヘッドで品目を選択
  const outputRow = page.locator("#section-0-lines tr").last();
  const typeahead = outputRow.locator("[data-typeahead]");
  const searchInput = typeahead.getByPlaceholder("品目コード or 名前で検索…");

  await withHtmx(page, "/api/品目/search", () => searchInput.fill(itemCode));
  const listItem = typeahead.locator("li", { hasText: itemCode }).first();
  await expect(listItem).toBeVisible();
  await withHtmx(page, "/api/品目/typeahead", () => listItem.click());

  // 数量入力
  await outputRow.locator("input[name='line数量']").fill("10");

  // 送信 → HX-Redirect で BOM編集ページへ遷移
  await Promise.all([
    page.waitForURL(/\/BOM\/\d+/),
    form.locator("button[type='submit']").click(),
  ]);

  return page.url();
}

test.describe("BOM管理", () => {
  test("BOM管理ページが表示される", async ({ page }) => {
    await gotoAndWaitForTable(page, "/BOM", "/api/BOM");
    await expect(
      page.getByRole("heading", { name: "BOM管理", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("+ 新規BOM登録")).toBeVisible();
  });

  test("新規BOM登録リンクでBOM/newに遷移", async ({ page }) => {
    await gotoAndWaitForTable(page, "/BOM", "/api/BOM");
    await page.getByText("+ 新規BOM登録").click();
    await expect(page).toHaveURL("/BOM/new");
    await expect(
      page.getByRole("heading", { name: "BOM登録", level: 1 }),
    ).toBeVisible();
  });

  test.describe("BOM作成", () => {
    test("BOM登録フォームが表示される", async ({ page }) => {
      await page.goto("/BOM/new");
      await expect(
        page.getByRole("heading", { name: "BOM登録", level: 1 }),
      ).toBeVisible();

      const form = page.locator("form[hx-post='/api/BOM']");
      await expect(form).toBeVisible();
      await expect(form.locator("input[name='コード']")).toBeVisible();
      await expect(form.locator("input[name='版']")).toBeVisible();
      await expect(form.locator("input[name='名称']")).toBeVisible();

      await expect(page.getByText("製造品目（アウトプット）")).toBeVisible();
      await expect(page.getByText("投入品目（インプット）")).toBeVisible();
    });

    test("行追加ボタンで明細行が追加される", async ({ page }) => {
      await page.goto("/BOM/new");

      // 製造品目セクションに行追加
      await expect(page.locator("#section-0-lines tr")).toHaveCount(0);
      await withHtmx(page, "/api/BOM/line-row", () =>
        page.locator("button[hx-get*='section=0']").click(),
      );
      await expect(page.locator("#section-0-lines tr")).toHaveCount(1);

      // 投入品目セクションに行追加
      await expect(page.locator("#section-1-lines tr")).toHaveCount(0);
      await withHtmx(page, "/api/BOM/line-row", () =>
        page.locator("button[hx-get*='section=1']").click(),
      );
      await expect(page.locator("#section-1-lines tr")).toHaveCount(1);
    });

    test("×ボタンで明細行が削除される", async ({ page }) => {
      await page.goto("/BOM/new");

      // 行追加
      await withHtmx(page, "/api/BOM/line-row", () =>
        page.locator("button[hx-get*='section=0']").click(),
      );
      await expect(page.locator("#section-0-lines tr")).toHaveCount(1);

      // ×ボタンで削除
      await page.locator("#section-0-lines tr").last().getByText("×").click();
      await expect(page.locator("#section-0-lines tr")).toHaveCount(0);
    });

    test("BOMを新規登録できる", async ({ page }) => {
      const { code: itemCode } = await ensureItem(page, "OUT");

      const bomCode = `BOM-${Date.now()}`;
      await createBOM(page, itemCode, {
        code: bomCode,
        version: "1",
        name: "テストBOM",
      });

      // 編集ページにリダイレクトされる
      await expect(
        page.getByRole("heading", { name: "BOM編集", level: 1 }),
      ).toBeVisible();

      // ヘッダーの値が保持されている
      await expect(page.locator("input[name='コード']")).toHaveValue(bomCode);
      await expect(page.locator("input[name='版']")).toHaveValue("1");
      await expect(page.locator("input[name='名称']")).toHaveValue("テストBOM");
    });

    test("キャンセルでBOM一覧に戻る", async ({ page }) => {
      await page.goto("/BOM/new");
      await page.getByText("キャンセル").click();
      await expect(page).toHaveURL("/BOM");
    });
  });

  test.describe("BOM編集", () => {
    test("一覧から編集ページへ遷移できる", async ({ page }) => {
      const { code: itemCode } = await ensureItem(page, "NAV");
      const bomCode = `BOM-NAV-${Date.now()}`;
      await createBOM(page, itemCode, {
        code: bomCode,
        version: "1",
        name: "ナビテストBOM",
      });

      await gotoAndWaitForTable(page, "/BOM", "/api/BOM");
      const row = page.locator("#boms-body tr", { hasText: bomCode });
      await row.getByText("編集").click();

      await expect(page).toHaveURL(/\/BOM\/\d+$/);
      await expect(
        page.getByRole("heading", { name: "BOM編集", level: 1 }),
      ).toBeVisible();
    });

    test("BOMを更新できる", async ({ page }) => {
      const { code: itemCode } = await ensureItem(page, "UPD");
      const bomCode = `BOM-UPD-${Date.now()}`;
      const editUrl = await createBOM(page, itemCode, {
        code: bomCode,
        version: "1",
        name: "更新前BOM",
      });

      // 名称を変更して更新
      const nameInput = page.locator("input[name='名称']");
      await nameInput.fill("更新後BOM");

      const form = page.locator("form[hx-put]");
      await Promise.all([
        page.waitForURL(/\/BOM\/\d+/),
        form.locator("button[type='submit']").click(),
      ]);

      // 更新後の値が反映されている
      await expect(page.locator("input[name='名称']")).toHaveValue("更新後BOM");
    });
  });

  test.describe("BOM削除", () => {
    test("一覧からBOMを削除できる", async ({ page }) => {
      const { code: itemCode } = await ensureItem(page, "DEL");
      const bomCode = `BOM-DEL-${Date.now()}`;
      await createBOM(page, itemCode, {
        code: bomCode,
        version: "1",
        name: "削除対象BOM",
      });

      await gotoAndWaitForTable(page, "/BOM", "/api/BOM");
      const row = page.locator("#boms-body tr", { hasText: bomCode });

      page.on("dialog", (dialog) => dialog.accept());

      // ケバブメニューを開く
      await row.locator("[x-data] > button").click();
      const deleteBtn = row.getByRole("button", { name: "削除" });
      await expect(deleteBtn).toBeVisible();

      await withHtmx(page, "/api/BOM/", () => deleteBtn.click());

      await expect(page.locator("#boms-body")).not.toContainText(bomCode);
    });
  });
});
