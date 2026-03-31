import { test, expect } from "@playwright/test";

test.describe("ナビゲーション", () => {
  test("ホームページが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "aha", level: 1 })).toBeVisible();
  });

  test("ホームから品目管理へ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "品目管理", exact: true }).click();
    await expect(page).toHaveURL("/品目");
    await expect(page.getByRole("heading", { name: "品目管理", level: 1 })).toBeVisible();
  });

  test("ホームから取引管理へ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "取引管理", exact: true }).click();
    await expect(page).toHaveURL("/取引");
    await expect(page.getByRole("heading", { name: "取引管理", level: 1 })).toBeVisible();
  });

  test("品目管理のナビから取引管理へ遷移できる", async ({ page }) => {
    await page.goto("/品目");
    await page.locator("nav").getByText("取引管理").click();
    await expect(page).toHaveURL("/取引");
  });

  test("取引管理のナビから品目管理へ遷移できる", async ({ page }) => {
    await page.goto("/取引");
    await page.locator("nav").getByText("品目管理").click();
    await expect(page).toHaveURL("/品目");
  });

  test("各ページのナビでホームに戻れる", async ({ page }) => {
    await page.goto("/品目");
    await page.locator("nav").getByText("ホーム").click();
    await expect(page).toHaveURL("/");
  });

  test("ホームからBOM管理へ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "BOM管理", exact: true }).click();
    await expect(page).toHaveURL("/BOM");
    await expect(page.getByRole("heading", { name: "BOM管理", level: 1 })).toBeVisible();
  });

  test("BOM管理のナビから品目管理へ遷移できる", async ({ page }) => {
    await page.goto("/BOM");
    await page.locator("nav").getByText("品目管理").click();
    await expect(page).toHaveURL("/品目");
  });

  test("現在のページのナビリンクがアクティブ表示される", async ({ page }) => {
    await page.goto("/品目");
    const activeLink = page.locator("nav").getByText("品目管理");
    await expect(activeLink).toHaveCSS("pointer-events", "none");
  });
});
