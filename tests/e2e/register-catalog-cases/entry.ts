import { expect, test } from "@playwright/test";
import { acceptBeforeUnload, confirmDogLoadout, resetPage } from "../support/common";

test.describe.configure({ timeout: 120_000 });

test.describe("注册与游戏目录 · entry", () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
  });

  test("首次访问注册后进入目录并看到首个游戏", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "开始你的第一局" })).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "匿名注册" }).click();

    await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    ).toBe(true);
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toBeVisible();
    await expect(page.getByText("最高解锁关卡")).toBeVisible();
    await expect(page.getByText("累计积分")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "开始游戏" })).toHaveText("开始游戏");

    const catalogText = await page.locator('[data-view="catalog"]').textContent();
    expect(catalogText).not.toContain("你的游戏合集");
    expect(catalogText).not.toContain("首个游戏");
    expect(catalogText).not.toContain("更多游戏正在路上");
    expect(catalogText).not.toContain("当前浏览器身份");
    const coverSource = await page.locator(".catalog-item__cover").getAttribute("src");
    expect(decodeURIComponent(coverSource ?? "")).not.toContain("GAMEBOX · 01");

    await page.getByRole("button", { name: "开始游戏" }).click();
    await expect(page.getByTestId("dog-loadout-modal")).toBeVisible();
    await expect(page.getByTestId("dog-loadout-panel")).toBeVisible();
    await expect(page.getByTestId("dog-loadout-option")).toHaveCount(7);
    await confirmDogLoadout(page);
    await expect(page.getByTestId("dog-loadout-thumbnail")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "变更" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "狗了个狗" })).toHaveCount(0);
    const catalogButton = page.locator('[data-view="game-entry"] [data-action="catalog"]');
    await expect(catalogButton).toHaveAttribute("aria-label", "返回游戏目录");
    await expect(catalogButton).toHaveText("");
    await expect(catalogButton.locator("svg")).toBeVisible();
    await expect(page.locator('[data-testid="level-picker"]')).toHaveCount(0);
    await expect(page.locator('[data-view="game-entry"] [data-action="select-level"]')).toHaveCount(0);
    await expect(page.locator('[data-view="game-entry"] [data-action="toggle-sound"]')).toBeVisible();
    await expect(page.getByTestId("dog-active-level")).toContainText("1");
    await expect(page.locator('[data-testid="dog-game"] h2')).toHaveCount(0);
    await expect(page.getByText("游戏入口已打开")).toHaveCount(0);
    await expect(page.getByText("固定首关")).toHaveCount(0);
    await expect(page.getByText("稳定关卡")).toHaveCount(0);
    await expect(page.getByText("选择没有遮挡的方块，凑齐三个相同图案。")).toHaveCount(0);
    await expect(page.getByText("剩余方块")).toHaveCount(0);
    await expect(page.getByText("图案")).toHaveCount(0);
    await expect(page.getByText("层数")).toHaveCount(0);
  });

  test("目录卡片右侧动作行保持紧凑高度", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "匿名注册" }).click();

    const layout = await page.evaluate(() => {
      const getHeight = (selector: string): number => {
        const element = document.querySelector<HTMLElement>(selector);
        return element?.getBoundingClientRect().height ?? 0;
      };

      return {
        actionsHeight: getHeight(".catalog-item__actions"),
        levelHeight: getHeight(".catalog-item__level"),
        buttonHeight: getHeight('.catalog-item__actions [data-action="enter-game"]'),
        coverObjectFit: getComputedStyle(
          document.querySelector<HTMLElement>(".catalog-item__cover") as HTMLElement,
        ).objectFit,
      };
    });
    expect(layout.actionsHeight).toBeLessThanOrEqual(72);
    expect(layout.buttonHeight).toBeLessThanOrEqual(72);
    expect(layout.levelHeight).toBeLessThanOrEqual(72);
    expect(layout.coverObjectFit).toBe("cover");
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
