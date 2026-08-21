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
    const resultVisuals = await page.evaluate(() => {
      const eyebrow = document.querySelector<HTMLElement>(
        ".game-result-card--won .eyebrow",
      );
      const catalogButton = document.querySelector<HTMLElement>(
        ".game-result-card--won [data-action=\"catalog\"]",
      );
      return {
        eyebrowColor: eyebrow === null ? "" : getComputedStyle(eyebrow).color,
        catalogBorderColor:
          catalogButton === null ? "" : getComputedStyle(catalogButton).borderTopColor,
      };
    });
    expect(resultVisuals.eyebrowColor).toBe("rgb(63, 148, 195)");
    expect(resultVisuals.catalogBorderColor).toBe("rgb(63, 148, 195)");
    expect(
      await page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "返回游戏目录" }).click();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await expect(page.getByText("第 2 关")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await enterGame(page);
    await expect(page.getByTestId("dog-active-level")).toContainText("2");

    await leaveActiveGame(page, false);
    await expect(page.getByTestId("dog-board")).toBeVisible();
    await leaveActiveGame(page, true);
    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    await reset(page);
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    await expect(page.evaluate(() => window.localStorage.getItem("gamebox.state"))).resolves.toBeNull();
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
    await expect(page.locator('[data-testid="dog-block"]')).toHaveCount(90);
    await expect(page.locator('[data-testid="dog-tray-slot"][data-pattern-type]')).toHaveCount(0);
    const nextLevelBlockIds = await getBlockIds(page);
    expect(nextLevelBlockIds).not.toEqual(firstLevelBlockIds);
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
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("dog-game")).toBeVisible();
  await confirmDogLoadout(page);
}

async function confirmDogLoadout(page: Page): Promise<void> {
  const panel = page.getByTestId("dog-loadout-panel");
  if (!(await panel.isVisible().catch(() => false))) {
    return;
  }

  for (const itemId of ["triple-removal", "tray-capacity", "wildcard"]) {
    await page.locator(
      `[data-testid="dog-loadout-option"][data-loadout-id="${itemId}"]`,
    ).click();
  }
  await page.getByTestId("dog-loadout-confirm").click();
  await expect(page.getByTestId("dog-loadout-summary")).toBeVisible();
}

async function getBlockIds(page: Page): Promise<(string | null)[]> {
  return page
    .locator('[data-testid="dog-block"]')
    .evaluateAll((blocks) => blocks.map((block) => block.getAttribute("data-block-id")));
}

async function clickBlock(page: Page, blockId: string): Promise<void> {
  await page.locator(`[data-testid="dog-block"][data-block-id="${blockId}"]`).click();
  await page.waitForFunction(() => {
    const game = document.querySelector<HTMLElement>('[data-testid="dog-game"]');
    return game === null || game.dataset.inputLocked === "false";
  });
}

async function loseCurrentLevel(page: Page): Promise<void> {
  const selectedPatterns: string[] = [];
  for (let selectionNumber = 0; selectionNumber < 7; selectionNumber += 1) {
    const blockId = await page
      .locator('[data-testid="dog-block"]:not([disabled])')
      .evaluateAll((blocks, patterns) => {
        const counts = new Map<string, number>();
        for (const pattern of patterns) {
          counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
        }
        return blocks.find((block) => {
          const pattern = block.dataset.patternType;
          return pattern !== undefined && (counts.get(pattern) ?? 0) < 2;
        })?.dataset.blockId ?? null;
      }, selectedPatterns);
    expect(blockId).not.toBeNull();
    const pattern = await page
      .locator(`[data-testid="dog-block"][data-block-id="${blockId}"]`)
      .getAttribute("data-pattern-type");
    expect(pattern).not.toBeNull();
    selectedPatterns.push(pattern ?? "");
    await clickBlock(page, blockId ?? "");
  }
}

async function winCurrentLevel(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await page.locator('[data-result="won"]').isVisible().catch(() => false)) {
      return;
    }

    const blockId = await page
      .locator('[data-testid="dog-block"]:not([disabled])')
      .evaluateAll((blocks) => {
        const trayPatterns = [...document.querySelectorAll<HTMLElement>(
          '[data-testid="dog-tray-slot"][data-pattern-type]',
        )]
          .filter((slot) => slot.dataset.specialMechanismState !== "frozen")
          .map((slot) => slot.dataset.patternType);
        const trayCounts = new Map<string, number>();
        for (const pattern of trayPatterns) {
          if (pattern !== undefined) {
            trayCounts.set(pattern, (trayCounts.get(pattern) ?? 0) + 1);
          }
        }

        return [...blocks]
          .sort((first, second) => {
            const firstPattern = first.dataset.patternType ?? "";
            const secondPattern = second.dataset.patternType ?? "";
            return (
              (trayCounts.get(secondPattern) ?? 0) - (trayCounts.get(firstPattern) ?? 0) ||
              Number(second.dataset.z ?? 0) - Number(first.dataset.z ?? 0)
            );
          })
          .at(0)?.dataset.blockId ?? null;
      });
    const block = page.locator(
      `[data-testid="dog-block"][data-block-id="${blockId}"]`,
    );
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
