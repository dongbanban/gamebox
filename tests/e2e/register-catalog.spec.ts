import { expect, test } from "@playwright/test";

test.describe("注册与游戏目录", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("首次访问注册后进入目录并看到首个游戏", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();

    await page.getByRole("button", { name: "匿名注册" }).click();

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toBeVisible();
    await expect(page.getByText("最高解锁关卡")).toBeVisible();
    await expect(page.getByText("累计积分")).toBeVisible();
    await expect(page.getByRole("button", { name: "进入游戏" })).toBeVisible();

    await page.getByRole("button", { name: "进入游戏" }).click();
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toBeVisible();
    await expect(page.getByRole("button", { name: "返回游戏目录" })).toBeVisible();
  });

  test("回访跳过注册，确认重置后返回注册页", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.reload();

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "重置本地数据" }).click();

    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBeNull();
  });
});
