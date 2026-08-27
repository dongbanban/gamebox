import { expect, test } from "@playwright/test";
import { acceptBeforeUnload, confirmDogLoadout, resetPage } from "../support/common";

test.describe.configure({ timeout: 120_000 });

test.describe("注册与游戏目录 · navigation", () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test("浏览器后退在活动关卡中确认，取消后继续并确认后返回目录", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    const cancelledDialog = page.waitForEvent("dialog");
    const cancelledNavigation = page.goBack();
    const firstDialog = await cancelledDialog;
    expect(firstDialog.message()).toBe("当前关卡不会保存，确认离开？");
    await firstDialog.dismiss();
    await cancelledNavigation;
    await expect(page.getByTestId("dog-board")).toBeVisible();

    const acceptedDialog = page.waitForEvent("dialog");
    const acceptedNavigation = page.goBack();
    const secondDialog = await acceptedDialog;
    expect(secondDialog.message()).toBe("当前关卡不会保存，确认离开？");
    await secondDialog.accept();
    await acceptedNavigation;
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBe(
      savedState,
    );
  });

  test("刷新活动关卡返回目录且不保存半局", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    await acceptBeforeUnload(page, () => page.reload());

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByTestId("dog-board")).toHaveCount(0);
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBe(
      savedState,
    );
  });

  test("关闭活动关卡后重新打开不恢复半局", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();
    await confirmDogLoadout(page);
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    await acceptBeforeUnload(page, () => page.close({ runBeforeUnload: true }));
    const reopenedPage = await page.context().newPage();
    await reopenedPage.goto("/");

    await expect(reopenedPage.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(reopenedPage.getByTestId("dog-board")).toHaveCount(0);
    await expect(
      reopenedPage.evaluate(() => window.localStorage.getItem("gamebox.state")),
    ).resolves.toBe(savedState);
    await reopenedPage.close();
  });
});
