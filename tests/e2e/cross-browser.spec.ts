import { expect, test } from "@playwright/test";

test("跨浏览器核心 smoke：注册、目录与首关入口可用", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "匿名注册" }).click();
  await expect(page.getByRole("heading", { name: "游戏目录" })).toBeVisible();
  await page.getByRole("button", { name: "开始游戏" }).click();
  await expect(page.getByTestId("dog-board")).toBeVisible();
  await expect(page.getByTestId("dog-active-level")).toContainText("1");

  const boardLayout = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>('[data-testid="dog-board"]');
    const block = document.querySelector<HTMLElement>('[data-testid="dog-block"]');
    const rect = board?.getBoundingClientRect();
    return {
      left: rect?.left ?? 0,
      right: rect?.right ?? 0,
      viewportWidth: window.innerWidth,
      blockWidth: block?.style.getPropertyValue("--block-width") ?? "",
      blockHeight: block?.style.getPropertyValue("--block-height") ?? "",
    };
  });
  expect(boardLayout.left).toBeGreaterThanOrEqual(0);
  expect(boardLayout.right).toBeLessThanOrEqual(boardLayout.viewportWidth);
  expect(boardLayout.blockWidth).toBe("40px");
  expect(boardLayout.blockHeight).toBe("40px");
});
