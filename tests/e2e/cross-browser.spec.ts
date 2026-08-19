import { expect, test } from "@playwright/test";

test("跨浏览器核心 smoke：注册、目录与首关入口可用", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "匿名注册" }).click();
  await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("dog-board")).toBeVisible();
  await expect(page.getByTestId("dog-active-level")).toContainText("1");
});
