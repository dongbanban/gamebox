import { expect, test } from "@playwright/test";
import { resetPage } from "../support/common";

test.describe.configure({ timeout: 120_000 });

test.describe("狗了个狗完整浏览器闭环 · storage", () => {
  test.beforeEach(async ({ page }) => {
    await resetPage(page);
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
