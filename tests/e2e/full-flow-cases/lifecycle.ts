import { expect, test } from "@playwright/test";
import {
  enterGame,
  winCurrentLevel,
  getBlockIds,
  leaveActiveGame,
  reset,
} from "../support/full-flow-fixtures";
import { resetPage } from "../support/common";

test.describe.configure({ timeout: 120_000 });

test.describe("狗了个狗完整浏览器闭环 · lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
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

  test("首关优先使用 Worker，并在发布候选后终止", async ({ page }) => {
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      const lifecycle = { created: 0, terminated: 0 };
      Object.defineProperty(window, "__dogWorkerLifecycle", {
        configurable: true,
        value: lifecycle,
      });
      window.Worker = class TrackedWorker extends NativeWorker {
        constructor(scriptURL: string | URL, options?: WorkerOptions) {
          super(scriptURL, options);
          lifecycle.created += 1;
        }

        override terminate(): void {
          lifecycle.terminated += 1;
          super.terminate();
        }
      };
    });
    await page.reload();
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();

    await expect(page.getByTestId("dog-board")).toBeVisible();
    const lifecycle = await page.evaluate(() =>
      (window as Window & {
        __dogWorkerLifecycle?: { created: number; terminated: number };
      }).__dogWorkerLifecycle,
    );
    expect(lifecycle).toEqual({ created: 1, terminated: 1 });
  });

  test("Worker 启动失败后同步重试并发布已验证棋盘", async ({ page }) => {
    await page.addInitScript(() => {
      window.Worker = class FailedWorker {
        constructor() {
          throw new Error("forced worker startup failure");
        }
      } as unknown as typeof Worker;
    });
    await page.reload();
    await page.getByRole("button", { name: "匿名注册" }).click();
    await page.getByRole("button", { name: "开始游戏" }).click();

    await expect(page.getByTestId("dog-board")).toBeVisible();
    await expect(page.getByTestId("game-generation-error")).toHaveCount(0);
    await expect(page.getByTestId("dog-game")).toHaveAttribute(
      "data-run-seed",
      /^run-/,
    );
  });
});
