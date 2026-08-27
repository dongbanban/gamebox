import { expect, test } from "@playwright/test";
import {
  enterGame,
  loseCurrentLevel,
  winCurrentLevel,
  leaveActiveGame,
  getBlockIds,
} from "../support/full-flow-fixtures";
import { resetPage } from "../support/common";

test.describe.configure({ timeout: 120_000 });

test.describe("狗了个狗完整浏览器闭环 · failure-and-next", () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test("失败、重新挑战、返回与浏览器后退离开保护", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await enterGame(page);

    await loseCurrentLevel(page);

    await expect(page.locator('[data-view="game-result"]')).toHaveAttribute(
      "data-result",
      "lost",
    );
    await expect(page.getByRole("button", { name: "重新挑战" })).toBeVisible();
    await page.getByRole("button", { name: "重新挑战" }).click();
    await expect(page.getByTestId("dog-board")).toBeVisible();

    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const cancelledDialog = page.waitForEvent("dialog");
    const cancelledNavigation = page.goBack();
    const firstDialog = await cancelledDialog;
    expect(firstDialog.message()).toBe("当前关卡不会保存，确认离开？");
    await firstDialog.dismiss();
    await cancelledNavigation;
    await expect(page.getByTestId("dog-board")).toBeVisible();

    await leaveActiveGame(page, true);
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  });

  test("通关后直接进入下一关并创建空的新局内状态", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await enterGame(page);
    const firstLevelBlockIds = await getBlockIds(page);

    await winCurrentLevel(page);
    await page.getByRole("button", { name: "进入下一关" }).click();

    await expect(page.getByTestId("dog-game")).toBeVisible();
    await expect(page.getByTestId("dog-active-level")).toContainText("2");
    await expect(page.getByTestId("dog-board")).toBeVisible();
    const nextLevelPhysicalBlockCount = await page
      .locator('[data-testid="dog-block"]')
      .count();
    const nextLevelTwinCount = await page
      .locator('[data-testid="dog-block"][data-special-mechanism="twin"]')
      .count();
    expect(nextLevelPhysicalBlockCount + nextLevelTwinCount).toBe(90);
    await expect(page.locator('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveCount(0);
    const nextLevelBlockIds = await getBlockIds(page);
    expect(nextLevelBlockIds).not.toEqual(firstLevelBlockIds);
  });
});
