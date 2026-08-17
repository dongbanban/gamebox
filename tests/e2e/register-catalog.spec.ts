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

  test("浏览器后退在活动关卡中确认，取消后继续并确认后返回目录", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "进入游戏" }).click();
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
    await page.getByRole("button", { name: "进入游戏" }).click();
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    await page.reload();

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByTestId("dog-board")).toHaveCount(0);
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBe(
      savedState,
    );
  });

  test("关闭活动关卡后重新打开不恢复半局", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "进入游戏" }).click();
    await page.locator('[data-testid="dog-block"]:not([disabled])').first().click();
    const savedState = await page.evaluate(() => window.localStorage.getItem("gamebox.state"));

    await page.close();
    const reopenedPage = await page.context().newPage();
    await reopenedPage.goto("/");

    await expect(reopenedPage.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(reopenedPage.getByTestId("dog-board")).toHaveCount(0);
    await expect(
      reopenedPage.evaluate(() => window.localStorage.getItem("gamebox.state")),
    ).resolves.toBe(savedState);
    await reopenedPage.close();
  });

  test("移动端竖屏棋盘自动缩放且不产生横向滚动", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "进入游戏" }).click();

    const layout = await page.evaluate(() => {
      const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const rect = board?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        boardLeft: rect?.left ?? 0,
        boardRight: rect?.right ?? 0,
        boardWidth: rect?.width ?? 0,
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.boardLeft).toBeGreaterThanOrEqual(0);
    expect(layout.boardRight).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.boardWidth).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopLayout = await page.evaluate(() => {
      const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
      const frame = document.querySelector<HTMLElement>('.dog-board-frame');
      const boardRect = board?.getBoundingClientRect();
      const frameRect = frame?.getBoundingClientRect();
      return {
        boardWidth: boardRect?.width ?? 0,
        boardCenter: boardRect === undefined ? 0 : boardRect.left + boardRect.width / 2,
        frameCenter: frameRect === undefined ? 0 : frameRect.left + frameRect.width / 2,
      };
    });

    expect(desktopLayout.boardWidth).toBeLessThanOrEqual(720);
    expect(Math.abs(desktopLayout.boardCenter - desktopLayout.frameCenter)).toBeLessThanOrEqual(1);
  });
});
