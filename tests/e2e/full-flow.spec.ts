import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

test.describe("狗了个狗完整浏览器闭环", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
  });

  test("注册、目录、进入、通关、刷新回访、音效设置与重置", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toBeVisible();

    await enterGame(page);
    await expect(page.getByTestId("dog-board")).toBeVisible();
    await expect(page.getByRole("button", { name: "音效开启" })).toBeVisible();

    await page.getByRole("button", { name: "音效开启" }).click();
    await expect(page.getByRole("button", { name: "音效关闭" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await enterGame(page);
    await expect(page.getByRole("button", { name: "音效关闭" })).toBeVisible();

    await winCurrentLevel(page);
    await expect(page.locator('[data-view="game-result"]')).toHaveAttribute(
      "data-result",
      "won",
    );
    await expect(page.getByText("通关奖励")).toBeVisible();
    await expect(page.getByText("累计积分")).toBeVisible();

    await page.getByRole("button", { name: "返回游戏目录" }).click();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByText("第 2 关")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await enterGame(page);
    await expect(page.getByRole("heading", { name: "第 2 关" })).toBeVisible();

    await leaveActiveGame(page, true);
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await reset(page);
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBeNull();
  });

  test("失败、重新挑战、返回与浏览器后退离开保护", async ({ page }) => {
    await page.getByRole("button", { name: "匿名注册" }).click();
    await enterGame(page);

    for (const blockNumber of [73, 76, 79, 82, 74, 77, 80]) {
      await clickBlock(page, `first-level-block-${blockNumber}`);
    }

    await expect(page.locator('[data-view="game-result"]')).toHaveAttribute(
      "data-result",
      "lost",
    );
    await expect(page.getByRole("button", { name: "重新挑战" })).toBeVisible();
    await page.getByRole("button", { name: "重新挑战" }).click();
    await expect(page.getByTestId("dog-board")).toBeVisible();

    await clickBlock(page, "first-level-block-73");
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

  test("损坏存储显示降级提示", async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.setItem("gamebox.state", "{damaged");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await expect(page.getByTestId("persistence-warning")).toContainText("无法持久化");
  });

  test("不可用存储仍允许临时打开应用", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new Error("storage unavailable");
        },
      });
    });
    await page.reload();
    await expect(page.getByTestId("persistence-warning")).toContainText("无法持久化");
    await page.getByRole("button", { name: "匿名注册" }).click();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  });

  test("写入失败显示降级提示", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function setItem(): never {
        throw new Error("storage write failed");
      };
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await page.getByRole("button", { name: "匿名注册" }).click();
    await expect(page.getByTestId("persistence-warning")).toContainText("无法持久化");
  });
});

async function enterGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "进入游戏" }).click();
  await expect(page.getByTestId("dog-game")).toBeVisible();
}

async function clickBlock(page: Page, blockId: string): Promise<void> {
  await page.locator(`[data-testid="dog-block"][data-block-id="${blockId}"]`).click();
  await page.waitForFunction(() => {
    const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
    return game === null || game.dataset.inputLocked === "false";
  });
}

async function winCurrentLevel(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await page.locator('[data-result="won"]').isVisible().catch(() => false)) {
      return;
    }

    const highestSelectableLayer = await page
      .locator('[data-testid="dog-block"]:not([disabled])')
      .evaluateAll((blocks) =>
        Math.max(...blocks.map((block) => Number((block as HTMLElement).dataset.z ?? 0))),
      );
    const block = page
      .locator(
        `[data-testid="dog-block"][data-z="${highestSelectableLayer}"]:not([disabled])`,
      )
      .first();
    await expect(block).toBeVisible();
    await block.click();
    await page.waitForFunction(() => {
      const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
      return game === null || game.dataset.inputLocked === "false";
    });
  }

  await expect(page.locator('[data-result="won"]')).toBeVisible();
}

async function leaveActiveGame(page: Page, accept: boolean): Promise<void> {
  const dialog = page.waitForEvent("dialog");
  const navigation = page.getByRole("button", { name: "返回游戏目录" }).click();
  const confirmation = await dialog;
  expect(confirmation.message()).toBe("当前关卡不会保存，确认离开？");
  if (accept) {
    await confirmation.accept();
  } else {
    await confirmation.dismiss();
  }
  await navigation;
}

async function reset(page: Page): Promise<void> {
  const dialog = page.waitForEvent("dialog");
  const resetAction = page.getByRole("button", { name: "重置本地数据" }).click();
  const confirmation = await dialog;
  expect(confirmation.message()).toBe(
    "确认重置本地数据？用户、游戏进度、积分与应用设置都会被清除。",
  );
  await confirmation.accept();
  await resetAction;
}
