import { test, expect } from "@playwright/test";

test.describe("ナビゲーション", () => {
  test("ホームページが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "aha", level: 1 })).toBeVisible();
  });

  test("ホームから品目管理へ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/items"]');
    await expect(page).toHaveURL("/items");
    await expect(page.getByRole("heading", { name: "品目管理", level: 1 })).toBeVisible();
  });

  test("ホームから取引管理へ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/transactions"]');
    await expect(page).toHaveURL("/transactions");
    await expect(page.getByRole("heading", { name: "取引管理", level: 1 })).toBeVisible();
  });

  test("品目管理のナビから取引管理へ遷移できる", async ({ page }) => {
    await page.goto("/items");
    await page.locator("nav").getByText("取引管理").click();
    await expect(page).toHaveURL("/transactions");
  });

  test("取引管理のナビから品目管理へ遷移できる", async ({ page }) => {
    await page.goto("/transactions");
    await page.locator("nav").getByText("品目管理").click();
    await expect(page).toHaveURL("/items");
  });

  test("各ページのナビでホームに戻れる", async ({ page }) => {
    await page.goto("/items");
    await page.locator("nav").getByText("ホーム").click();
    await expect(page).toHaveURL("/");
  });

  test("現在のページのナビリンクがアクティブ表示される", async ({ page }) => {
    await page.goto("/items");
    const activeLink = page.locator("nav").getByText("品目管理");
    await expect(activeLink).toHaveCSS("pointer-events", "none");
  });
});
